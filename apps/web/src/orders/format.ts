const euros = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' });

export const formatCents = (cents: number): string => euros.format(cents / 100);

export const orderTotalCents = (lineItems: readonly { quantity: number; unitPriceCents: number }[]): number =>
  lineItems.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0);

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export const formatState = (state: string): string => state.replace('_', ' ');
