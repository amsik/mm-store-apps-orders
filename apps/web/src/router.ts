import { useSyncExternalStore } from 'react';

// Hash routes keep the app a static bundle (no server rewrites) while every screen stays linkable.
export type Route = { name: 'orders' } | { name: 'order'; id: string };

export const orderHref = (id: string) => `#/orders/${encodeURIComponent(id)}`;

export function parseRoute(hash: string): Route {
  const order = /^#\/orders\/([^/]+)$/.exec(hash);
  if (order?.[1]) return { name: 'order', id: decodeURIComponent(order[1]) };
  return { name: 'orders' };
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
};

export const useHash = () => useSyncExternalStore(subscribe, () => window.location.hash);
