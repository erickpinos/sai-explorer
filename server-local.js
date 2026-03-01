import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from './scripts/db.js';
import tradesHandler from './api-local/trades.js';
import depositsHandler from './api-local/deposits.js';
import withdrawsHandler from './api-local/withdraws.js';
import statsHandler from './api-local/stats.js';
import syncHandler from './api-local/sync.js';
import insightsHandler from './api-local/insights.js';
import tvlBreakdownHandler from './api-local/tvl-breakdown.js';
import userStatsHandler from './api-local/user-stats.js';
import userTradesHandler from './api-local/user-trades.js';
import userDepositsHandler from './api-local/user-deposits.js';
import userWithdrawsHandler from './api-local/user-withdraws.js';
import volumeHandler from './api-local/volume.js';
import marketsHandler from './api-local/markets.js';
import collateralHandler from './api-local/collateral.js';
import chartDataHandler from './api-local/chart-data.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Wrap Vercel-style handlers for Express
function wrapHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Handler error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

// API Routes
app.get('/api/trades', wrapHandler(tradesHandler));
app.get('/api/deposits', wrapHandler(depositsHandler));
app.get('/api/withdraws', wrapHandler(withdrawsHandler));
app.get('/api/stats', wrapHandler(statsHandler));
app.get('/api/insights', wrapHandler(insightsHandler));
app.get('/api/tvl-breakdown', wrapHandler(tvlBreakdownHandler));
app.get('/api/volume', wrapHandler(volumeHandler));
app.get('/api/markets', wrapHandler(marketsHandler));
app.get('/api/collateral', wrapHandler(collateralHandler));
app.get('/api/chart-data', wrapHandler(chartDataHandler));
app.post('/api/sync', wrapHandler(syncHandler));

// User-specific routes
app.get('/api/user-stats', wrapHandler(userStatsHandler));
app.get('/api/user-trades', wrapHandler(userTradesHandler));
app.get('/api/user-deposits', wrapHandler(userDepositsHandler));
app.get('/api/user-withdraws', wrapHandler(userWithdrawsHandler));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const clientDist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Preflight: verify Postgres is reachable and tables exist
try {
  await pool.query('SELECT 1');
} catch (err) {
  if (err.code === 'ECONNREFUSED') {
    console.error('\n❌ Cannot connect to Postgres at', process.env.POSTGRES_URL || process.env.DATABASE_URL);
    console.error('   Is Docker running? Try: npm run docker:up\n');
  } else {
    console.error('\n❌ Database connection failed:', err.message, '\n');
  }
  process.exit(1);
}

try {
  await pool.query('SELECT 1 FROM trades LIMIT 1');
} catch (err) {
  if (err.code === '42P01') {
    console.error('\n❌ Database tables not found. Run: npm run setup-db\n');
    process.exit(1);
  }
}

async function autoSync() {
  try {
    console.log('\n🔄 Auto-sync: fetching new data (mainnet + testnet)...');
    const startTime = Date.now();

    const fakeReq = { body: {}, method: 'POST' };
    let result;
    const fakeRes = {
      setHeader: () => {},
      status: (code) => ({
        json: (data) => { result = data; },
        end: () => {}
      })
    };
    await syncHandler(fakeReq, fakeRes);

    const duration = Date.now() - startTime;
    if (result?.success) {
      const m = result.mainnet || {};
      const t = result.testnet || {};
      const mt = (m.trades || 0) + (t.trades || 0);
      const md = (m.deposits || 0) + (t.deposits || 0);
      const mw = (m.withdraws || 0) + (t.withdraws || 0);
      console.log(`✅ Auto-sync complete in ${duration}ms — mainnet: ${m.trades || 0}t/${m.deposits || 0}d/${m.withdraws || 0}w | testnet: ${t.trades || 0}t/${t.deposits || 0}d/${t.withdraws || 0}w`);
    } else {
      console.log(`⚠️ Auto-sync finished in ${duration}ms with issues`);
    }
  } catch (err) {
    console.error('❌ Auto-sync error:', err.message);
  }
}

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 API server running on http://localhost:${PORT}`);
  console.log(`📡 Auto-sync enabled: runs on startup and every 5 minutes`);
  console.log(`\n✨ Ready!\n`);

  autoSync();
  const syncInterval = setInterval(autoSync, SYNC_INTERVAL_MS);

  const shutdown = () => {
    clearInterval(syncInterval);
    server.close();
    pool.end();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
});
