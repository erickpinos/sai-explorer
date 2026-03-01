export function buildPriceMap(tokenPricesUsd) {
  const prices = {};
  for (const p of tokenPricesUsd || []) {
    if (p.token?.symbol) prices[p.token.symbol.toUpperCase()] = parseFloat(p.priceUsd);
  }
  return prices;
}
