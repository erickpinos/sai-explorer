import { useMemo } from 'react';
import { useMarkets } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatPrice } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import DataTable from './DataTable';

const SORT_OPTIONS = [
  { key: 'totalOi',    label: 'Total OI' },
  { key: 'symbol',     label: 'Market' },
  { key: 'price',      label: 'Price' },
  { key: 'priceChange',label: '24h Change' },
  { key: 'oiLong',     label: 'OI Long' },
  { key: 'oiShort',    label: 'OI Short' },
  { key: 'oiMax',      label: 'Max OI' },
  { key: 'marketId',   label: 'Market ID' },
];

const SORT_GETTERS = {
  marketId:    (m) => m.marketId ?? 0,
  symbol:      (m) => m.baseToken?.symbol || '',
  collateral:  (m) => m.collateralToken?.symbol || '',
  price:       (m) => m.price || 0,
  priceChange: (m) => m.priceChangePct24Hrs || 0,
  oiLong:      (m) => m.oiLongUsd || 0,
  oiShort:     (m) => m.oiShortUsd || 0,
  oiMax:       (m) => m.oiMaxUsd || 0,
  openFee:     (m) => m.openFeePct || 0,
  closeFee:    (m) => m.closeFeePct || 0,
  fundingLong: (m) => m.feesPerHourLong || 0,
  fundingShort:(m) => m.feesPerHourShort || 0,
  totalOi:     (m) => (m.oiLongUsd || 0) + (m.oiShortUsd || 0),
};

const DEFAULT_COLUMNS = [
  { key: 'marketId',    label: 'Market ID',     sortable: true },
  { key: 'symbol',      label: 'Market',        sortable: true },
  { key: 'collateral',  label: 'Collateral',    sortable: true },
  { key: 'price',       label: 'Price',         sortable: true },
  { key: 'priceChange', label: '24h Change',    sortable: true },
  { key: 'oiLong',      label: 'OI Long',       sortable: true },
  { key: 'oiShort',     label: 'OI Short',      sortable: true },
  { key: 'oiMax',       label: 'Max OI',        sortable: true },
  { key: 'leverage',    label: 'Leverage',      sortable: false },
  { key: 'openFee',     label: 'Open Fee',      sortable: true },
  { key: 'closeFee',    label: 'Close Fee',     sortable: true },
  { key: 'fundingLong', label: 'Funding Long',  sortable: true },
  { key: 'fundingShort',label: 'Funding Short', sortable: true },
];

function renderCell(key, m) {
  const priceChange = m.priceChangePct24Hrs || 0;
  const changeClass = priceChange >= 0 ? 'pnl-positive' : 'pnl-negative';
  const changeSign = priceChange >= 0 ? '+' : '';
  const symbol = m.baseToken?.symbol || (m.marketId != null ? String(m.marketId) : '-');

  switch (key) {
    case 'marketId':    return <td><strong>{m.marketId != null ? m.marketId : '-'}</strong></td>;
    case 'symbol':      return <td><strong>{symbol}</strong></td>;
    case 'collateral':  return <td>{m.collateralToken?.symbol || '-'}</td>;
    case 'price':       return <td>{formatPrice(m.price || 0)}</td>;
    case 'priceChange': return <td className={changeClass}>{changeSign}{formatNumber(priceChange, 2)}%</td>;
    case 'oiLong':      return <td>${formatNumber(m.oiLongUsd || 0, 2)}</td>;
    case 'oiShort':     return <td>${formatNumber(m.oiShortUsd || 0, 2)}</td>;
    case 'oiMax':       return <td>${formatNumber(m.oiMaxUsd || 0, 2)}</td>;
    case 'leverage':    return <td>{m.minLeverage || 1}x - {m.maxLeverage || 100}x</td>;
    case 'openFee':     return <td>{formatNumber((m.openFeePct || 0) * 100, 3)}%</td>;
    case 'closeFee':    return <td>{formatNumber((m.closeFeePct || 0) * 100, 3)}%</td>;
    case 'fundingLong': return <td>{formatNumber((m.feesPerHourLong || 0) * 100, 4)}%/hr</td>;
    case 'fundingShort':return <td>{formatNumber((m.feesPerHourShort || 0) * 100, 4)}%/hr</td>;
    default:            return <td>-</td>;
  }
}

function renderMobileCard(m, i) {
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
        <span className="profile-card-value">
          {m.oiMaxUsd ? formatNumber(((m.oiLongUsd || 0) + (m.oiShortUsd || 0)) / m.oiMaxUsd * 100, 1) : '0'}%
        </span>
      </div>
      <div className="profile-card-row">
        <span className="profile-card-label">Open Fee</span>
        <span className="profile-card-value">{formatNumber((m.openFeePct || 0) * 100, 3)}%</span>
        <span className="profile-card-label">Close Fee</span>
        <span className="profile-card-value">{formatNumber((m.closeFeePct || 0) * 100, 3)}%</span>
      </div>
    </div>
  );
}

const footer = (
  <div className="markets-note">
    <span className="markets-note-icon">ℹ</span>
    <span>OI values for markets using <strong>stNIBI</strong> as collateral are stored natively in stNIBI and converted to USD using the live stNIBI price.</span>
  </div>
);

export default function MarketsTable() {
  const { network } = useNetwork();
  const { data, loading, error } = useMarkets(network);
  const markets = useMemo(() => (data?.markets || []).filter(m => m.visible !== false), [data]);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!markets.length) return <EmptyState message="No markets found" />;

  return (
    <DataTable
      tableKey="markets"
      data={markets}
      columns={DEFAULT_COLUMNS}
      renderCell={renderCell}
      renderMobileCard={renderMobileCard}
      sortGetters={SORT_GETTERS}
      defaultSortCol="totalOi"
      defaultSortDir="desc"
      sortOptions={SORT_OPTIONS}
      getRowKey={(_, i) => i}
      infoText={(total) => `${total} markets`}
      footer={footer}
    />
  );
}
