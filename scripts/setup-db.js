import { query } from './db.js';
import { nibiToHex } from './addressUtils.js';

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
        collateral_token_symbol TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ Created trades table');

    await query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS evm_tx_hash TEXT');
    await query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS collateral_price NUMERIC');
    await query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS evm_trader TEXT');
    await query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS market_id INTEGER');
    await query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS base_token_symbol TEXT');
    await query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS collateral_token_symbol TEXT');
    await query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS tx_failed BOOLEAN DEFAULT FALSE');
    await query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS keeper_id INTEGER');
    // keeper_id unique per network — used for ON CONFLICT dedup in sync
    await query(`
      DO $$ BEGIN
        ALTER TABLE trades ADD CONSTRAINT uq_trades_network_keeper_id UNIQUE (network, keeper_id);
      EXCEPTION WHEN duplicate_table THEN NULL;
      END $$
    `);
    // Auto-generate id for new rows so it's independent of keeper history IDs
    await query(`ALTER TABLE trades ALTER COLUMN id SET DEFAULT gen_random_uuid()::text`);
    console.log('✓ Ensured trades columns up to date');

    // Create indexes for trades
    await query('CREATE INDEX IF NOT EXISTS idx_trades_network ON trades(network)');
    await query('CREATE INDEX IF NOT EXISTS idx_trades_block_ts ON trades(network, block_ts DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_trades_trader ON trades(trader)');
    await query('CREATE INDEX IF NOT EXISTS idx_trades_evm_trader ON trades(evm_trader)');
    await query('CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_trades_network_type ON trades(network, trade_change_type)');
    await query('CREATE INDEX IF NOT EXISTS idx_trades_trader_network_ts ON trades(trader, network, block_ts DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_trades_evm_trader_network_ts ON trades(evm_trader, network, block_ts DESC)');
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

    await query('ALTER TABLE deposits ADD COLUMN IF NOT EXISTS evm_tx_hash TEXT');
    await query('ALTER TABLE deposits ADD COLUMN IF NOT EXISTS vault_address TEXT');
    await query('ALTER TABLE deposits ADD COLUMN IF NOT EXISTS collateral_token_symbol TEXT');
    await query('ALTER TABLE deposits ADD COLUMN IF NOT EXISTS vault_tvl NUMERIC');
    await query('ALTER TABLE deposits ADD COLUMN IF NOT EXISTS evm_depositor TEXT');
    console.log('✓ Ensured deposits columns up to date');

    // Backfill evm_depositor for existing deposits
    const nullDeposits = await query(`SELECT DISTINCT depositor FROM deposits WHERE evm_depositor IS NULL`);
    if (nullDeposits.rows.length > 0) {
      await Promise.all(nullDeposits.rows.map(({ depositor }) =>
        query(`UPDATE deposits SET evm_depositor = $1 WHERE depositor = $2 AND evm_depositor IS NULL`, [nibiToHex(depositor), depositor])
      ));
      console.log(`✓ Backfilled evm_depositor for ${nullDeposits.rows.length} depositor(s) in deposits`);
    }

    // Create indexes for deposits
    await query('CREATE INDEX IF NOT EXISTS idx_deposits_network ON deposits(network)');
    await query('CREATE INDEX IF NOT EXISTS idx_deposits_block_ts ON deposits(network, block_ts DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_deposits_depositor ON deposits(depositor)');
    await query('CREATE INDEX IF NOT EXISTS idx_deposits_evm_depositor ON deposits(evm_depositor)');
    await query('CREATE INDEX IF NOT EXISTS idx_deposits_network_depositor ON deposits(network, depositor, block_ts DESC)');
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

    await query('ALTER TABLE withdraws ADD COLUMN IF NOT EXISTS vault_address TEXT');
    await query('ALTER TABLE withdraws ADD COLUMN IF NOT EXISTS collateral_token_symbol TEXT');
    await query('ALTER TABLE withdraws ADD COLUMN IF NOT EXISTS evm_depositor TEXT');
    console.log('✓ Ensured withdraws columns up to date');

    // Backfill evm_depositor for existing withdraws
    const nullWithdraws = await query(`SELECT DISTINCT depositor FROM withdraws WHERE evm_depositor IS NULL`);
    if (nullWithdraws.rows.length > 0) {
      await Promise.all(nullWithdraws.rows.map(({ depositor }) =>
        query(`UPDATE withdraws SET evm_depositor = $1 WHERE depositor = $2 AND evm_depositor IS NULL`, [nibiToHex(depositor), depositor])
      ));
      console.log(`✓ Backfilled evm_depositor for ${nullWithdraws.rows.length} depositor(s) in withdraws`);
    }

    // Create indexes for withdraws
    await query('CREATE INDEX IF NOT EXISTS idx_withdraws_network ON withdraws(network)');
    await query('CREATE INDEX IF NOT EXISTS idx_withdraws_depositor ON withdraws(depositor)');
    await query('CREATE INDEX IF NOT EXISTS idx_withdraws_evm_depositor ON withdraws(evm_depositor)');
    await query('CREATE INDEX IF NOT EXISTS idx_withdraws_network_depositor ON withdraws(network, depositor, unlock_epoch DESC)');
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
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ Created markets table');

    await query('ALTER TABLE markets ADD COLUMN IF NOT EXISTS collateral_token_symbol TEXT');
    await query('ALTER TABLE markets ADD COLUMN IF NOT EXISTS base_token_symbol TEXT');
    console.log('✓ Ensured markets columns up to date');

    // Migrate from simple unique to partial unique indexes (supports multiple collateral tokens per market)
    await query('ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_network_market_id_key');
    await query('DROP INDEX IF EXISTS markets_network_market_id_key');
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS markets_keeper_unique
      ON markets(network, market_id, collateral_token_symbol) WHERE collateral_token_symbol IS NOT NULL`);
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS markets_lcd_unique
      ON markets(network, market_id) WHERE collateral_token_symbol IS NULL`);
    console.log('✓ Ensured markets partial unique indexes');

    // Create metadata table (for tracking sync state)
    await query(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ Created metadata table');

    // Create vault_share_prices table (periodic sync snapshots)
    await query(`
      CREATE TABLE IF NOT EXISTS vault_share_prices (
        id SERIAL PRIMARY KEY,
        network TEXT NOT NULL,
        vault_address TEXT NOT NULL,
        share_price FLOAT NOT NULL,
        recorded_at TIMESTAMPTZ NOT NULL,
        source TEXT NOT NULL DEFAULT 'sync',
        UNIQUE(network, vault_address, recorded_at)
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_vault_share_prices_vault ON vault_share_prices(network, vault_address, recorded_at DESC)');
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_share_prices_daily
      ON vault_share_prices(network, vault_address, DATE_TRUNC('day', recorded_at AT TIME ZONE 'UTC'))`);
    console.log('✓ Created vault_share_prices table');

    // Create coingecko_prices table (persistent historical price cache)
    await query(`
      CREATE TABLE IF NOT EXISTS coingecko_prices (
        coin_id TEXT NOT NULL,
        date TEXT NOT NULL,
        price_usd NUMERIC NOT NULL,
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (coin_id, date)
      )
    `);
    console.log('✓ Created coingecko_prices table');

    // Create market_depth table (±2% CoinGecko depth, refreshed once per day)
    await query(`
      CREATE TABLE IF NOT EXISTS market_depth (
        symbol TEXT NOT NULL PRIMARY KEY,
        coin_id TEXT NOT NULL,
        depth_plus_2_percent_usd NUMERIC,
        depth_minus_2_percent_usd NUMERIC,
        fetched_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ Created market_depth table');

    // Create market_volatility table (organic volatility from CoinGecko, refreshed once per day)
    await query(`
      CREATE TABLE IF NOT EXISTS market_volatility (
        symbol TEXT NOT NULL PRIMARY KEY,
        coin_id TEXT NOT NULL,
        volatility_pct NUMERIC,
        data_points INTEGER,
        avg_interval_sec INTEGER,
        fetched_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ Created market_volatility table');

    console.log('\n✅ Database schema created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();
