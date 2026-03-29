/**
 * Unit tests for per-source error handling in /api/markets.
 *
 * Simulates each source (Keeper, LCD, both) failing independently
 * and verifies the `errors` object in the response is correct.
 *
 * Usage:  node unit-tests.js
 */

// ── Helpers ──────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passCount++;
  } else {
    console.log(`  ✗ ${label}`);
    failCount++;
  }
}

/** Minimal Express-like res stub */
function mockRes() {
  const res = {
    _status: null,
    _json: null,
    _headers: {},
    setHeader(k, v) { res._headers[k] = v; return res; },
    status(code)    { res._status = code; return res; },
    json(body)      { res._json = body; return res; },
    end()           { return res; },
  };
  return res;
}

function mockReq(query = {}) {
  return { method: 'GET', query, headers: {}, connection: { remoteAddress: '127.0.0.1' } };
}

// ── Monkey-patching setup ────────────────────────────────────────────

// We dynamically import the handler after patching globals so we can
// control which fetches succeed or fail.

const originalFetch = globalThis.fetch;

// Intercept fetch calls by URL pattern
let fetchInterceptors = {};

globalThis.fetch = async (url, opts) => {
  for (const [pattern, handler] of Object.entries(fetchInterceptors)) {
    if (url.includes(pattern)) {
      return handler(url, opts);
    }
  }
  return originalFetch(url, opts);
};

// ── Tests ────────────────────────────────────────────────────────────

async function test1_keeperFails() {
  console.log('\n── Test 1: Keeper (GraphQL) fails, LCD succeeds ──');

  // Clear module cache so cachedFetch starts fresh
  const { invalidateCache } = await import('./shared/cache.js');
  invalidateCache('markets:mainnet');
  invalidateCache('lcd-tokens:mainnet');

  fetchInterceptors = {
    'sai-keeper': () => { throw new Error('Connect Timeout Error (keeper)'); },
    // LCD goes through normally
  };

  const { default: handler } = await import(`./api/markets.js?t=${Date.now()}`);
  const res = mockRes();
  await handler(mockReq({ network: 'mainnet' }), res);

  assert(res._status === 200, 'returns 200');
  assert(res._json.errors?.Keeper != null, 'errors.Keeper is set');
  assert(res._json.errors?.Calc != null, 'errors.Calc is set (depends on Keeper)');
  assert(res._json.errors?.LCD == null, 'errors.LCD is NOT set');
  assert(res._json.markets.length > 0, 'still returns markets (from LCD + Manual fallback)');

  if (res._json.errors?.Keeper) {
    console.log(`  → Keeper error: "${res._json.errors.Keeper}"`);
  }
  if (res._json.errors?.Calc) {
    console.log(`  → Calc error:   "${res._json.errors.Calc}"`);
  }
}

async function test2_lcdFails() {
  console.log('\n── Test 2: LCD fails, Keeper (GraphQL) succeeds ──');

  const { invalidateCache } = await import('./shared/cache.js');
  invalidateCache('markets:mainnet');
  invalidateCache('lcd-tokens:mainnet');

  fetchInterceptors = {
    'lcd.nibiru.fi': () => { throw new Error('LCD endpoint unreachable'); },
    // Keeper goes through normally
  };

  const { default: handler } = await import(`./api/markets.js?t=${Date.now()}`);
  const res = mockRes();
  await handler(mockReq({ network: 'mainnet' }), res);

  assert(res._status === 200, 'returns 200');
  assert(res._json.errors?.LCD != null, 'errors.LCD is set');
  assert(res._json.errors?.Keeper == null, 'errors.Keeper is NOT set');
  assert(res._json.markets.length > 0, 'still returns markets (from Keeper)');

  // Keeper markets should have symbolSource = 'Keeper'
  const keeperMarket = res._json.markets.find(m => m.symbolSource === 'Keeper');
  assert(keeperMarket != null, 'has Keeper-sourced markets');

  if (res._json.errors?.LCD) {
    console.log(`  → LCD error: "${res._json.errors.LCD}"`);
  }
}

async function test3_bothFail() {
  console.log('\n── Test 3: Both Keeper and LCD fail ──');

  const { invalidateCache } = await import('./shared/cache.js');
  invalidateCache('markets:mainnet');
  invalidateCache('lcd-tokens:mainnet');

  fetchInterceptors = {
    'sai-keeper': () => { throw new Error('Connect Timeout Error (keeper)'); },
    'lcd.nibiru.fi': () => { throw new Error('LCD endpoint unreachable'); },
  };

  const { default: handler } = await import(`./api/markets.js?t=${Date.now()}`);
  const res = mockRes();
  await handler(mockReq({ network: 'mainnet' }), res);

  assert(res._status === 200, 'returns 200');
  assert(res._json.errors?.Keeper != null, 'errors.Keeper is set');
  assert(res._json.errors?.LCD != null, 'errors.LCD is set');
  assert(res._json.errors?.Calc != null, 'errors.Calc is set');

  // Should still have Manual fallback markets from MARKET_METADATA
  const manualMarket = res._json.markets.find(m => m.symbolSource === 'Manual');
  assert(manualMarket != null, 'has Manual-sourced fallback markets');

  if (res._json.errors) {
    console.log(`  → All errors: ${JSON.stringify(res._json.errors, null, 2)}`);
  }
}

async function test4_allSucceed() {
  console.log('\n── Test 4: All sources succeed (no errors) ──');

  const { invalidateCache } = await import('./shared/cache.js');
  invalidateCache('markets:mainnet');
  invalidateCache('lcd-tokens:mainnet');

  // No interceptors — everything goes through
  fetchInterceptors = {};

  const { default: handler } = await import(`./api/markets.js?t=${Date.now()}`);
  const res = mockRes();
  await handler(mockReq({ network: 'mainnet' }), res);

  assert(res._status === 200, 'returns 200');
  assert(res._json.errors == null, 'no errors object in response');
  assert(res._json.markets.length > 0, 'returns markets');

  const keeperMarket = res._json.markets.find(m => m.symbolSource === 'Keeper');
  const lcdMarket = res._json.markets.find(m => m.symbolSource === 'LCD');
  assert(keeperMarket != null, 'has Keeper-sourced markets');
  assert(lcdMarket != null, 'has LCD-sourced markets');

  console.log(`  → ${res._json.markets.length} total markets returned`);
}

// ── Runner ───────────────────────────────────────────────────────────

async function run() {
  console.log('Markets API — per-source error handling tests');
  console.log('=============================================');

  await test1_keeperFails();
  await test2_lcdFails();
  await test3_bothFail();
  await test4_allSucceed();

  console.log(`\n=============================================`);
  console.log(`Results: ${passCount} passed, ${failCount} failed`);

  // Restore
  globalThis.fetch = originalFetch;
  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner error:', err);
  globalThis.fetch = originalFetch;
  process.exit(1);
});
