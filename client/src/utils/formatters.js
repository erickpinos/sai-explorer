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
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export function formatPercent(num) {
  if (num === null || num === undefined) return '-';
  return (Number(num) * 100).toFixed(2) + '%';
}

export function formatUSD(num) {
  if (num === null || num === undefined) return '-';
  return '$' + formatNumber(num, 2);
}

export function formatPrice(num) {
  if (num === null || num === undefined) return '-';
  const n = Number(num);
  let decimals;
  if (n >= 1000) decimals = 2;
  else if (n >= 1) decimals = 4;
  else if (n >= 0.01) decimals = 4;
  else if (n >= 0.0001) decimals = 6;
  else decimals = 8;
  return '$' + n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
