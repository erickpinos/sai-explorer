# Sai Transaction Explorer

## Overview
A blockchain explorer for Sai.fun transactions with real-time data syncing and analytics. Tracks perpetual trades, LP deposits, and withdrawals.

## Architecture
- **Frontend**: React + Vite (in `client/` directory), served on port 5000
- **Backend**: Express server (`server-local.js`) on port 3001 (dev), port 5000 (production)
- **Database**: PostgreSQL (Replit built-in)
- **API Handlers**: Located in `api-local/` directory (Express-wrapped Vercel-style handlers)

## Project Structure
```
├── server-local.js        # Express API server
├── api-local/             # API route handlers (local Express versions)
├── api/                   # Vercel serverless function handlers (not used in Replit)
├── client/                # React + Vite frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks (useApi.js)
│   │   └── utils/         # Utility functions
│   └── vite.config.js     # Vite config (port 5000, proxy to backend)
├── scripts/               # Database setup and utility scripts
│   ├── setup-db.js        # Creates database tables
│   ├── db.js              # Database connection pool
│   └── initial-index.js   # Historical data indexer
└── package.json           # Root dependencies (Express, pg, etc.)
```

## Key Configuration
- Frontend dev server: port 5000 (0.0.0.0), proxies `/api` to backend on port 3001
- Backend API server: port 3001 (dev), uses `DATABASE_URL` env var
- Database connection: `scripts/db.js` uses `POSTGRES_URL` or `DATABASE_URL`
- Deployment: Express serves built client from `client/dist/` on port 5000

## Data Notes
- `realized_pnl_pct` in the database is stored as a ratio (e.g., -1 = -100%, 9 = 900%)
- Backend multiplies by 100 before sending to frontend, so frontend displays values directly as percentages
- `realized_pnl_collateral` is stored in micro-units (divide by 1,000,000 for USD)

## Recent Changes
- Fixed percentage display: multiplied realized_pnl_pct by 100 across all insights (Feb 2026)
- Added "Biggest $ Win" and "Biggest $ Loss" insight cards using topWins/topLosses data
- Renamed existing cards to "Biggest % Win" and "Biggest % Loss" for clarity
- Fixed trade_change_type filter consistency (position_opened vs open)
- Configured for Replit environment (Feb 2026)
- Updated Vite to port 5000 with allowedHosts: true
- Database connection updated to use Replit's DATABASE_URL
- Added static file serving for production deployment
