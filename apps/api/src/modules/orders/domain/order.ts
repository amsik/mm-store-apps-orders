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

/** Copy of the employee taken when the order is started, so the order reads the same if the employee changes later. */
export interface EmployeeSnapshot {
  readonly id: string;
  readonly name: string;
}

/** One entry of an order's audit trail, appended by every transition. */
export interface StateChange {
  readonly from: OrderState;
  readonly to: OrderState;
  readonly at: Date;
  /** The employee working on the order at that moment. */
  readonly employeeId: string | null;
}

/** The order aggregate as the application sees it, independent of how it is stored. */
export interface Order {
  readonly id: string;
  readonly state: OrderState;
  readonly customer: Customer;
  readonly lineItems: readonly LineItem[];
  /** Set on OPEN → IN_PROGRESS and kept on COMPLETE; `null` while OPEN. */
  readonly assignedEmployee: EmployeeSnapshot | null;
  /** Oldest first. */
  readonly history: readonly StateChange[];
  /** Incremented by every write; transitions only apply to the version they were checked against. */
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
