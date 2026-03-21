const VALID_NETWORKS = ['mainnet', 'testnet'];
const MAX_LIMIT = 10000;
const VALID_CHART_DAY_VALUES = new Set(['7', '14', '28', 'all']);

export function validateNetwork(network, res) {
  if (!VALID_NETWORKS.includes(network)) {
    res.status(400).json({ error: `Invalid network. Must be one of: ${VALID_NETWORKS.join(', ')}` });
    return false;
  }
  return true;
}

export function parsePagination(limit, offset, res) {
  const parsedLimit = parseInt(limit, 10);
  const parsedOffset = parseInt(offset, 10);

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_LIMIT) {
    res.status(400).json({ error: `Invalid limit. Must be a positive integer up to ${MAX_LIMIT}.` });
    return null;
  }

  if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
    res.status(400).json({ error: 'Invalid offset. Must be a non-negative integer.' });
    return null;
  }

  return { limit: parsedLimit, offset: parsedOffset };
}

export function validateChartDays(days, res) {
  const normalized = String(days ?? '28');
  if (!VALID_CHART_DAY_VALUES.has(normalized)) {
    res.status(400).json({ error: 'Invalid days. Must be one of: 7, 14, 28, all.' });
    return null;
  }
  return normalized;
}
