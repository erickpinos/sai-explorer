#!/bin/bash

# Sai.fun Transaction Fetcher
# Fetches all transactions from Sai Keeper GraphQL API
# Endpoint: https://sai-keeper.nibiru.fi/query

# Allow selecting network via first arg or env var NETWORK (mainnet|testnet)
NETWORK_ARG="$1"
NETWORK=${NETWORK_ARG:-${NETWORK:-mainnet}}
if [ "$NETWORK" = "testnet" ]; then
  API_URL="https://sai-keeper.testnet-2.nibiru.fi/query"
else
  API_URL="https://sai-keeper.nibiru.fi/query"
fi
echo "Using network: $NETWORK -> $API_URL"

echo "=== SAI.FUN TRANSACTION HISTORY ==="
echo ""

# Fetch all perp trade history (position opens, closes, liquidations, etc.)
echo "PERPETUAL TRADE HISTORY"
echo "=========================="
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ perp { tradeHistory(limit: 1000, order_desc: true) { id tradeChangeType realizedPnlPct realizedPnlCollateral txHash evmTxHash collateralPrice block { block block_ts } trade { id trader tradeType isLong isOpen leverage openPrice closePrice collateralAmount openCollateralAmount tp sl perpBorrowing { marketId collateralToken { symbol } baseToken { symbol } quoteToken { symbol } } } } } }"
  }' | jq '.'

echo ""
echo "LP DEPOSIT HISTORY"
echo "====================="
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ lp { depositHistory(limit: 1000, order_desc: true) { depositor amount block { block block_ts } vault { address collateralToken { symbol } tvl } } } }"
  }' | jq '.'

echo ""
echo "LP WITHDRAW REQUESTS"
echo "======================="
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ lp { withdrawRequests(limit: 1000, order_desc: true) { depositor shares unlockEpoch autoRedeem vault { address collateralToken { symbol } } } } }"
  }' | jq '.'

echo ""
echo "=== FETCH COMPLETE ==="
