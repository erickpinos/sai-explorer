import { formatNumber } from './formatters';

export const getBadgeClass = (status) => {
  if (!status) return 'badge badge-purple';
  const s = status.toLowerCase();
  if (s.includes('liquidat')) return 'badge badge-red';
  if (s.includes('opened')) return 'badge badge-blue';
  if (s.includes('cancel')) return 'badge badge-orange';
  if (s.includes('closed')) return 'badge badge-purple';
  if (s.includes('trigger')) return 'badge badge-yellow';
  return 'badge badge-purple';
};

export const formatTradeTypeBadge = (type) => {
  if (!type) return 'Unknown';
  const s = type.toLowerCase();
  if (s.includes('liquidat')) return 'Liquidated';
  if (s.includes('opened')) return 'Opened';
  if (s.includes('cancel')) return 'Limit Order Cancelled';
  if (s.includes('closed')) return 'Closed';
  if (s.includes('trigger')) return 'Triggered';
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export const formatPnl = (pnl) => {
  if (!pnl || pnl === 0) return '-';
  const sign = pnl > 0 ? '+' : '';
  return `${sign}$${formatNumber(Math.abs(pnl), 2)}`;
};

export const shortenHash = (hash, chars = 4) => {
  if (!hash) return '-';
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
};

export const toUsd = (microAmount, collateralPrice) => {
  const raw = (parseFloat(microAmount) || 0) / 1000000;
  const price = parseFloat(collateralPrice) || 1;
  return raw * price;
};
