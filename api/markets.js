import { fetchGraphQL } from '../shared/graphql.js';
import { cachedFetch } from '../shared/cache.js';
import { validateNetwork } from '../shared/validateParams.js';
import { checkRateLimit } from '../shared/rateLimit.js';
import { sendServerError } from '../shared/http.js';
import { MARKET_METADATA } from '../shared/constants.js';
import { fetchLcdTokens, fetchLcdPrice } from '../shared/lcd.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res)) return;

  try {
    const { network = 'mainnet' } = req.query;
    if (!validateNetwork(network, res)) return;

    const errors = {};

    const [json, lcdTokens] = await Promise.all([
      cachedFetch(`markets:${network}`, () => fetchGraphQL(`{
        perp {
          borrowings {
            marketId
            collateralToken { id symbol }
            baseToken { symbol }
            feesPerHourLong
            feesPerHourShort
            oiLong
            oiShort
            oiMax
            price
            priceChangePct24Hrs
            minLeverage
            maxLeverage
            openFeePct
            closeFeePct
            visible
          }
        }
        oracle {
          tokenPricesUsd {
            token { symbol }
            priceUsd
          }
        }
      }`, network)).catch(err => {
        errors.Keeper = err.message || 'Failed to fetch from GraphQL keeper';
        errors.Calc = 'Calculated values unavailable (keeper fetch failed)';
        return { data: { perp: { borrowings: [] }, oracle: { tokenPricesUsd: [] } } };
      }),
      fetchLcdTokens(network).catch(err => {
        errors.LCD = err.message || 'Failed to fetch from LCD';
        return {};
      }),
    ]);

    const rawMarkets = json.data?.perp?.borrowings || [];
    const tokenPrices = json.data?.oracle?.tokenPricesUsd || [];

    const collateralPrices = {};
    for (const tp of tokenPrices) {
      if (tp.token?.symbol) {
        collateralPrices[tp.token.symbol.toLowerCase()] = tp.priceUsd || 1;
      }
    }

    const networkMeta = MARKET_METADATA[network] || {};
    const liveMarketIds = new Set(rawMarkets.map(m => m.marketId));

    const markets = rawMarkets.map(m => {
      const collSymbol = (m.collateralToken?.symbol || '').toLowerCase();
      const isUsd = collSymbol === 'usdc' || collSymbol === 'usdt';
      const collPrice = isUsd ? 1 : (collateralPrices[collSymbol] || 1);

      // Resolve symbol: Keeper > LCD > Manual constant
      let symbolSource = null;
      let enrichedBaseToken = m.baseToken;

      if (m.baseToken?.symbol) {
        symbolSource = 'Keeper';
      } else if (lcdTokens[m.marketId]) {
        enrichedBaseToken = { ...(m.baseToken || {}), symbol: lcdTokens[m.marketId].base };
        symbolSource = 'LCD';
      } else if (networkMeta[m.marketId]) {
        const meta = networkMeta[m.marketId];
        enrichedBaseToken = { ...(m.baseToken || {}), symbol: meta.ticker, name: meta.name };
        symbolSource = 'Manual';
      }

      return {
        ...m,
        baseToken: enrichedBaseToken,
        symbolSource,
        visible: (lcdTokens[m.marketId] || networkMeta[m.marketId]) ? true : m.visible,
        oiLongUsd: m.oiLong != null ? m.oiLong / 1e6 * collPrice : null,
        oiShortUsd: m.oiShort != null ? m.oiShort / 1e6 * collPrice : null,
        oiMaxUsd: m.oiMax != null ? m.oiMax / 1e6 * collPrice : null,
        collateralPrice: collPrice,
      };
    });

    // Append LCD-only markets not in keeper (non-keeper oracle tokens)
    for (const [idStr, token] of Object.entries(lcdTokens)) {
      const id = parseInt(idStr);
      if (liveMarketIds.has(id)) continue;
      // Fetch price from LCD for non-keeper markets
      let price = null;
      try {
        const priceData = await fetchLcdPrice(network, id);
        price = priceData?.price ? parseFloat(priceData.price) : null;
      } catch {}
      markets.push({
        marketId: id,
        baseToken: { symbol: token.base },
        symbolSource: 'LCD',
        collateralToken: null,
        visible: true,
        inactive: true,
        price,
        priceChangePct24Hrs: null,
        oiLong: null, oiShort: null, oiMax: null,
        oiLongUsd: null, oiShortUsd: null, oiMaxUsd: null,
        feesPerHourLong: null, feesPerHourShort: null,
        minLeverage: null, maxLeverage: null,
        openFeePct: null, closeFeePct: null,
        collateralPrice: null,
      });
    }

    // Append Manual-only markets not covered by keeper or LCD
    for (const [idStr, meta] of Object.entries(networkMeta)) {
      const id = parseInt(idStr);
      if (liveMarketIds.has(id) || lcdTokens[id]) continue;
      markets.push({
        marketId: id,
        baseToken: { symbol: meta.ticker, name: meta.name },
        symbolSource: 'Manual',
        collateralToken: null,
        visible: true,
        inactive: true,
        price: null,
        priceChangePct24Hrs: null,
        oiLong: null, oiShort: null, oiMax: null,
        oiLongUsd: null, oiShortUsd: null, oiMaxUsd: null,
        feesPerHourLong: null, feesPerHourShort: null,
        minLeverage: null, maxLeverage: null,
        openFeePct: null, closeFeePct: null,
        collateralPrice: null,
      });
    }

    const hasErrors = Object.keys(errors).length > 0;
    res.status(200).json({ markets, ...(hasErrors ? { errors } : {}) });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch markets', error);
  }
}
