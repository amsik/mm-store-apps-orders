import { CreateOrderForm } from './orders/CreateOrderForm';
import { OrderDetails } from './orders/OrderDetails';
import { OrdersList } from './orders/OrdersList';
import { orderHref, parseRoute, useHash } from './router';

export function App() {
  const route = parseRoute(useHash());

  return (
    <>
      <header>
        <h1>
          <a href="#/">Store orders</a>
        </h1>
        <nav>
          <a href="#/">Orders</a> · <a href="#/new">New order</a>
        </nav>
      </header>
      <main>
        {route.name === 'orders' && <OrdersList />}
        {route.name === 'new' && (
          <CreateOrderForm
            onCreated={(id) => {
              window.location.hash = orderHref(id);
            }}
          />
        )}
        {route.name === 'order' && (
          <>
            <p>
              <a href="#/">← All orders</a>
            </p>
            <OrderDetails key={route.id} orderId={route.id} />
          </>
        )}
      </main>
    </>
  );
}
