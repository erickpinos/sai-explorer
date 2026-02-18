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

## Recent Changes
- Configured for Replit environment (Feb 2026)
- Updated Vite to port 5000 with allowedHosts: true
- Database connection updated to use Replit's DATABASE_URL
- Added static file serving for production deployment
