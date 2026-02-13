import { query } from './db.js';
import { nibiToHex } from './addressUtils.js';

async function addEvmTraderColumn() {
  console.log('Adding evm_trader column to trades table...');

  try {
    // Add the column
    await query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS evm_trader TEXT');
    console.log('✓ Added evm_trader column');

    // Populate existing rows
    const result = await query('SELECT id, trader FROM trades WHERE evm_trader IS NULL');
    console.log(`Found ${result.rows.length} trades to update`);

    for (const row of result.rows) {
      const evmAddress = nibiToHex(row.trader);
      await query('UPDATE trades SET evm_trader = $1 WHERE id = $2', [evmAddress, row.id]);
    }

    console.log('✓ Populated evm_trader for existing trades');

    // Add index
    await query('CREATE INDEX IF NOT EXISTS idx_trades_evm_trader ON trades(evm_trader)');
    console.log('✓ Created index on evm_trader');

    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addEvmTraderColumn();
