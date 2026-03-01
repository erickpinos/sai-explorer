import { ACTIVE_VAULTS } from '../shared/constants.js';
import { fetchGraphQL } from '../shared/graphql.js';
import { buildPriceMap } from '../shared/buildPriceMap.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { network = 'mainnet' } = req.query;

    const [vaultsRes, pricesRes] = await Promise.all([
      fetchGraphQL(`{
        lp {
          vaults {
            address
            sharesERC20
            tvl
            availableAssets
            collateralToken { symbol }
          }
        }
      }`, network),
      fetchGraphQL(`{
        oracle {
          tokenPricesUsd {
            token { symbol }
            priceUsd
          }
        }
      }`, network),
    ]);

    const rawVaults = vaultsRes.data?.lp?.vaults || [];
    const rawPrices = pricesRes.data?.oracle?.tokenPricesUsd || [];

    const tokenPrices = buildPriceMap(rawPrices);

    const vaults = rawVaults.map(v => {
      const erc20 = v.sharesERC20 || '';
      const token = v.collateralToken?.symbol || '';
      const rawTokens = (v.availableAssets || 0) / 1e6;
      const price = tokenPrices[token.toUpperCase()] ?? 1;
      const tvlUsd = rawTokens * price;
      const deprecated = !ACTIVE_VAULTS.has(erc20);

      return {
        address: erc20 || v.address,
        nibiAddress: v.address,
        token,
        tokens: rawTokens,
        tvl: tvlUsd,
        deprecated,
      };
    }).sort((a, b) => {
      if (a.deprecated !== b.deprecated) return a.deprecated ? 1 : -1;
      return b.tvl - a.tvl;
    });

    const totalActiveTvl = vaults
      .filter(v => !v.deprecated)
      .reduce((sum, v) => sum + v.tvl, 0);

    res.status(200).json({ vaults, totalActiveTvl });
  } catch (error) {
    console.error('Error fetching TVL breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch TVL breakdown', details: error.message });
  }
}
