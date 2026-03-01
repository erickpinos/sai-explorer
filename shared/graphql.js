import { GRAPHQL_ENDPOINTS } from './constants.js';

export async function fetchGraphQL(query, network) {
  const endpoint = GRAPHQL_ENDPOINTS[network] || GRAPHQL_ENDPOINTS.mainnet;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}
