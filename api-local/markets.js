import { fetchGraphQL } from '../shared/graphql.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { network = 'mainnet' } = req.query;

    const json = await fetchGraphQL(`{
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
    }`, network);

    const rawMarkets = json.data?.perp?.borrowings || [];
    const tokenPrices = json.data?.oracle?.tokenPricesUsd || [];

    const collateralPrices = {};
    for (const tp of tokenPrices) {
      if (tp.token?.symbol) {
        collateralPrices[tp.token.symbol.toLowerCase()] = tp.priceUsd || 1;
      }
    }

    const markets = rawMarkets.map(m => {
      const collSymbol = (m.collateralToken?.symbol || '').toLowerCase();
      const isUsd = collSymbol === 'usdc' || collSymbol === 'usdt';
      const collPrice = isUsd ? 1 : (collateralPrices[collSymbol] || 1);

      return {
        ...m,
        oiLongUsd: (m.oiLong || 0) / 1e6 * collPrice,
        oiShortUsd: (m.oiShort || 0) / 1e6 * collPrice,
        oiMaxUsd: (m.oiMax || 0) / 1e6 * collPrice,
        collateralPrice: collPrice,
      };
    });

    res.status(200).json({ markets });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets', details: error.message });
  }
}
