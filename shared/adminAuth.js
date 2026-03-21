function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
}

function isLoopback(ip) {
  return ip === '127.0.0.1'
    || ip === '::1'
    || ip === '::ffff:127.0.0.1'
    || ip === '';
}

export function requireAdminAccess(req, res) {
  const adminSecret = process.env.CRON_SECRET || process.env.ADMIN_SECRET;
  const authHeader = req.headers.authorization;

  if (adminSecret) {
    if (authHeader !== `Bearer ${adminSecret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return false;
    }
    return true;
  }

  if (process.env.NODE_ENV === 'development' && isLoopback(getClientIp(req))) {
    return true;
  }

  res.status(403).json({ error: 'Admin access is disabled until CRON_SECRET is configured' });
  return false;
}
