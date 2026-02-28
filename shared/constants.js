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
