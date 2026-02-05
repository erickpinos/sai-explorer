// Sai.fun Transaction Fetcher
// Fetches ALL transactions from Sai Keeper GraphQL API
// Usage: node fetch_all_transactions.js

const fs = require("fs");

// Network selection: pass --network=mainnet|testnet or set env var NETWORK
const argNetwork = process.argv.find(a => a.startsWith('--network='));
const CLI_NETWORK = argNetwork ? argNetwork.split('=')[1] : null;
const NETWORK = CLI_NETWORK || process.env.NETWORK || 'mainnet';

const NETWORK_CONFIG = {
  mainnet: { api: "https://sai-keeper.nibiru.fi/query" },
  testnet: { api: "https://sai-keeper.testnet-2.nibiru.fi/query" }
};

const API_URL = (NETWORK_CONFIG[NETWORK] && NETWORK_CONFIG[NETWORK].api) || NETWORK_CONFIG.mainnet.api;
console.log(`Using network: ${NETWORK}, API: ${API_URL}`);

async function fetchGraphQL(query) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return response.json();
}

async function fetchAllPerpTrades() {
  const query = `{
    perp {
      tradeHistory(limit: 10000, order_desc: true) {
        id
        tradeChangeType
        realizedPnlPct
        realizedPnlCollateral
        txHash
        evmTxHash
        collateralPrice
        block {
          block
          block_ts
        }
        trade {
          id
          trader
          tradeType
          isLong
          isOpen
          leverage
          openPrice
          closePrice
          collateralAmount
          openCollateralAmount
          tp
          sl
        }
      }
    }
  }`;
  return fetchGraphQL(query);
}

async function fetchAllLpDeposits() {
  const query = `{
    lp {
      depositHistory(limit: 10000, order_desc: true) {
        depositor
        amount
        block {
          block
          block_ts
        }
        vault {
          address
          collateralToken {
            symbol
          }
          tvl
        }
      }
    }
  }`;
  return fetchGraphQL(query);
}

async function fetchAllLpWithdrawRequests() {
  const query = `{
    lp {
      withdrawRequests(limit: 10000, order_desc: true) {
        depositor
        shares
        unlockEpoch
        autoRedeem
        vault {
          address
          collateralToken {
            symbol
          }
        }
      }
    }
  }`;
  return fetchGraphQL(query);
}

async function main() {
  console.log("=== FETCHING ALL SAI.FUN TRANSACTIONS ===\n");

  // Fetch all transaction types in parallel
  const [perpTrades, lpDeposits, lpWithdraws] = await Promise.all([
    fetchAllPerpTrades(),
    fetchAllLpDeposits(),
    fetchAllLpWithdrawRequests(),
  ]);

  // Get data arrays
  const trades = perpTrades.data?.perp?.tradeHistory || [];
  const deposits = lpDeposits.data?.lp?.depositHistory || [];
  const withdraws = lpWithdraws.data?.lp?.withdrawRequests || [];

  // Save to JSON files
  fs.writeFileSync(
    "perp_trades.json",
    JSON.stringify(perpTrades, null, 2)
  );
  fs.writeFileSync(
    "lp_deposits.json",
    JSON.stringify(lpDeposits, null, 2)
  );
  fs.writeFileSync(
    "lp_withdraws.json",
    JSON.stringify(lpWithdraws, null, 2)
  );

  // Output summary
  console.log("=== TRANSACTION SUMMARY ===\n");
  console.log(`Perpetual Trades: ${trades.length}`);
  console.log(`LP Deposits: ${deposits.length}`);
  console.log(`LP Withdraw Requests: ${withdraws.length}`);
  console.log(`--------------------------`);
  console.log(`TOTAL TRANSACTIONS: ${trades.length + deposits.length + withdraws.length}`);

  console.log("\n=== FILES SAVED ===");
  console.log("- perp_trades.json");
  console.log("- lp_deposits.json");
  console.log("- lp_withdraws.json");

  // Print sample transactions
  console.log("\n=== SAMPLE PERP TRADES (first 5) ===");
  trades.slice(0, 5).forEach((t, i) => {
    const action = t.tradeChangeType;
    const trader = t.trade?.trader || "unknown";
    const time = t.block?.block_ts;
    const pnl = t.realizedPnlCollateral ? `PnL: ${(t.realizedPnlCollateral / 1e6).toFixed(2)} USD` : "";
    console.log(`${i + 1}. [${action}] by ${trader.slice(0, 20)}... @ ${time} ${pnl}`);
  });

  console.log("\n=== UNIQUE TRADERS ===");
  const uniqueTraders = [...new Set(trades.map(t => t.trade?.trader).filter(Boolean))];
  console.log(`Total unique traders: ${uniqueTraders.length}`);
  uniqueTraders.forEach((trader) => {
    const traderTrades = trades.filter(t => t.trade?.trader === trader);
    console.log(`- ${trader}: ${traderTrades.length} trades`);
  });

  console.log("\n=== UNIQUE LP DEPOSITORS ===");
  const uniqueDepositors = [...new Set(deposits.map(d => d.depositor).filter(Boolean))];
  console.log(`Total unique depositors: ${uniqueDepositors.length}`);
  uniqueDepositors.forEach((depositor) => {
    const depositorDeposits = deposits.filter(d => d.depositor === depositor);
    console.log(`- ${depositor}: ${depositorDeposits.length} deposits`);
  });
}

main().catch(console.error);
