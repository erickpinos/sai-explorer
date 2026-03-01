import { useMemo } from 'react';
import { useMarkets } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatPrice } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import SortTh from '../ui/SortTh';
import { useViewToggle } from '../ui/ViewToggle';
import { useSortedData } from '../../hooks/useSortedData';

const SORT_KEYS = {
  marketId:     (m) => m.marketId ?? 0,
  symbol:       (m) => m.baseToken?.symbol || '',
  collateral:   (m) => m.collateralToken?.symbol || '',
  price:        (m) => m.price || 0,
  priceChange:  (m) => m.priceChangePct24Hrs || 0,
  oiLong:       (m) => m.oiLongUsd || 0,
  oiShort:      (m) => m.oiShortUsd || 0,
  oiMax:        (m) => m.oiMaxUsd || 0,
  openFee:      (m) => m.openFeePct || 0,
  closeFee:     (m) => m.closeFeePct || 0,
  fundingLong:  (m) => m.feesPerHourLong || 0,
  fundingShort: (m) => m.feesPerHourShort || 0,
  totalOi:      (m) => (m.oiLongUsd || 0) + (m.oiShortUsd || 0),
};

export default function MarketsTable() {
  const { network } = useNetwork();
  const { data, loading, error } = useMarkets(network);
  const { toggle, viewClass } = useViewToggle();

  const filteredMarkets = useMemo(() => (data?.markets || []).filter(m => m.visible !== false), [data]);
  const { sorted, sortCol, sortDir, handleSort } = useSortedData(filteredMarkets, 'totalOi', 'desc', SORT_KEYS);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!sorted.length) return <EmptyState message="No markets found" />;

  const Th = ({ col, children }) => (
    <SortTh col={col} sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>{children}</SortTh>
  );

  return (
    <div className={viewClass}>
      <div className="table-info">{sorted.length} markets{toggle}</div>
      <div className="table-wrapper profile-table-desktop">
        <table>
          <thead>
            <tr>
              <Th col="marketId">Market ID</Th>
              <Th col="symbol">Market</Th>
              <Th col="collateral">Collateral</Th>
              <Th col="price">Price</Th>
              <Th col="priceChange">24h Change</Th>
              <Th col="oiLong">OI Long</Th>
              <Th col="oiShort">OI Short</Th>
              <Th col="oiMax">Max OI</Th>
              <th>Leverage</th>
              <Th col="openFee">Open Fee</Th>
              <Th col="closeFee">Close Fee</Th>
              <Th col="fundingLong">Funding Long</Th>
              <Th col="fundingShort">Funding Short</Th>
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
                  <td>{m.collateralToken?.symbol || '-'}</td>
                  <td>{formatPrice(m.price || 0)}</td>
                  <td className={changeClass}>{changeSign}{formatNumber(priceChange, 2)}%</td>
                  <td>${formatNumber(m.oiLongUsd || 0, 2)}</td>
                  <td>${formatNumber(m.oiShortUsd || 0, 2)}</td>
                  <td>${formatNumber(m.oiMaxUsd || 0, 2)}</td>
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
                  <span className="badge badge-purple" style={{ fontSize: '11px' }}>{m.collateralToken?.symbol || '-'}</span>
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
                <span className="profile-card-value">${formatNumber(m.oiLongUsd || 0, 2)}</span>
                <span className="profile-card-label">OI Short</span>
                <span className="profile-card-value">${formatNumber(m.oiShortUsd || 0, 2)}</span>
              </div>
              <div className="profile-card-row">
                <span className="profile-card-label">Max OI</span>
                <span className="profile-card-value">${formatNumber(m.oiMaxUsd || 0, 2)}</span>
                <span className="profile-card-label">OI Usage</span>
                <span className="profile-card-value">{m.oiMaxUsd ? formatNumber(((m.oiLongUsd || 0) + (m.oiShortUsd || 0)) / m.oiMaxUsd * 100, 1) : '0'}%</span>
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
      <div className="markets-note">
        <span className="markets-note-icon">ℹ</span>
        <span>OI values for markets using <strong>stNIBI</strong> as collateral are stored natively in stNIBI and converted to USD using the live stNIBI price.</span>
      </div>
    </div>
  );
}
