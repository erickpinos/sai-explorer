import { sql } from '../shared/db.js';
import { checkRateLimit, SYNC_MAX } from '../shared/rateLimit.js';

const ALLOWED_TABLES = new Set(['trades', 'deposits', 'withdraws']);

export default async function handler(req, res) {
  if (process.env.VERCEL) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  if (process.env.VERCEL && !checkRateLimit(req, res, SYNC_MAX)) return;

  const { table, network } = req.body || {};

  if (!table || !ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Invalid table. Must be one of: trades, deposits, withdraws' });
  }

  const validNetworks = new Set(['mainnet', 'testnet']);
  const byNetwork = network && validNetworks.has(network);

  try {
    let result;
    if (byNetwork) {
      if (table === 'trades') {
        result = await sql`DELETE FROM trades WHERE network = ${network} RETURNING id`;
      } else if (table === 'deposits') {
        result = await sql`DELETE FROM deposits WHERE network = ${network} RETURNING id`;
      } else {
        result = await sql`DELETE FROM withdraws WHERE network = ${network} RETURNING id`;
      }
    } else {
      if (table === 'trades') {
        result = await sql`DELETE FROM trades RETURNING id`;
      } else if (table === 'deposits') {
        result = await sql`DELETE FROM deposits RETURNING id`;
      } else {
        result = await sql`DELETE FROM withdraws RETURNING id`;
      }
    }

    const deleted = result.rows.length;
    console.log(`Cleared ${deleted} rows from ${table}${byNetwork ? ` (${network})` : ''}`);
    res.status(200).json({ success: true, table, network: network || 'all', deleted });
  } catch (error) {
    console.error('Clear error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
