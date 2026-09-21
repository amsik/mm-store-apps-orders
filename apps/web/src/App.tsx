import { OrderDetails } from './orders/OrderDetails';
import { OrdersList } from './orders/OrdersList';
import { parseRoute, useHash } from './router';

export function App() {
  const route = parseRoute(useHash());

  return (
    <>
      <header>
        <h1>
          <a href="#/">Store orders</a>
        </h1>
      </header>
      <main>
        {route.name === 'order' ? (
          <>
            <p>
              <a href="#/">← All orders</a>
            </p>
            <OrderDetails key={route.id} orderId={route.id} />
          </>
        ) : (
          <OrdersList />
        )}
      </main>
    </>
  );
}
