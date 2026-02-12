import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tradesHandler from './api-local/trades.js';
import depositsHandler from './api-local/deposits.js';
import withdrawsHandler from './api-local/withdraws.js';
import statsHandler from './api-local/stats.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.API_PORT || 3001;

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Local API server running on http://localhost:${PORT}`);
  console.log(`\n📡 API Endpoints:`);
  console.log(`   - Trades:    http://localhost:${PORT}/api/trades?network=mainnet&limit=10`);
  console.log(`   - Deposits:  http://localhost:${PORT}/api/deposits?network=mainnet&limit=10`);
  console.log(`   - Withdraws: http://localhost:${PORT}/api/withdraws?network=mainnet`);
  console.log(`   - Stats:     http://localhost:${PORT}/api/stats?network=mainnet`);
  console.log(`   - Health:    http://localhost:${PORT}/health`);
  console.log(`\n✨ Ready for local development!\n`);
});
