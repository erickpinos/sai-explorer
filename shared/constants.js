// Trade change types excluded from volume/trade count calculations.
// These are meta events that don't represent actual position changes.
export const EXCLUDED_TRADE_TYPES = [
  'tp_updated',
  'sl_updated',
  'limit_order_created',
  'limit_order_cancelled',
  'stop_order_created',
  'stop_order_cancelled',
];

// SQL-ready string for use in NOT IN clauses (for pool.query style)
export const EXCLUDED_TRADE_TYPES_SQL = EXCLUDED_TRADE_TYPES
  .map(t => `'${t}'`)
  .join(', ');

// Active (non-deprecated) vault ERC20 addresses
export const ACTIVE_VAULTS = new Set([
  '0xE96397b6135240956413031c0B26507eeCCD4B39',
  '0x7275AfFf575aD79da8b245784cE54a203Df954e6',
]);

export const GRAPHQL_ENDPOINTS = {
  mainnet: 'https://sai-keeper.nibiru.fi/query',
  testnet: 'https://sai-keeper.testnet-2.nibiru.fi/query',
};

export const EVM_RPC_ENDPOINTS = {
  mainnet: 'https://evm-rpc.nibiru.fi',
  testnet: 'https://evm-rpc.testnet-2.nibiru.fi',
};

// Market IDs whose names/tickers are not returned by GraphQL.
// Keyed by marketId. Used to enrich API responses.
export const MARKET_METADATA = {
  mainnet: {
    6:  { ticker: 'dubai',              name: 'Dubai Real Estate' },
    7:  { ticker: 'los-angeles',        name: 'Los Angeles Real Estate' },
    8:  { ticker: 'new-york',           name: 'New York Real Estate' },
    9:  { ticker: 'chicago',            name: 'Chicago Real Estate' },
    10: { ticker: 'washington',         name: 'Washington Real Estate' },
    11: { ticker: 'pittsburgh',         name: 'Pittsburgh Real Estate' },
    12: { ticker: 'miami-beach',        name: 'Miami Beach Real Estate' },
    13: { ticker: 'boston',             name: 'Boston Real Estate' },
    14: { ticker: 'brooklyn',           name: 'Brooklyn Real Estate' },
    15: { ticker: 'austin',             name: 'Austin Real Estate' },
    16: { ticker: 'denver',             name: 'Denver Real Estate' },
    50: { ticker: 'pokemon-card-index', name: 'Pokemon Card Index' },
    51: { ticker: 'watch-index',        name: 'Watch Index (All)' },
    52: { ticker: 'rolex',              name: 'Rolex' },
    53: { ticker: 'patek-phillippe',    name: 'Patek Philippe' },
    54: { ticker: 'audemars-piguet',    name: 'Audemars Piguet' },
    55: { ticker: 'omega',              name: 'Omega' },
    56: { ticker: 'cartier',            name: 'Cartier' },
    57: { ticker: 'breitling',          name: 'Breitling' },
    58: { ticker: 'tudor',              name: 'Tudor' },
  },
  testnet: {
    6:  { ticker: 'dubai',              name: 'Dubai Real Estate' },
    7:  { ticker: 'los-angeles',        name: 'Los Angeles Real Estate' },
    8:  { ticker: 'new-york',           name: 'New York Real Estate' },
    9:  { ticker: 'chicago',            name: 'Chicago Real Estate' },
    10: { ticker: 'washington',         name: 'Washington Real Estate' },
    11: { ticker: 'pittsburgh',         name: 'Pittsburgh Real Estate' },
    12: { ticker: 'miami-beach',        name: 'Miami Beach Real Estate' },
    13: { ticker: 'boston',             name: 'Boston Real Estate' },
    14: { ticker: 'brooklyn',           name: 'Brooklyn Real Estate' },
    15: { ticker: 'austin',             name: 'Austin Real Estate' },
    16: { ticker: 'denver',             name: 'Denver Real Estate' },
    53: { ticker: 'pokemon-card-index', name: 'Pokemon Card Index' },
    79: { ticker: 'watch-index',        name: 'Watch Index (All)' },
    80: { ticker: 'rolex',              name: 'Rolex' },
    81: { ticker: 'patek-phillippe',    name: 'Patek Philippe' },
    82: { ticker: 'audemars-piguet',    name: 'Audemars Piguet' },
    83: { ticker: 'omega',              name: 'Omega' },
    84: { ticker: 'cartier',            name: 'Cartier' },
    85: { ticker: 'breitling',          name: 'Breitling' },
    86: { ticker: 'tudor',              name: 'Tudor' },
  },
};
