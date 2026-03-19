import { EVM_RPC_ENDPOINTS } from './constants.js';

const CHUNK_SIZE = 10;
const CHUNK_DELAY_MS = 200;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkTxStatus(evmTxHash, rpcUrl) {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [evmTxHash],
      }),
    });
    const data = await res.json();
    if (data.result && data.result.status === '0x0') {
      return false; // tx failed
    }
    return true; // success, pending, or not found
  } catch (err) {
    console.warn(`RPC check failed for ${evmTxHash}:`, err.message);
    return true; // fail-open: don't block sync
  }
}

/**
 * Given a list of trade objects from GraphQL, returns a Set of evmTxHash
 * values whose on-chain transactions failed (status 0x0).
 */
export async function getFailedTxHashes(trades, network) {
  const rpcUrl = EVM_RPC_ENDPOINTS[network] || EVM_RPC_ENDPOINTS.mainnet;
  const failed = new Set();

  const withHash = trades.filter(t => t.evmTxHash);
  if (withHash.length === 0) return failed;

  try {
    for (let i = 0; i < withHash.length; i += CHUNK_SIZE) {
      const chunk = withHash.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(
        chunk.map(async (t) => {
          const ok = await checkTxStatus(t.evmTxHash, rpcUrl);
          return { hash: t.evmTxHash, ok };
        })
      );
      for (const { hash, ok } of results) {
        if (!ok) failed.add(hash);
      }
      // Delay between chunks to avoid rate limiting
      if (i + CHUNK_SIZE < withHash.length) {
        await sleep(CHUNK_DELAY_MS);
      }
    }

    if (failed.size > 0) {
      console.log(`Filtered ${failed.size} failed transaction(s) for ${network}`);
    }
  } catch (err) {
    console.error('Error checking tx statuses:', err.message);
    // Return empty set on catastrophic failure — don't block sync
  }

  return failed;
}
