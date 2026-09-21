/**
 * Injection tokens for the abstractions the app depends on. Consumers inject the token and type
 * against the interface; the composition root (module `providers`) decides the concrete binding.
 */
export const APP_CONFIG = Symbol('APP_CONFIG');
export const CLOCK = Symbol('CLOCK');
export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
