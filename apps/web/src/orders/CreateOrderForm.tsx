import { useMutation } from '@apollo/client/react';
import { useState, type InputHTMLAttributes } from 'react';
import { CREATE_ORDER_MUTATION } from './documents';
import { formatCents, orderTotalCents } from './format';
import {
  emptyLineItem,
  emptyOrderForm,
  MAX_LINE_ITEMS,
  serverFieldErrors,
  toCreateOrderInput,
  validateOrderForm,
  type FieldErrors,
  type LineItemForm,
} from './order-form';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  path: string;
  label: string;
  errors: FieldErrors;
  hideLabel?: boolean;
}

function Field({ path, label, errors, hideLabel = false, ...input }: FieldProps) {
  const id = `field-${path}`;
  const error = errors[path];
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...input}
      />
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}

const draftTotalCents = (items: LineItemForm[]) =>
  orderTotalCents(
    items.map((item) => ({
      quantity: Number(item.quantity) || 0,
      unitPriceCents: Math.round((Number(item.unitPrice) || 0) * 100),
    })),
  );

export function CreateOrderForm({ onCreated }: { onCreated: (orderId: string) => void }) {
  const [form, setForm] = useState(emptyOrderForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [createOrder, { loading }] = useMutation(CREATE_ORDER_MUTATION);

  const setItem = (index: number, patch: Partial<LineItemForm>) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const submit = async () => {
    setFormError(null);
    const clientErrors = validateOrderForm(form);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    try {
      const { data } = await createOrder({ variables: { input: toCreateOrderInput(form) } });
      if (data) onCreated(data.createOrder.id);
    } catch (error) {
      const fieldErrors = serverFieldErrors(error);
      if (fieldErrors) setErrors(fieldErrors);
      else setFormError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <form
      noValidate
      className="create-order"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h2>New order</h2>

      <fieldset>
        <legend>Customer</legend>
        <Field
          path="customer.name"
          label="Customer name"
          errors={errors}
          value={form.customer.name}
          autoComplete="off"
          onChange={(event) => {
            setForm({ ...form, customer: { ...form.customer, name: event.target.value } });
          }}
        />
        <Field
          path="customer.email"
          label="Email"
          type="email"
          errors={errors}
          value={form.customer.email}
          autoComplete="off"
          onChange={(event) => {
            setForm({ ...form, customer: { ...form.customer, email: event.target.value } });
          }}
        />
      </fieldset>

      <fieldset>
        <legend>Line items</legend>
        {errors.lineItems && <p className="field-error">{errors.lineItems}</p>}
        {form.lineItems.map((item, index) => {
          const path = `lineItems.${String(index)}`;
          const row = `Item ${String(index + 1)}`;
          return (
            <div className="line-item" key={index}>
              <Field
                path={`${path}.sku`}
                label={`${row} SKU`}
                placeholder="SKU"
                hideLabel
                errors={errors}
                value={item.sku}
                onChange={(event) => {
                  setItem(index, { sku: event.target.value });
                }}
              />
              <Field
                path={`${path}.name`}
                label={`${row} name`}
                placeholder="Product name"
                hideLabel
                errors={errors}
                value={item.name}
                onChange={(event) => {
                  setItem(index, { name: event.target.value });
                }}
              />
              <Field
                path={`${path}.quantity`}
                label={`${row} quantity`}
                inputMode="numeric"
                hideLabel
                errors={errors}
                value={item.quantity}
                onChange={(event) => {
                  setItem(index, { quantity: event.target.value });
                }}
              />
              <Field
                path={`${path}.unitPrice`}
                label={`${row} unit price (€)`}
                placeholder="Unit price €"
                inputMode="decimal"
                hideLabel
                errors={errors}
                value={item.unitPrice}
                onChange={(event) => {
                  setItem(index, { unitPrice: event.target.value });
                }}
              />
              <button
                type="button"
                aria-label={`Remove item ${String(index + 1)}`}
                disabled={form.lineItems.length === 1}
                onClick={() => {
                  setForm({ ...form, lineItems: form.lineItems.filter((_, i) => i !== index) });
                  setErrors({});
                }}
              >
                Remove
              </button>
            </div>
          );
        })}
        <button
          type="button"
          disabled={form.lineItems.length >= MAX_LINE_ITEMS}
          onClick={() => {
            setForm({ ...form, lineItems: [...form.lineItems, emptyLineItem()] });
          }}
        >
          Add item
        </button>
      </fieldset>

      <p>
        Total: <strong>{formatCents(draftTotalCents(form.lineItems))}</strong>
      </p>

      {formError && (
        <div role="alert" className="error">
          Could not create the order: {formError}
        </div>
      )}

      <button type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create order'}
      </button>
    </form>
  );
}
