export function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined) return '-';
  return Number(num).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString();
}

export function formatAddress(addr) {
  if (!addr) return '-';
  return addr.slice(0, 12) + '...' + addr.slice(-6);
}

export function formatPercent(num) {
  if (num === null || num === undefined) return '-';
  return (Number(num) * 100).toFixed(2) + '%';
}

export function formatUSD(num) {
  if (num === null || num === undefined) return '-';
  return '$' + formatNumber(num, 2);
}
