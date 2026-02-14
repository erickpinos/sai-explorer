import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { network = 'mainnet', limit = 1000, offset = 0 } = req.query;

    const result = await sql`
      SELECT
        id, network, depositor, amount, shares,
        block_height, block_ts, tx_hash, evm_tx_hash,
        vault_address, collateral_token_symbol, vault_tvl
      FROM deposits
      WHERE network = ${network}
      ORDER BY block_ts DESC
      LIMIT ${parseInt(limit)}
      OFFSET ${parseInt(offset)}
    `;

    // Transform to match frontend's expected format
    const deposits = result.rows.map(row => ({
      id: row.id,
      depositor: row.depositor,
      amount: row.amount,
      shares: row.shares,
      txHash: row.tx_hash,
      evmTxHash: row.evm_tx_hash,
      block: {
        block: row.block_height,
        block_ts: row.block_ts
      },
      vault: {
        address: row.vault_address,
        collateralToken: {
          symbol: row.collateral_token_symbol
        },
        tvl: row.vault_tvl
      }
    }));

    res.status(200).json(deposits);
  } catch (error) {
    console.error('Error fetching deposits:', error);
    res.status(500).json({ error: 'Failed to fetch deposits', details: error.message });
  }
}
