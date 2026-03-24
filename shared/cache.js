const cache = new Map();
// In-flight promises: prevents thundering-herd duplicate fetches for the same key.
const inflight = new Map();

const DEFAULT_TTL = 60 * 1000; // 60 seconds

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCached(key, value, ttl = DEFAULT_TTL) {
  cache.set(key, { value, timestamp: Date.now(), ttl });
}

export async function cachedFetch(key, fetchFn, ttl = DEFAULT_TTL) {
  const cached = getCached(key);
  if (cached !== null) return cached;

  // If a fetch for this key is already in-flight, wait for it instead of issuing a duplicate.
  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = (async () => {
    try {
      const value = await fetchFn();
      setCached(key, value, ttl);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
