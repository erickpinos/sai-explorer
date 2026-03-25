import { sql } from '../shared/db.js';
import { validateNetwork, parsePagination } from '../shared/validateParams.js';
import { checkRateLimit } from '../shared/rateLimit.js';
import { sendServerError } from '../shared/http.js';

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
  if (!checkRateLimit(req, res)) return;

  try {
    const { network = 'mainnet', limit = 1000, offset = 0 } = req.query;
    if (!validateNetwork(network, res)) return;
    const pagination = parsePagination(limit, offset, res);
    if (!pagination) return;

    const result = await sql`
      SELECT
        id, network, depositor, evm_depositor, shares, unlock_epoch, auto_redeem,
        vault_address, collateral_token_symbol
      FROM withdraws
      WHERE network = ${network}
      ORDER BY id DESC
      LIMIT ${pagination.limit}
      OFFSET ${pagination.offset}
    `;

    // Transform to match frontend's expected format
    const withdraws = result.rows.map(row => ({
      id: row.id,
      depositor: row.depositor,
      evmDepositor: row.evm_depositor,
      shares: row.shares,
      unlockEpoch: row.unlock_epoch,
      autoRedeem: row.auto_redeem,
      vault: {
        address: row.vault_address,
        collateralToken: {
          symbol: row.collateral_token_symbol
        }
      }
    }));

    res.status(200).json(withdraws);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch withdraws', error);
  }
}
