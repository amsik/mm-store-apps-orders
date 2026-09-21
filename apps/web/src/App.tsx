import { OrdersList } from './orders/OrdersList';

export function App() {
  return (
    <>
      <header>
        <h1>Store orders</h1>
      </header>
      <main>
        <OrdersList />
      </main>
    </>
  );
}
