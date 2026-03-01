import { fetchGraphQL } from '../shared/graphql.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { network = 'mainnet' } = req.query;

    const [tokensRes, vaultsRes, marketsRes] = await Promise.all([
      fetchGraphQL(`{ oracle { tokenPricesUsd { token { id symbol name logoUrl } priceUsd } } }`, network),
      fetchGraphQL(`{ lp { vaults { address sharesERC20 availableAssets collateralToken { id symbol } } } }`, network),
      fetchGraphQL(`{ perp { borrowings { marketId collateralToken { id } oiLong oiShort visible } } }`, network),
    ]);

    const tokenPrices = tokensRes.data?.oracle?.tokenPricesUsd || [];
    const vaults = vaultsRes.data?.lp?.vaults || [];
    const markets = marketsRes.data?.perp?.borrowings || [];

    const vaultCollateralIds = new Set(vaults.map(v => v.collateralToken?.id).filter(Boolean));
    const marketCollateralIds = new Set(markets.map(m => m.collateralToken?.id).filter(Boolean));
    const collateralIds = new Set([...vaultCollateralIds, ...marketCollateralIds]);

    const priceMap = {};
    for (const t of tokenPrices) {
      if (t.token?.id != null) priceMap[t.token.id] = parseFloat(t.priceUsd || 0);
    }

    const collateralIndices = tokenPrices
      .filter(t => collateralIds.has(t.token?.id))
      .map(t => {
        const tokenId = t.token.id;
        const price = parseFloat(t.priceUsd || 0);

        const relatedVaults = vaults.filter(v => v.collateralToken?.id === tokenId);
        const vaultTvl = relatedVaults.reduce((sum, v) => {
          return sum + ((v.availableAssets || 0) / 1e6) * price;
        }, 0);

        const relatedMarkets = markets.filter(m => m.collateralToken?.id === tokenId && m.visible !== false);
        const totalOi = relatedMarkets.reduce((sum, m) => {
          return sum + ((m.oiLong || 0) + (m.oiShort || 0)) / 1e6;
        }, 0);

        return {
          tokenId,
          symbol: t.token.symbol || '-',
          name: t.token.name || '-',
          price,
          logoUrl: t.token.logoUrl || null,
          vaultCount: relatedVaults.length,
          vaultTvl,
          marketCount: relatedMarkets.length,
          totalOi,
        };
      })
      .sort((a, b) => (a.tokenId || 0) - (b.tokenId || 0));

    const activeIndices = [...collateralIds].sort((a, b) => a - b);

    res.status(200).json({ collateralIndices, activeIndices });
  } catch (error) {
    console.error('Error fetching collateral indices:', error);
    res.status(500).json({ error: 'Failed to fetch collateral data', details: error.message });
  }
}
