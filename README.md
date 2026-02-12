# Sai Explorer

A blockchain explorer for Sai.fun transactions with real-time data syncing and analytics.

## Features

- 📊 Real-time trade, deposit, and withdraw tracking
- 📈 Volume analytics and market statistics
- 🔄 Auto-sync via Vercel Cron Jobs (every 5 minutes)
- 💾 PostgreSQL database for scalable data storage
- 🌐 Multi-network support (mainnet/testnet)
- 📱 Responsive mobile design

## Architecture

- **Frontend**: React + Vite
- **Backend**: Vercel Serverless Functions (API routes)
- **Database**:
  - Local: Docker Postgres
  - Production: Vercel Postgres
- **Data Sync**: Vercel Cron Jobs

---

## ⚡ Quick Start

```bash
# Clone and install
git clone <your-repo-url>
cd sai-explorer
npm install
cd client && npm install && cd ..

# Start local database (requires Docker Desktop)
npm run docker:up

# Setup database
npm run setup-db

# Optional: Load historical data (takes 10-30 min)
npm run index-data

# Run fullstack app (React + API)
npm run dev:fullstack
```

Open http://localhost:3000

> For detailed setup instructions, see [Local Development Setup](#-local-development-setup) below.

---

## 🏠 Local Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18.0.0
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

> **Note**: Vercel CLI is automatically installed as a dev dependency when you run `npm install` - no global installation needed!

### Step-by-Step Instructions

**1. Clone the repository**

```bash
git clone <your-repo-url>
cd sai-explorer
```

**2. Install Docker Desktop**

Download and install from https://www.docker.com/products/docker-desktop/

Make sure Docker is running before proceeding.

**3. Install dependencies**

```bash
npm install
cd client && npm install && cd ..
```

This installs all dependencies including Vercel CLI.

**4. Start the local Postgres database**

```bash
npm run docker:up
```

This starts a Docker container with PostgreSQL. Verify it's running:

```bash
docker ps
```

You should see `sai-explorer-db` running on port 5433 (mapped from internal port 5432).

**5. Create database tables**

```bash
npm run setup-db
```

This creates all necessary tables:
- `trades` - Trading history
- `deposits` - Deposit transactions
- `withdraws` - Withdrawal requests
- `markets` - Market metadata
- `metadata` - Sync tracking

**6. Load initial data** (optional but recommended)

```bash
npm run index-data
```

⚠️ This takes 10-30 minutes and fetches all historical data from the blockchain.

You can skip this step, but your database will be empty until you manually fetch data or deploy to production where the cron job will sync data.

**7. Start the development server**

```bash
npm run dev:fullstack
```

This runs both the React frontend and API routes using Vercel Dev.

**8. Open in browser**

```
http://localhost:3000
```

The app will automatically reload when you make changes.

### Local Development Commands

```bash
# Start Docker Postgres
npm run docker:up

# Stop Docker Postgres
npm run docker:down

# View Postgres logs
npm run docker:logs

# Setup database schema
npm run setup-db

# Load historical data
npm run index-data

# Run fullstack dev server (React + API routes)
npm run dev:fullstack

# Run React frontend only (no API routes)
npm run dev
```

### Environment Variables (Local)

The `.env.local` file is already created with:

```bash
POSTGRES_URL=postgres://saiexplorer:localdev123@127.0.0.1:5433/sai_explorer
```

This connects to your local Docker Postgres instance. Note: Port 5433 is used to avoid conflicts with local PostgreSQL installations (which typically use 5432).

---

## 🚀 Production Deployment (Vercel)

### Prerequisites

- [Vercel Account](https://vercel.com/signup)

> **Note**: Vercel CLI is already installed as a dev dependency. Use `npx vercel` for all commands.

### Step-by-Step Instructions

**1. Link to Vercel project**

```bash
npx vercel link
```

Follow the prompts to create or link to an existing Vercel project.

**2. Create Vercel Postgres database**

```bash
npx vercel storage create postgres
```

When prompted:
- Database name: `sai-explorer-db`
- Region: Choose closest to your users

This automatically sets environment variables on Vercel:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

**3. Setup production database schema**

Pull the production environment variables and run the setup script:

```bash
npx vercel env pull .env.production
POSTGRES_URL=$(grep POSTGRES_URL .env.production | cut -d '=' -f2-) node scripts/setup-db.js
```

Or manually:

```bash
# Get the POSTGRES_URL from Vercel dashboard
# Then run:
POSTGRES_URL="your-production-postgres-url" node scripts/setup-db.js
```

**4. Load initial data into production**

```bash
POSTGRES_URL=$(grep POSTGRES_URL .env.production | cut -d '=' -f2-) node scripts/initial-index.js
```

⚠️ This takes 10-30 minutes. Make sure it completes successfully.

**5. Deploy to Vercel**

```bash
npx vercel --prod
```

**6. Verify deployment**

After deployment completes:

- **Check API**: Visit `https://your-app.vercel.app/api/trades?network=mainnet&limit=10`
  - Should return JSON array of trades

- **Check Frontend**: Visit `https://your-app.vercel.app`
  - Should display trades/deposits immediately

- **Check Cron Job**:
  - Go to Vercel Dashboard → Your Project → Cron
  - Verify `/api/sync` is scheduled to run every 5 minutes
  - Wait 5-10 minutes and refresh the frontend to see new data

### Production Environment Variables

Set on Vercel automatically when you create the database:

```bash
POSTGRES_URL=<vercel-managed>
POSTGRES_PRISMA_URL=<vercel-managed>
POSTGRES_URL_NON_POOLING=<vercel-managed>
```

Optional - Add cron secret for security:

```bash
vercel env add CRON_SECRET
# Enter a random secret string
```

---

## 🗂️ Project Structure

```
/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── ui/       # Header, Stats, Tabs
│   │   │   ├── tables/   # TradesTable, DepositsTable, etc.
│   │   │   └── charts/   # ActivityChart, VolumeChart
│   │   ├── hooks/        # Custom React hooks
│   │   │   ├── useApi.js       # API fetching hook
│   │   │   ├── useNetwork.jsx  # Network context & hook
│   │   │   ├── useTrades.js
│   │   │   ├── useDeposits.js
│   │   │   └── useStats.js
│   │   ├── App.jsx       # Main app component
│   │   ├── App.css       # All styles
│   │   └── main.jsx      # React entry point
│   ├── package.json      # Frontend dependencies
│   └── vite.config.js    # Vite configuration
├── api/                   # Vercel serverless functions
│   ├── trades.js         # GET /api/trades
│   ├── deposits.js       # GET /api/deposits
│   ├── withdraws.js      # GET /api/withdraws
│   ├── stats.js          # GET /api/stats
│   └── sync.js           # POST /api/sync (cron job)
├── scripts/              # Database utilities
│   ├── setup-db.js       # Create database schema
│   └── initial-index.js  # Backfill historical data
├── docker-compose.yml    # Local Postgres setup
├── vercel.json           # Vercel config + cron jobs
├── package.json          # Root dependencies + scripts
├── .env.local            # Local environment variables
└── .gitignore            # Git ignore rules
```

---

## 🔄 How Data Syncing Works

### Local Development

1. Data is fetched from blockchain GraphQL API
2. Stored in local Docker Postgres database
3. Frontend fetches from local API routes (`/api/trades`, etc.)

### Production

1. **Cron Job** (`/api/sync`) runs every 5 minutes via Vercel Cron
2. Fetches new transactions from blockchain API
3. Inserts into Vercel Postgres database
4. Frontend fetches from production API routes
5. All users see the same up-to-date data

---

## 📊 API Endpoints

### `GET /api/trades`

Fetch trade history.

**Query Parameters:**
- `network` - Network to query (default: `mainnet`)
- `limit` - Max results (default: `1000`)
- `offset` - Pagination offset (default: `0`)

**Example:**
```bash
curl "https://your-app.vercel.app/api/trades?network=mainnet&limit=10"
```

### `GET /api/deposits`

Fetch deposit history.

**Query Parameters:**
- `network` - Network to query (default: `mainnet`)
- `limit` - Max results (default: `1000`)
- `offset` - Pagination offset (default: `0`)

### `GET /api/withdraws`

Fetch withdrawal requests.

**Query Parameters:**
- `network` - Network to query (default: `mainnet`)
- `limit` - Max results (default: `1000`)
- `offset` - Pagination offset (default: `0`)

### `GET /api/stats`

Fetch aggregate statistics.

**Query Parameters:**
- `network` - Network to query (default: `mainnet`)

**Response:**
```json
{
  "network": "mainnet",
  "trades": {
    "total": 12500,
    "volume": 5000000.50
  },
  "deposits": {
    "total": 3200,
    "volume": 1500000.25
  },
  "traders": {
    "unique": 450
  },
  "lastUpdated": "2026-02-11T12:00:00Z"
}
```

### `POST /api/sync`

Background sync job (called by Vercel Cron).

**Authorization:**
- Requires `Authorization: Bearer <CRON_SECRET>` header (production only)

---

## 🛠️ Troubleshooting

### Docker database won't start

> **Note**: Modern Docker Desktop uses `docker compose` (without hyphen). Older versions use `docker-compose` (with hyphen).

```bash
# Stop all containers
docker compose down
# Or for older Docker: docker-compose down

# Remove volumes
docker volume rm sai-explorer_postgres_data

# Start fresh
npm run docker:up
```

### Can't connect to local database

Verify Docker is running:
```bash
docker ps
```

Check `.env.local` has correct connection string:
```bash
POSTGRES_URL=postgres://saiexplorer:localdev123@127.0.0.1:5433/sai_explorer
```

If you have PostgreSQL installed locally, it may conflict with port 5432. That's why we use port 5433 for the Docker container.

### Production deployment shows no data

1. Verify database has data:
```bash
npx vercel postgres execute 'SELECT COUNT(*) FROM trades'
```

2. Check API endpoint returns data:
```bash
curl "https://your-app.vercel.app/api/trades?limit=5"
```

3. Check cron job is running:
- Vercel Dashboard → Your Project → Cron
- Should see executions every 5 minutes

### Cron job not syncing

1. Check cron logs in Vercel Dashboard
2. Verify `CRON_SECRET` env var matches (if set)
3. Manually trigger sync:
```bash
curl -X POST "https://your-app.vercel.app/api/sync" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 📝 Database Schema

### trades table
- Stores all trade transactions
- Primary key: `id` (trade ID)
- Indexed: `network`, `block_ts`, `trader`, `market_id`

### deposits table
- Stores all deposit transactions
- Auto-increment primary key
- Indexed: `network`, `block_ts`, `depositor`
- Unique constraint: `(network, depositor, block_ts, amount)`

### withdraws table
- Stores withdrawal requests
- Auto-increment primary key
- Indexed: `network`, `depositor`
- Unique constraint: `(network, depositor, vault_address, shares, unlock_epoch)`

### markets table
- Stores market metadata as JSONB
- Unique constraint: `(network, market_id)`

### metadata table
- Stores sync state and configuration
- Key-value store for tracking last sync times

---

## 🔐 Security Notes

- `.env.local` is gitignored and contains local credentials only
- Production credentials are managed by Vercel and never committed
- Cron endpoint should use `CRON_SECRET` in production
- API endpoints are read-only (GET) except `/api/sync` (POST)

---

## 📦 Dependencies

### Root
- `@vercel/postgres` - Vercel Postgres SDK
- `vercel` (dev) - Vercel CLI for local development

### Client (React)
- `react` - React library
- `vite` - Build tool and dev server
- `@vitejs/plugin-react` - React plugin for Vite

### Local Development
- Docker Postgres 16 Alpine

---

## 🚧 Future Enhancements

- [ ] User authentication
- [ ] Real-time WebSocket updates
- [ ] Advanced analytics dashboard
- [ ] CSV export functionality
- [ ] API rate limiting
- [ ] Response caching

---

## 📄 License

MIT

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev:fullstack`
5. Submit a pull request

---

## 💬 Support

For issues or questions:
- Open an issue on GitHub
- Check Vercel logs for deployment issues
- Check Docker logs for local database issues: `npm run docker:logs`
