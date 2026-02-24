import { query } from './db.js';

async function setupDatabase() {
  console.log('Setting up database schema...');

  try {
    // Create trades table
    await query(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        network TEXT NOT NULL DEFAULT 'mainnet',
        trade_change_type TEXT,
        realized_pnl_pct NUMERIC,
        realized_pnl_collateral NUMERIC,
        tx_hash TEXT,
        evm_tx_hash TEXT,
        collateral_price NUMERIC,
        block_height BIGINT,
        block_ts TIMESTAMPTZ NOT NULL,
        trader TEXT NOT NULL,
        evm_trader TEXT,
        trade_type TEXT,
        is_long BOOLEAN,
        is_open BOOLEAN,
        leverage NUMERIC,
        open_price NUMERIC,
        close_price NUMERIC,
        collateral_amount NUMERIC,
        open_collateral_amount NUMERIC,
        tp NUMERIC,
        sl NUMERIC,
        market_id INTEGER,
        base_token_symbol TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ Created trades table');

    // Create indexes for trades
    await query('CREATE INDEX IF NOT EXISTS idx_trades_network ON trades(network)');
    await query('CREATE INDEX IF NOT EXISTS idx_trades_block_ts ON trades(network, block_ts DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_trades_trader ON trades(trader)');
    await query('CREATE INDEX IF NOT EXISTS idx_trades_evm_trader ON trades(evm_trader)');
    await query('CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id)');
    console.log('✓ Created trades indexes');

    // Create deposits table
    await query(`
      CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        network TEXT NOT NULL DEFAULT 'mainnet',
        depositor TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        shares NUMERIC NOT NULL,
        block_height BIGINT,
        block_ts TIMESTAMPTZ NOT NULL,
        tx_hash TEXT,
        evm_tx_hash TEXT,
        vault_address TEXT,
        collateral_token_symbol TEXT,
        vault_tvl NUMERIC,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(network, depositor, block_ts, amount)
      )
    `);
    console.log('✓ Created deposits table');

    // Create indexes for deposits
    await query('CREATE INDEX IF NOT EXISTS idx_deposits_network ON deposits(network)');
    await query('CREATE INDEX IF NOT EXISTS idx_deposits_block_ts ON deposits(network, block_ts DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_deposits_depositor ON deposits(depositor)');
    console.log('✓ Created deposits indexes');

    // Create withdraws table
    await query(`
      CREATE TABLE IF NOT EXISTS withdraws (
        id SERIAL PRIMARY KEY,
        network TEXT NOT NULL DEFAULT 'mainnet',
        depositor TEXT NOT NULL,
        shares NUMERIC NOT NULL,
        unlock_epoch BIGINT,
        auto_redeem BOOLEAN,
        vault_address TEXT,
        collateral_token_symbol TEXT,
        block_ts TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(network, depositor, vault_address, shares, unlock_epoch)
      )
    `);
    console.log('✓ Created withdraws table');

    // Create indexes for withdraws
    await query('CREATE INDEX IF NOT EXISTS idx_withdraws_network ON withdraws(network)');
    await query('CREATE INDEX IF NOT EXISTS idx_withdraws_depositor ON withdraws(depositor)');
    console.log('✓ Created withdraws indexes');

    // Create markets table (for cached market data)
    await query(`
      CREATE TABLE IF NOT EXISTS markets (
        id SERIAL PRIMARY KEY,
        network TEXT NOT NULL DEFAULT 'mainnet',
        market_id INTEGER NOT NULL,
        collateral_token_symbol TEXT,
        base_token_symbol TEXT,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(network, market_id)
      )
    `);
    console.log('✓ Created markets table');

    // Create metadata table (for tracking sync state)
    await query(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ Created metadata table');

    console.log('\n✅ Database schema created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();
