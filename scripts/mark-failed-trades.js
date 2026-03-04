import { pool, query } from './db.js';
import { getFailedTxHashes } from '../shared/evmReceipt.js';

const DB_BATCH_SIZE = 500;

async function markFailedTrades() {
  console.log('Scanning existing trades for failed EVM transactions...');

  const networks = process.argv[2] ? [process.argv[2]] : ['mainnet', 'testnet'];
  for (const network of networks) {
    let offset = 0;
    let totalMarked = 0;

    while (true) {
      const result = await query(`
        SELECT id, evm_tx_hash
        FROM trades
        WHERE network = $1
          AND evm_tx_hash IS NOT NULL
          AND (tx_failed = FALSE OR tx_failed IS NULL)
        ORDER BY id
        LIMIT $2 OFFSET $3
      `, [network, DB_BATCH_SIZE, offset]);

      const trades = result.rows.map(r => ({ id: r.id, evmTxHash: r.evm_tx_hash }));
      if (trades.length === 0) break;

      console.log(`${network}: checking batch at offset ${offset} (${trades.length} trades)...`);

      const failedHashes = await getFailedTxHashes(trades, network);

      if (failedHashes.size > 0) {
        const failedIds = trades
          .filter(t => failedHashes.has(t.evmTxHash))
          .map(t => t.id);

        for (let i = 0; i < failedIds.length; i += 100) {
          const batch = failedIds.slice(i, i + 100);
          const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(', ');
          await pool.query(
            `UPDATE trades SET tx_failed = TRUE WHERE id IN (${placeholders})`,
            batch
          );
        }

        totalMarked += failedIds.length;
        console.log(`${network}: marked ${failedIds.length} failed in this batch`);
      }

      if (trades.length < DB_BATCH_SIZE) break;
      offset += DB_BATCH_SIZE;
    }

    console.log(`${network}: total marked ${totalMarked} trades as failed`);
  }

  console.log('Done!');
  process.exit(0);
}

markFailedTrades().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
