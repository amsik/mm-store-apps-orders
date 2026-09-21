import { ApolloProvider } from '@apollo/client/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createApolloClient } from './apollo';
import { App } from './App';
import './styles.css';

const client = createApolloClient(import.meta.env.VITE_API_URL ?? 'http://localhost:3000/graphql');

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </StrictMode>,
);
