import { graphql } from '../gql';

export const ORDERS_PAGE_SIZE = 20;

export const ORDERS_QUERY = graphql(`
  query Orders($filter: OrderFilter, $first: Int!, $after: ID) {
    orders(filter: $filter, first: $first, after: $after) {
      nodes {
        id
        state
        createdAt
        customer {
          name
        }
        lineItems {
          sku
          quantity
          unitPriceCents
        }
        assignedEmployee {
          id
          name
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`);
