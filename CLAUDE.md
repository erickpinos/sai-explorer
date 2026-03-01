# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Rules

Do NOT make changes the user didn't ask for. No proactive additions (extra charts, tables, refactors) unless explicitly requested. Ask before expanding scope.

## Workflow Rules

When fixing bugs, always verify the fix is actually deployed/running before declaring success. Check that production/dev server reflects changes, not just that code was edited.

## Debugging

When debugging server startup or connection issues, check environment variables (dotenv installed?), OS compatibility (e.g., reusePort on macOS), and actual error messages before suggesting port changes or restarts.

## API & Data

- Before modifying GraphQL queries, always read the actual schema or test the query first to confirm field names exist. Never guess at field names.
- When fetching paginated API data, always check for pagination from the start. Never assume a single request returns all results.

## Project Overview

Sai Transaction Explorer — a blockchain analytics dashboard for Sai.fun (perpetual trading on Nibiru chain). Indexes on-chain trade, deposit, and withdrawal data from GraphQL into PostgreSQL and serves it via REST API to a React frontend.

## Commands

```bash
# Primary dev workflow (starts Docker Postgres + Express API on :3001 + Vite on :5000)
npm run dev:local

# Individual services
npm run dev:api         # Express API only (port 3001)
npm run dev             # Vite frontend only (requires API running)

# Build (Vite output → client/dist/)
npm run build

# Database
npm run setup-db        # Create/migrate tables (idempotent, safe to re-run)
npm run index-data      # Full historical backfill from GraphQL (slow, 10-30 min)

# Docker (Postgres 16 on port 5433)
npm run docker:up
npm run docker:down

# Client linting (from client/)
cd client && npm run lint
```

## Architecture

### Dual API Handler Pattern (CRITICAL)

Two API directories that **must stay in sync**:

| Directory | Environment | DB Client |
|-----------|------------|-----------|
| `api/` | Vercel serverless (production) | `@vercel/postgres` sql tagged template |
| `api-local/` | Local Express dev server | `pg` Pool from `scripts/db.js` |

**Both must have identical business logic.** When changing any endpoint, update both files. Use `shared/` imports to minimize drift.

### Data Flow

```
Nibiru GraphQL → POST /api/sync (every 5 min) → PostgreSQL → REST API → React Frontend
```

Sync is incremental: reads latest `block_ts`, fetches only newer records. `ON CONFLICT` upserts fill NULL columns only.

### Key Directories

- `api/` — Vercel serverless handlers
- `api-local/` — Local Express handlers (mirrors `api/`)
- `shared/` — Constants, GraphQL client, mappers, price utilities (shared between both API dirs)
- `scripts/` — DB setup, migrations, data indexing, address utilities
- `client/src/` — React 19 + Vite 7 frontend
- `server-local.js` — Express dev server wrapping `api-local/` handlers

### Frontend

React Context for state (`NetworkContext`). No external state library. 7 tabs: Trades, Deposits, Withdraws, Volume, Markets, Collateral, Insights. `useApi()` is the generic data fetching hook; specialized hooks (`useTrades`, `useDeposits`, etc.) wrap it. Client-side sorting via `useSortedData` + `usePagination`.

### Database

PostgreSQL with raw parameterized SQL (no ORM). Main tables: `trades`, `deposits`, `withdraws`, `markets`, `metadata`.

## Key Business Logic

### Volume Calculation
```
ABS(collateral_amount * leverage / 1,000,000 * COALESCE(collateral_price, 1))
```

### USD Conversion
All amounts stored in micro-units. Always multiply by `COALESCE(collateral_price, 1)` for USD:
```sql
collateral_amount / 1000000 * COALESCE(collateral_price, 1)
```

### Excluded Trade Types
`shared/constants.js` defines `EXCLUDED_TRADE_TYPES` and `EXCLUDED_TRADE_TYPES_SQL` — meta events (tp_updated, sl_updated, limit/stop order events) excluded from volume and trade counts. PnL queries use `!= 'position_opened'` instead.

### Dual Address System
Traders have Bech32 (`nibi1...`) in `trader` column and EVM (`0x...`) in `evm_trader`. User queries match on `(trader = $1 OR evm_trader = $1)`. Conversion: `nibiToHex()` in `scripts/addressUtils.js`.

### Active Vaults
TVL calculations filter to `ACTIVE_VAULTS` set in `shared/constants.js` to exclude deprecated vault contracts.

## Environment

`.env.local` for local dev:
```
POSTGRES_URL=postgres://saiexplorer:localdev123@127.0.0.1:5433/sai_explorer
```

Production uses Vercel-injected `POSTGRES_URL`. The `scripts/db.js` reads `POSTGRES_URL ?? DATABASE_URL`.

## Deployment

Vercel serverless. Build runs `npm run setup-db && cd client && npm install && npm run build`. Cron triggers `/api/sync` every 5 minutes (configured in `vercel.json`).