import { cachedFetch } from './cache.js';

const LCD_ENDPOINTS = {
  mainnet: 'https://lcd.nibiru.fi',
  testnet: 'https://lcd.testnet-2.nibiru.fi',
};

const ORACLE_CONTRACTS = {
  mainnet: 'nibi1xfwyfwtdame6645lgcs4xvf4u0hpsuvxrcelfwtztu0pv7n4l6hqw5a8gj',
  testnet: 'nibi1mqlrsvfhm5vzsz0wxr6mh8pzxzpz6dd4g7nuyycjf6gy5zc53fvq3lq2fz',
};

const LCD_TTL = 5 * 60 * 1000; // 5 minutes

function smartQuery(lcd, contract, query) {
  const encoded = Buffer.from(JSON.stringify(query)).toString('base64');
  return fetch(`${lcd}/cosmwasm/wasm/v1/contract/${contract}/smart/${encoded}`)
    .then(r => r.json());
}

/**
 * Fetch all tokens from the LCD oracle contract (paginated).
 * Returns a map: tokenId → { base, permissionGroup }
 */
export async function fetchLcdTokens(network = 'mainnet') {
  const lcd = LCD_ENDPOINTS[network] || LCD_ENDPOINTS.mainnet;
  const contract = ORACLE_CONTRACTS[network] || ORACLE_CONTRACTS.mainnet;

  return cachedFetch(`lcd-tokens:${network}`, async () => {
    const map = {};
    let startAfter = 0;
    while (true) {
      const query = startAfter
        ? { list_tokens: { start_after: startAfter } }
        : { list_tokens: {} };
      const res = await smartQuery(lcd, contract, query);
      const tokens = res.data?.tokens || [];
      if (!tokens.length) break;
      for (const t of tokens) {
        map[t.id] = { base: t.base, permissionGroup: t.permission_group };
      }
      startAfter = tokens[tokens.length - 1].id;
    }
    return map;
  }, LCD_TTL);
}

/**
 * Fetch the price for a single token ID from the LCD oracle.
 */
export async function fetchLcdPrice(network, tokenId) {
  const lcd = LCD_ENDPOINTS[network] || LCD_ENDPOINTS.mainnet;
  const contract = ORACLE_CONTRACTS[network] || ORACLE_CONTRACTS.mainnet;
  const res = await smartQuery(lcd, contract, { get_price: { index: tokenId } });
  return res.data || null;
}
