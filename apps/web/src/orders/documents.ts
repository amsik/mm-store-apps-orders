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

export const ORDER_QUERY = graphql(`
  query Order($id: ID!) {
    order(id: $id) {
      ...OrderDetails
    }
    employees {
      id
      name
    }
  }
`);

export const TRANSITION_ORDER_MUTATION = graphql(`
  mutation TransitionOrder($input: TransitionOrderInput!) {
    transitionOrder(input: $input) {
      ...OrderDetails
    }
  }
`);

graphql(`
  fragment OrderDetails on Order {
    id
    state
    createdAt
    updatedAt
    customer {
      name
      email
    }
    lineItems {
      sku
      name
      quantity
      unitPriceCents
    }
    assignedEmployee {
      id
      name
    }
    history {
      from
      to
      at
      employeeId
    }
  }
`);
