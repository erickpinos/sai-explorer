import { useState, useMemo } from 'react';
import { useMarkets } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatPrice } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';

const SORT_KEYS = {
  marketId:     (m) => m.marketId ?? 0,
  symbol:       (m) => m.baseToken?.symbol || '',
  price:        (m) => m.price || 0,
  priceChange:  (m) => m.priceChangePct24Hrs || 0,
  oiLong:       (m) => m.oiLong || 0,
  oiShort:      (m) => m.oiShort || 0,
  oiMax:        (m) => m.oiMax || 0,
  openFee:      (m) => m.openFeePct || 0,
  closeFee:     (m) => m.closeFeePct || 0,
  fundingLong:  (m) => m.feesPerHourLong || 0,
  fundingShort: (m) => m.feesPerHourShort || 0,
};

export default function MarketsTable() {
  const { network } = useNetwork();
  const { data, loading, error } = useMarkets(network);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (col) => {
    if (col === sortCol) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const markets = (data?.markets || []).filter(m => m.visible !== false);
    if (!sortCol) {
      return [...markets].sort((a, b) => (b.oiLong + b.oiShort) - (a.oiLong + a.oiShort));
    }
    const getter = SORT_KEYS[sortCol];
    return [...markets].sort((a, b) => {
      const aVal = getter(a);
      const bVal = getter(b);
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortCol, sortDir]);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!sorted.length) return <EmptyState message="No markets found" />;

  const SortTh = ({ col, children }) => {
    const active = col === sortCol;
    return (
      <th
        className={`sortable${active ? ' sorted' : ''}`}
        onClick={() => handleSort(col)}
      >
        {children} <span className="sort-icon">{active ? (sortDir === 'desc' ? '▼' : '▲') : '▼'}</span>
      </th>
    );
  };

  return (
    <div>
      <div className="table-info">{sorted.length} markets</div>
      <div className="table-wrapper profile-table-desktop">
        <table>
          <thead>
            <tr>
              <SortTh col="marketId">Market ID</SortTh>
              <SortTh col="symbol">Market</SortTh>
              <SortTh col="price">Price</SortTh>
              <SortTh col="priceChange">24h Change</SortTh>
              <SortTh col="oiLong">OI Long</SortTh>
              <SortTh col="oiShort">OI Short</SortTh>
              <SortTh col="oiMax">Max OI</SortTh>
              <th>Leverage</th>
              <SortTh col="openFee">Open Fee</SortTh>
              <SortTh col="closeFee">Close Fee</SortTh>
              <SortTh col="fundingLong">Funding Long</SortTh>
              <SortTh col="fundingShort">Funding Short</SortTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => {
              const symbol = m.baseToken?.symbol || (m.marketId != null ? String(m.marketId) : '-');
              const priceChange = m.priceChangePct24Hrs || 0;
              const changeClass = priceChange >= 0 ? 'pnl-positive' : 'pnl-negative';
              const changeSign = priceChange >= 0 ? '+' : '';
              return (
                <tr key={i}>
                  <td><strong>{m.marketId != null ? m.marketId : '-'}</strong></td>
                  <td><strong>{symbol}</strong></td>
                  <td>{formatPrice(m.price || 0)}</td>
                  <td className={changeClass}>{changeSign}{formatNumber(priceChange, 2)}%</td>
                  <td>${formatNumber((m.oiLong || 0) / 1e6, 2)}</td>
                  <td>${formatNumber((m.oiShort || 0) / 1e6, 2)}</td>
                  <td>${formatNumber((m.oiMax || 0) / 1e6, 2)}</td>
                  <td>{m.minLeverage || 1}x - {m.maxLeverage || 100}x</td>
                  <td>{formatNumber((m.openFeePct || 0) * 100, 3)}%</td>
                  <td>{formatNumber((m.closeFeePct || 0) * 100, 3)}%</td>
                  <td>{formatNumber((m.feesPerHourLong || 0) * 100, 4)}%/hr</td>
                  <td>{formatNumber((m.feesPerHourShort || 0) * 100, 4)}%/hr</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="profile-cards-mobile">
        {sorted.map((m, i) => {
          const symbol = m.baseToken?.symbol || (m.marketId != null ? String(m.marketId) : '-');
          const priceChange = m.priceChangePct24Hrs || 0;
          const changeClass = priceChange >= 0 ? 'pnl-positive' : 'pnl-negative';
          const changeSign = priceChange >= 0 ? '+' : '';
          return (
            <div key={i} className="profile-card">
              <div className="profile-card-header">
                <div className="profile-card-badges">
                  <span className="profile-card-market">{symbol}</span>
                  <span className="profile-card-time" style={{ fontSize: '12px', color: '#888' }}>ID {m.marketId}</span>
                </div>
                <span className={changeClass}>{changeSign}{formatNumber(priceChange, 2)}%</span>
              </div>
              <div className="profile-card-row">
                <span className="profile-card-label">Price</span>
                <span className="profile-card-value">{formatPrice(m.price || 0)}</span>
                <span className="profile-card-label">Leverage</span>
                <span className="profile-card-value">{m.minLeverage || 1}x-{m.maxLeverage || 100}x</span>
              </div>
              <div className="profile-card-row">
                <span className="profile-card-label">OI Long</span>
                <span className="profile-card-value">${formatNumber((m.oiLong || 0) / 1e6, 2)}</span>
                <span className="profile-card-label">OI Short</span>
                <span className="profile-card-value">${formatNumber((m.oiShort || 0) / 1e6, 2)}</span>
              </div>
              <div className="profile-card-row">
                <span className="profile-card-label">Open Fee</span>
                <span className="profile-card-value">{formatNumber((m.openFeePct || 0) * 100, 3)}%</span>
                <span className="profile-card-label">Close Fee</span>
                <span className="profile-card-value">{formatNumber((m.closeFeePct || 0) * 100, 3)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
