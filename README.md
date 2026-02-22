# Sai Transaction Explorer

A blockchain explorer for Sai.fun transactions with real-time data syncing and analytics.

## Features

- Real-time trade, deposit, and withdraw tracking
- Volume analytics and market statistics
- PostgreSQL database for scalable data storage
- Multi-network support (mainnet/testnet)
- Responsive mobile design

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
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

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

npm run setup-db      # create database tables
npm run index-data    # load historical blockchain data

npm run docker:up     # start Postgres container
npm run docker:down   # stop Postgres container
npm run docker:logs   # tail Postgres logs
```

### Environment Variables

`.env.local` (not committed to git):

```
POSTGRES_URL=postgres://saiexplorer:localdev123@127.0.0.1:5433/sai_explorer
```

Port 5433 is used to avoid conflicts with any local Postgres installation (which typically uses 5432).

---

## Project Structure

```
├── server-local.js        # Express API server
├── api-local/             # API route handlers (local dev)
├── api/                   # Serverless function handlers (production)
├── scripts/
│   ├── setup-db.js        # Creates database tables
│   ├── db.js              # Database connection pool
│   └── initial-index.js   # Historical data indexer
├── client/                # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev:local`
5. Submit a pull request
