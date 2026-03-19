import { useApi } from '../../hooks/useApi';
import { formatNumber } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';

export default function CoinGeckoPricesTable() {
  const { data, loading, error } = useApi('coingecko-prices');

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;

  const prices = data?.prices || [];

  if (prices.length === 0) return <EmptyState message="No historical prices stored yet. Open a vault detail to trigger a fetch." />;

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Coin ID</th>
            <th>Date</th>
            <th style={{ textAlign: 'right' }}>Price (USD)</th>
            <th style={{ textAlign: 'right' }}>Fetched At</th>
          </tr>
        </thead>
        <tbody>
          {prices.map((row) => (
            <tr key={`${row.coin_id}-${row.date}`}>
              <td style={{ fontFamily: 'monospace' }}>{row.coin_id}</td>
              <td>{(() => { const [d, m, y] = row.date.split('-'); return new Date(y, m - 1, d).toLocaleDateString(); })()}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>${formatNumber(row.price_usd, 6)}</td>
              <td style={{ textAlign: 'right', color: '#888', fontSize: '12px' }}>
                {new Date(row.fetched_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
