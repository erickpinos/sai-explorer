const cache = new Map();

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
  const value = await fetchFn();
  setCached(key, value, ttl);
  return value;
}
