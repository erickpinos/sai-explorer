import { GRAPHQL_ENDPOINTS } from './constants.js';

export async function fetchGraphQL(query, network) {
  const endpoint = GRAPHQL_ENDPOINTS[network] || GRAPHQL_ENDPOINTS.mainnet;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL HTTP error: ${res.status} ${res.statusText} from ${endpoint}`);
  }
  const json = await res.json();
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors));
  }
  return json;
}
