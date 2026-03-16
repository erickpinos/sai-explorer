// In-memory sliding window rate limiter.
// Works in both Express (local dev) and Vercel serverless (per-instance protection).

const WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX = 60;      // requests per window per IP
const SYNC_MAX = 10;         // stricter limit for /api/sync

// Map of IP -> array of request timestamps within the current window
const requests = new Map();
let lastCleanup = Date.now();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function cleanup() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, timestamps] of requests) {
    const filtered = timestamps.filter(t => t > cutoff);
    if (filtered.length === 0) {
      requests.delete(ip);
    } else {
      requests.set(ip, filtered);
    }
  }
}

/**
 * Check rate limit for an incoming request.
 * Returns true if the request is allowed, false if rate-limited (also sends 429).
 */
export function checkRateLimit(req, res, maxRequests = DEFAULT_MAX) {
  const now = Date.now();

  // Periodic cleanup to avoid unbounded memory growth
  if (now - lastCleanup > WINDOW_MS) {
    cleanup();
    lastCleanup = now;
  }

  const ip = getClientIp(req);
  const cutoff = now - WINDOW_MS;
  const timestamps = (requests.get(ip) || []).filter(t => t > cutoff);

  res.setHeader('X-RateLimit-Limit', maxRequests);

  if (timestamps.length >= maxRequests) {
    const retryAfter = Math.ceil((timestamps[0] + WINDOW_MS - now) / 1000);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({ error: 'Too many requests', retryAfter });
    return false;
  }

  timestamps.push(now);
  requests.set(ip, timestamps);
  res.setHeader('X-RateLimit-Remaining', maxRequests - timestamps.length);
  return true;
}

/**
 * Express middleware factory. Uses SYNC_MAX for /sync, DEFAULT_MAX for everything else.
 */
export function rateLimitMiddleware() {
  return (req, res, next) => {
    const maxRequests = req.path === '/sync' ? SYNC_MAX : DEFAULT_MAX;
    if (checkRateLimit(req, res, maxRequests)) {
      next();
    }
  };
}

export { SYNC_MAX, DEFAULT_MAX };
