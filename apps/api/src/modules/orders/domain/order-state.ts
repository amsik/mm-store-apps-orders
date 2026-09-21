/**
 * Order lifecycle states. A const object (not a TS `enum`) so its values are plain string literals,
 * assignable to and from Prisma's generated `OrderState` union without casts.
 */
export const OrderState = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETE: 'COMPLETE',
} as const;

export type OrderState = (typeof OrderState)[keyof typeof OrderState];

export const ORDER_STATES: readonly OrderState[] = Object.values(OrderState);

/** The only allowed move out of each state; `null` means the state is final. Mirrors the state diagram one to one. */
export const ORDER_TRANSITIONS: Readonly<Record<OrderState, OrderState | null>> = {
  OPEN: OrderState.IN_PROGRESS,
  IN_PROGRESS: OrderState.COMPLETE,
  COMPLETE: null,
};
