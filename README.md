# Sai Transaction Explorer

Sai Explorer is a blockchain analytics dashboard for Sai.fun, a perpetual trading platform on Nibiru chain. It indexes on-chain trade, deposit, and withdrawal data into a Postgres database and serves it through a React frontend.

## Features

- Real-time trade, deposit, and withdraw tracking
- Volume analytics and market statistics
- PostgreSQL database for scalable data storage
- Multi-network support (mainnet/testnet)
- Responsive mobile design with card layout on small screens
- Cancelled limit orders detected and labelled separately from closed trades
- Close price displayed as `-` when not recorded (e.g. keeper-executed or cancelled orders)

## Architecture

- **Frontend**: React + Vite
- **Backend**: Express API server (`server-local.js`)
- **Database**: Docker Postgres (local), Postgres (production)

---

## Quick Start

```bash
# Clone and install
git clone <your-repo-url>
cd sai-explorer
npm install
cd client && npm install && cd ..

# Start local database (requires Docker Desktop)
npm run docker:up

# Setup database tables
npm run setup-db

# Optional: load historical data (takes 10-30 min)
npm run index-data

# Start the app
npm run dev:local
```

Open http://localhost:5173

---

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18.0.0
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac/Linux) or [PostgreSQL 16+](https://www.postgresql.org/download/windows/) (Windows)

### Step-by-Step

**1. Clone and install**

```bash
git clone <your-repo-url>
cd sai-explorer
npm install
cd client && npm install && cd ..
```

**2. Open Docker Desktop**

Make sure it's running before proceeding (`docker ps` should work without errors).

**3. Start the local Postgres database**

```bash
npm run docker:up
```

Verify it's running — you should see `sai-explorer-db` on port 5433:

```bash
docker ps
```

**4. Create database tables**

```bash
npm run setup-db
```

**5. Load initial data** (optional but recommended)

```bash
npm run index-data
```

This takes 10-30 minutes and fetches all historical data from the blockchain. Skip it and the app will start with an empty database.

**6. Start the dev server**

```bash
npm run dev:local
```

This starts the Express API (port 3001) and Vite frontend automatically. Docker is checked on startup — if it's not running you'll get a clear error.

**7. Open in browser**

```
http://localhost:5173
```

### Commands

```bash
npm run dev:local     # start Express API + Vite frontend
npm run dev:api       # start Express API only
npm run dev           # start Vite frontend only
npm run build         # build frontend to client/dist/
npm run preview       # serve built frontend (port 4173)

npm run setup-db      # create database tables
npm run index-data    # load historical blockchain data

npm run docker:up     # start Postgres container
npm run docker:down   # stop Postgres container
npm run docker:logs   # tail Postgres logs
```

### Test a production build locally (Mac)

Run all commands from the **project root** (not `client/`):

```bash
# 1. Make sure Docker + DB are running
npm run docker:up

# 2. Build the frontend
npm run build

# 3. Start the API server (serves the built client on port 3001)
npm run dev:api
```

Open http://localhost:3001

### Environment Variables

`.env.local` (not committed to git):

```
POSTGRES_URL=postgres://saiexplorer:localdev123@127.0.0.1:5433/sai_explorer
```

Port 5433 is used to avoid conflicts with any local Postgres installation (which typically uses 5432).

### Windows Setup

Docker Desktop requires virtualization which may not be available. Use a local PostgreSQL installation instead.

**1. Install PostgreSQL**

Download and install [PostgreSQL 16+](https://www.postgresql.org/download/windows/) via the EDB installer. It includes pgAdmin 4 (a browser-based UI).

**2. Create the database**

Open pgAdmin 4 from the Start menu, connect to your local server, then:

- Right-click **Login/Group Roles** → Create → Login/Group Role
  - Name: `saiexplorer`
  - Definition tab → Password: `localdev123`
  - Privileges tab → enable **Can login?**
  - Save
- Right-click **Databases** → Create → Database
  - Name: `sai_explorer`, Owner: `saiexplorer`
  - Save

**3. Set environment variable**

Create `.env.local` in the project root:

```
POSTGRES_URL=postgres://saiexplorer:localdev123@127.0.0.1:5432/sai_explorer
```

Note: local PostgreSQL uses port `5432` (not `5433`).

**4. Set up tables and start**

```bash
npm run setup-db
npm run index-data   # optional, 10-30 min
```

**5. Start the dev servers**

`npm run dev:local` uses `sh` and won't work on Windows. Run the two services separately:

```bash
# Terminal 1
npm run dev:api

# Terminal 2 (once API is running)
npm run dev
```

Open http://localhost:5000

---

## How It Works

### Data Flow

```
Nibiru Chain (GraphQL) → Sync Engine → PostgreSQL → REST API → React Frontend
```

1. **Sync** — The sync engine polls `sai-keeper.nibiru.fi` (GraphQL) to fetch trade history, deposits, and withdrawals. It does incremental sync, only fetching records newer than the last stored timestamp. Runs on startup and every 5 minutes locally, or via Vercel cron in production.

2. **PostgreSQL** — Stores trades (opens, closes, liquidations, TP/SL updates, limit orders), LP deposits, withdrawal requests, and sync metadata.

3. **REST API** — 15 endpoints serve aggregated data. Most query the database; markets and collateral data are fetched live from GraphQL.

4. **React Frontend** — A tab-based SPA with 7 views: Trades, Deposits, Withdraws, Volume (User Stats), Markets, Collateral, and Insights.

### Key Concepts

- **Dual addresses**: Every trader has a Bech32 (`nibi1...`) and EVM (`0x...`) address. The sync engine converts between them using `scripts/addressUtils.js`.
- **Volume formula**: `ABS(collateral_amount × leverage / 1,000,000 × collateral_price)`. Excludes meta events (TP/SL updates, limit/stop order creation/cancellation). Canonical list defined in `shared/constants.js`.
- **Network toggle**: Supports mainnet and testnet via React Context.
- **Two API directories**: `api/` uses `@neondatabase/serverless` via `shared/db.js` for serverless deployment; `api-local/` uses `pg` Pool for the local Express server. Both must have identical business logic. Shared constants (excluded trade types, active vaults, GraphQL endpoints) live in `shared/constants.js`.

### API Endpoints

| Endpoint | Description | Data Source |
|---|---|---|
| `GET /api/trades` | Perpetual trade history | DB |
| `GET /api/deposits` | LP deposit history | DB |
| `GET /api/withdraws` | Withdrawal requests | DB |
| `GET /api/stats` | Platform totals (volume, TVL, trader count) | DB + GraphQL |
| `GET /api/volume` | Per-user volume rankings | DB |
| `GET /api/insights` | Analytics (biggest wins/losses, liquidation rates) | DB |
| `GET /api/chart-data` | Daily activity and volume | DB |
| `GET /api/tvl-breakdown` | TVL by vault | GraphQL |
| `GET /api/markets` | Market data (prices, OI, fees, funding) | GraphQL |
| `GET /api/collateral` | Collateral indices and vault data | GraphQL |
| `GET /api/user-stats` | Individual user statistics | DB |
| `GET /api/user-trades` | Individual user trade history | DB |
| `GET /api/user-deposits` | Individual user deposits | DB |
| `GET /api/user-withdraws` | Individual user withdrawals | DB |
| `POST /api/sync` | Trigger data sync from blockchain | GraphQL → DB |

All `GET` endpoints accept `?network=mainnet|testnet`. User endpoints also require `?address=...`.

---

## Project Structure

```
├── server-local.js        # Express API server
├── api-local/             # API route handlers (local dev)
├── api/                   # Serverless function handlers (production)
├── shared/
│   └── constants.js       # Shared constants (excluded trade types, active vaults, endpoints)
├── scripts/
│   ├── setup-db.js        # Creates database tables
│   ├── db.js              # Database connection pool
│   ├── addressUtils.js    # Bech32 ↔ EVM address conversion
│   └── initial-index.js   # Historical data indexer
├── client/                # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── tables/    # TradesTable, DepositsTable, VolumeTable, etc.
│   │   │   ├── charts/    # ActivityChart, VolumeChart
│   │   │   ├── modals/    # UserProfileModal, TradeDetailModal
│   │   │   └── ui/        # Header, Tabs, Stats, FunFacts
│   │   ├── hooks/         # useApi, useNetwork
│   │   └── utils/         # formatters, constants
│   └── vite.config.js
├── docker-compose.yml     # Local Postgres
└── .env.local             # Local env vars (not committed)
```

---

## Troubleshooting

### Docker won't start

```bash
docker compose down
docker volume rm sai-explorer_postgres_data
npm run docker:up
```

### Can't connect to database

Verify Docker is running: `docker ps`

Check `.env.local`:
```
POSTGRES_URL=postgres://saiexplorer:localdev123@127.0.0.1:5433/sai_explorer
```

### Database tables missing

```bash
npm run setup-db
```

---

## Database Schema

- **trades** — trading history, indexed on `network`, `block_ts`, `trader`, `market_id`
- **deposits** — deposit transactions, indexed on `network`, `block_ts`, `depositor`
- **withdraws** — withdrawal requests, indexed on `network`, `depositor`
- **markets** — market metadata (JSONB)
- **metadata** — sync state key-value store

---

## Vercel

### Linking the project locally

```bash
vercel link
```

### Fresh Vercel deployment

After deploying to Vercel for the first time (or after wiping the database), the production DB will be empty. The cron job syncs incrementally and is capped at 1,000 records per run — it will never backfill historical data on its own.

**Step 1 — Create the database tables**

```bash
vercel env pull .env.vercel.local
set -a && source .env.vercel.local && set +a && node scripts/setup-db.js
rm .env.vercel.local
```

**Step 2 — Run the full historical backfill** (10–30 min)

```bash
vercel env pull .env.vercel.local
set -a && source .env.vercel.local && set +a && node scripts/initial-index.js
rm .env.vercel.local
```

This is equivalent to `npm run index-data` but pointed at the production database instead of the local one. After it finishes, the cron job takes over for incremental updates.

> `setup-db` uses `CREATE TABLE IF NOT EXISTS` — it never drops data, so it's safe to re-run on a populated database.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev:local`
5. Submit a pull request
