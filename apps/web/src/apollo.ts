import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import type { OrdersQuery } from './gql/graphql';

type OrderConnection = OrdersQuery['orders'];

export const createCache = () =>
  new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          orders: {
            // One cached list per filter; `first`/`after` only select pages of it.
            keyArgs: ['filter'],
            merge(existing: OrderConnection | undefined, incoming: OrderConnection, { args }) {
              // A request without a cursor (first load, refetch) starts the list over.
              if (!existing || !args?.after) return incoming;
              return { ...incoming, nodes: [...existing.nodes, ...incoming.nodes] };
            },
          },
        },
      },
    },
  });

export const createApolloClient = (uri: string) =>
  new ApolloClient({ link: new HttpLink({ uri }), cache: createCache() });
