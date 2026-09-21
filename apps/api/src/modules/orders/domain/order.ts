import type { OrderState } from './order-state.js';

export interface Customer {
  readonly name: string;
  readonly email: string;
}

/** Money is kept in integer minor units (cents) so totals never suffer floating-point rounding. */
export interface LineItem {
  readonly sku: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
}

/** The order aggregate as the application sees it, independent of how it is stored. */
export interface Order {
  readonly id: string;
  readonly state: OrderState;
  readonly customer: Customer;
  readonly lineItems: readonly LineItem[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
