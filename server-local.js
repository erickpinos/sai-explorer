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

app.listen(PORT, () => {
  console.log(`\n🚀 Local API server running on http://localhost:${PORT}`);
  console.log(`\n📡 API Endpoints:`);
  console.log(`   - Trades:    http://localhost:${PORT}/api/trades?network=mainnet&limit=10`);
  console.log(`   - Deposits:  http://localhost:${PORT}/api/deposits?network=mainnet&limit=10`);
  console.log(`   - Withdraws: http://localhost:${PORT}/api/withdraws?network=mainnet`);
  console.log(`   - Stats:     http://localhost:${PORT}/api/stats?network=mainnet`);
  console.log(`   - Sync:      POST http://localhost:${PORT}/api/sync`);
  console.log(`   - User Stats:     http://localhost:${PORT}/api/user-stats?network=mainnet&address=0x...`);
  console.log(`   - User Trades:    http://localhost:${PORT}/api/user-trades?network=mainnet&address=0x...`);
  console.log(`   - User Deposits:  http://localhost:${PORT}/api/user-deposits?network=mainnet&address=0x...`);
  console.log(`   - User Withdraws: http://localhost:${PORT}/api/user-withdraws?network=mainnet&address=0x...`);
  console.log(`   - Health:    http://localhost:${PORT}/health`);
  console.log(`\n✨ Ready for local development!\n`);
});
