const GRAPHQL_ENDPOINTS = {
  mainnet: 'https://sai-keeper.nibiru.fi/query',
  testnet: 'https://sai-keeper.testnet-2.nibiru.fi/query'
};

// Active (non-deprecated) vault ERC20 addresses
const ACTIVE_VAULTS = new Set([
  '0xE96397b6135240956413031c0B26507eeCCD4B39',
  '0x7275AfFf575aD79da8b245784cE54a203Df954e6',
]);

async function fetchGraphQL(query, network) {
  const endpoint = GRAPHQL_ENDPOINTS[network] || GRAPHQL_ENDPOINTS.mainnet;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

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

    const tokenPrices = {};
    for (const p of rawPrices) {
      const symbol = p.token?.symbol;
      if (symbol) tokenPrices[symbol.toUpperCase()] = parseFloat(p.priceUsd);
    }

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
