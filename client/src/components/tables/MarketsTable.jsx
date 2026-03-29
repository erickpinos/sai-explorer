import { useMemo, useState } from 'react';
import { useMarkets, useMarketDepth, useMarketVolatility } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatPrice } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import DataTable from './DataTable';

const IS_DEV = import.meta.env.DEV;

const SOURCE_COLORS = {
  Keeper:    { bg: '#2563eb33', color: '#60a5fa' },
  LCD:       { bg: '#7c3aed33', color: '#a78bfa' },
  Manual:    { bg: '#dc262633', color: '#f87171' },
  Calc:      { bg: '#ca8a0433', color: '#fbbf24' },
  CoinGecko: { bg: '#16a34a33', color: '#4ade80' },
  Error:     { bg: '#dc262633', color: '#f87171' },
};

function SourceBadge({ source, onClick }) {
  const c = SOURCE_COLORS[source];
  if (!c) return null;
  return (
    <span
      onClick={onClick}
      style={{
        fontSize: '8px', marginLeft: 5, padding: '1px 4px',
        borderRadius: 3, verticalAlign: 'middle',
        background: c.bg, color: c.color, whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {source}
    </span>
  );
}

const SORT_OPTIONS = [
  { key: 'totalOi',    label: 'Total OI' },
  { key: 'symbol',     label: 'Market' },
  { key: 'price',      label: 'Price' },
  { key: 'priceChange',label: '24h Change' },
  { key: 'oiLong',     label: 'OI Long' },
  { key: 'oiShort',    label: 'OI Short' },
  { key: 'oiMax',      label: 'Max OI' },
  { key: 'marketId',   label: 'Market ID' },
  ...(IS_DEV ? [
    { key: 'depth_up',   label: '+2% Depth [DEV]' },
    { key: 'depth_down', label: '-2% Depth [DEV]' },
    { key: 'volatility', label: 'Organic Volatility [DEV]' },
  ] : []),
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
  depth_up:    (m) => m._depth?.depth_plus_2_percent_usd  || 0,
  depth_down:  (m) => m._depth?.depth_minus_2_percent_usd || 0,
  volatility:  (m) => m._volatility?.volatility_pct || 0,
};

const DEFAULT_COLUMNS = [
  { key: 'marketId',    label: 'Market ID',          sortable: true },
  { key: 'symbol',      label: 'Market',             sortable: true },
  { key: 'collateral',  label: 'Collateral',         sortable: true },
  { key: 'price',       label: 'Price',              sortable: true },
  { key: 'priceChange', label: '24h Change',         sortable: true },
  { key: 'oiLong',      label: 'OI Long',            sortable: true },
  { key: 'oiShort',     label: 'OI Short',           sortable: true },
  { key: 'oiMax',       label: 'Max OI',             sortable: true },
  { key: 'leverage',    label: 'Leverage',           sortable: false },
  { key: 'openFee',     label: 'Open Fee',           sortable: true },
  { key: 'closeFee',    label: 'Close Fee',          sortable: true },
  { key: 'fundingLong', label: 'Funding Long',       sortable: true },
  { key: 'fundingShort',label: 'Funding Short',      sortable: true },
  ...(IS_DEV ? [
    { key: 'depth_up',   label: '+2% Depth [DEV]',   sortable: true },
    { key: 'depth_down', label: '-2% Depth [DEV]',   sortable: true },
    { key: 'volatility', label: 'Organic Volatility [DEV]', sortable: true },
  ] : []),
];

function renderCell(key, m, onDepthInfo, onVolInfo, sourceErrors, onErrorInfo) {
  const priceChange = m.priceChangePct24Hrs || 0;
  const changeClass = priceChange >= 0 ? 'pnl-positive' : 'pnl-negative';
  const changeSign = priceChange >= 0 ? '+' : '';
  const symbol = m.baseToken?.symbol || (m.marketId != null ? String(m.marketId) : '-');

  const B = (source) => sourceErrors[source]
    ? <SourceBadge source="Error" onClick={() => onErrorInfo(source, sourceErrors[source])} />
    : <SourceBadge source={source} />;

  switch (key) {
    case 'marketId':    return <td><strong>{m.marketId != null ? m.marketId : '-'}</strong> {B(m.inactive ? (m.symbolSource || 'LCD') : 'Keeper')}</td>;
    case 'symbol':
      return (
        <td>
          <strong>{symbol}</strong>
          {m.symbolSource && (sourceErrors[m.symbolSource]
            ? <SourceBadge source="Error" onClick={() => onErrorInfo(m.symbolSource, sourceErrors[m.symbolSource])} />
            : <SourceBadge source={m.symbolSource} />)}
        </td>
      );
    case 'collateral':  return <td>{m.collateralToken?.symbol || '-'} {B('Keeper')}</td>;
    case 'price':       return <td>{formatPrice(m.price || 0)} {B(m.inactive && m.price ? 'LCD' : 'Keeper')}</td>;
    case 'priceChange': return <td className={changeClass}>{changeSign}{formatNumber(priceChange, 2)}% {B('Keeper')}</td>;
    case 'oiLong':      return <td>${formatNumber(m.oiLongUsd || 0, 2)} {B('Calc')}</td>;
    case 'oiShort':     return <td>${formatNumber(m.oiShortUsd || 0, 2)} {B('Calc')}</td>;
    case 'oiMax':       return <td>${formatNumber(m.oiMaxUsd || 0, 2)} {B('Calc')}</td>;
    case 'leverage':    return <td>{m.minLeverage || 1}x - {m.maxLeverage || 100}x {B('Keeper')}</td>;
    case 'openFee':     return <td>{formatNumber((m.openFeePct || 0) * 100, 3)}% {B('Keeper')}</td>;
    case 'closeFee':    return <td>{formatNumber((m.closeFeePct || 0) * 100, 3)}% {B('Keeper')}</td>;
    case 'fundingLong': return <td>{formatNumber((m.feesPerHourLong || 0) * 100, 4)}%/hr {B('Keeper')}</td>;
    case 'fundingShort':return <td>{formatNumber((m.feesPerHourShort || 0) * 100, 4)}%/hr {B('Keeper')}</td>;
    case 'depth_up':
      return (
        <td style={{ whiteSpace: 'nowrap' }}>
          {m._depth?.depth_plus_2_percent_usd != null
            ? `$${formatNumber(m._depth.depth_plus_2_percent_usd, 0)}`
            : '—'}
          {' '}{B('CoinGecko')}
          {m._depth && (
            <button onClick={() => onDepthInfo(m._depth)} style={infoIconStyle} title="How is this calculated?">ⓘ</button>
          )}
        </td>
      );
    case 'depth_down':
      return (
        <td style={{ whiteSpace: 'nowrap' }}>
          {m._depth?.depth_minus_2_percent_usd != null
            ? `$${formatNumber(m._depth.depth_minus_2_percent_usd, 0)}`
            : '—'}
          {' '}{B('CoinGecko')}
          {m._depth && (
            <button onClick={() => onDepthInfo(m._depth)} style={infoIconStyle} title="How is this calculated?">ⓘ</button>
          )}
        </td>
      );
    case 'volatility':
      return (
        <td style={{ whiteSpace: 'nowrap' }}>
          {m._volatility?.volatility_pct != null
            ? `${formatNumber(m._volatility.volatility_pct, 3)}%`
            : '—'}
          {' '}{B('CoinGecko')}
          {m._volatility && (
            <button onClick={() => onVolInfo(m._volatility)} style={infoIconStyle} title="How is this calculated?">ⓘ</button>
          )}
        </td>
      );
    default:            return <td>-</td>;
  }
}

const infoIconStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#666', fontSize: '11px', padding: '0 0 0 4px',
  lineHeight: 1, verticalAlign: 'middle',
};

function renderMobileCard(m, i, onDepthInfo, onVolInfo) {
  const symbol = m.baseToken?.symbol || (m.marketId != null ? String(m.marketId) : '-');
  const priceChange = m.priceChangePct24Hrs || 0;
  const changeClass = priceChange >= 0 ? 'pnl-positive' : 'pnl-negative';
  const changeSign = priceChange >= 0 ? '+' : '';
  return (
    <div key={i} className="profile-card">
      <div className="profile-card-header">
        <div className="profile-card-badges">
          <span className="profile-card-market">
            {symbol}
            {m.symbolSource && <SourceBadge source={m.symbolSource} />}
          </span>
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
      {IS_DEV && m._depth && (
        <div className="profile-card-row">
          <span className="profile-card-label">+2% Depth</span>
          <span className="profile-card-value">
            {m._depth.depth_plus_2_percent_usd != null ? `$${formatNumber(m._depth.depth_plus_2_percent_usd, 0)}` : '—'}
            <button onClick={() => onDepthInfo(m._depth)} style={infoIconStyle} title="How is this calculated?">ⓘ</button>
          </span>
          <span className="profile-card-label">-2% Depth</span>
          <span className="profile-card-value">
            {m._depth.depth_minus_2_percent_usd != null ? `$${formatNumber(m._depth.depth_minus_2_percent_usd, 0)}` : '—'}
          </span>
        </div>
      )}
      {IS_DEV && m._volatility && (
        <div className="profile-card-row">
          <span className="profile-card-label">Organic Volatility (30s)</span>
          <span className="profile-card-value">
            {formatNumber(m._volatility.volatility_pct, 3)}%
            <button onClick={() => onVolInfo(m._volatility)} style={infoIconStyle} title="How is this calculated?">ⓘ</button>
          </span>
        </div>
      )}
    </div>
  );
}

function DepthInfoModal({ depth, onClose }) {
  const coinId = depth?.coinId;
  const fetchedAt = depth?.fetched_at ? new Date(depth.fetched_at).toLocaleString() : 'unknown';
  const cgUrl = coinId ? `https://www.coingecko.com/en/coins/${coinId}` : null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--border, #333)',
          borderRadius: 8, padding: 24, maxWidth: 480, width: '90%', color: 'var(--text, #eee)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>±2% Market Depth</h3>

        <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.6, color: '#aaa' }}>
          Sourced from <strong style={{ color: '#eee' }}>CoinGecko</strong> via{' '}
          <code style={{ fontSize: 11 }}>/coins/{coinId}/tickers?depth=true</code>.
          CoinGecko returns <code style={{ fontSize: 11 }}>cost_to_move_up_usd</code> and{' '}
          <code style={{ fontSize: 11 }}>cost_to_move_down_usd</code> per exchange ticker.
        </p>

        <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.6, color: '#aaa' }}>
          <strong style={{ color: '#eee' }}>+2% depth</strong> = USD cost to move the price up 2%.{' '}
          <strong style={{ color: '#eee' }}>−2% depth</strong> = USD cost to move it down 2%.
          The values shown here are summed across all active USDT spot pairs from the first page
          of results (top ~100 tickers by volume). CoinGecko does not document their exact
          per-exchange calculation methodology.{' '}
          <a
            href="https://docs.coingecko.com/reference/coins-id-tickers#parameter-depth"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#60a5fa' }}
          >
            CoinGecko docs ↗
          </a>
        </p>

        <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.6, color: '#aaa' }}>
          Refreshed <strong style={{ color: '#eee' }}>once per day</strong> and stored in the
          database to avoid hitting CoinGecko rate limits.
        </p>

        <div style={{ fontSize: 12, color: '#666', borderTop: '1px solid #333', paddingTop: 12, marginBottom: 16 }}>
          Last pulled: <strong style={{ color: '#aaa' }}>{fetchedAt}</strong>
        </div>

        {cgUrl && (
          <a
            href={cgUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: '#60a5fa', display: 'inline-block', marginBottom: 16 }}
          >
            View {coinId} on CoinGecko ↗
          </a>
        )}

        <div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px', background: '#333', border: '1px solid #555',
              borderRadius: 4, color: '#eee', cursor: 'pointer', fontSize: 13,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function VolatilityInfoModal({ vol, onClose }) {
  const coinId = vol?.coinId;
  const fetchedAt = vol?.fetched_at ? new Date(vol.fetched_at).toLocaleString() : 'unknown';
  const cgUrl = coinId ? `https://www.coingecko.com/en/coins/${coinId}` : null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--border, #333)',
          borderRadius: 8, padding: 24, maxWidth: 480, width: '90%', color: 'var(--text, #eee)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Organic Volatility (30s epoch)</h3>

        <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.6, color: '#aaa' }}>
          Sourced from <strong style={{ color: '#eee' }}>CoinGecko</strong> via{' '}
          <code style={{ fontSize: 11 }}>/coins/{coinId}/market_chart?days=1</code>.
          This returns price data at approximately 5-minute intervals over the past 24 hours.
        </p>

        <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.6, color: '#aaa' }}>
          <strong style={{ color: '#eee' }}>Methodology:</strong>{' '}
          Log returns are computed between each consecutive price point. The sample variance
          of those returns is then scaled to a <strong style={{ color: '#eee' }}>30-second epoch</strong>:
        </p>

        <div style={{
          background: '#111', border: '1px solid #333', borderRadius: 4,
          padding: '8px 12px', margin: '0 0 10px', fontSize: 12, fontFamily: 'monospace', color: '#ccc',
        }}>
          σ<sub>30s</sub> = √(Var(log returns) × 30 / avg_interval_seconds)
        </div>

        <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.6, color: '#aaa' }}>
          {vol?.data_points != null && vol?.avg_interval_sec != null && (
            <>
              Based on <strong style={{ color: '#eee' }}>{vol.data_points}</strong> data points
              with an average interval of <strong style={{ color: '#eee' }}>{vol.avg_interval_sec}s</strong>.{' '}
            </>
          )}
          This measures the natural ("organic") price movement expected in a single 30-second window,
          useful for calibrating fees, liquidation buffers, and market-making spread.
        </p>

        <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.6, color: '#aaa' }}>
          Refreshed <strong style={{ color: '#eee' }}>once per day</strong> and stored in the
          database to avoid hitting CoinGecko rate limits.
        </p>

        <div style={{ fontSize: 12, color: '#666', borderTop: '1px solid #333', paddingTop: 12, marginBottom: 16 }}>
          Last pulled: <strong style={{ color: '#aaa' }}>{fetchedAt}</strong>
        </div>

        {cgUrl && (
          <a
            href={cgUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: '#60a5fa', display: 'inline-block', marginBottom: 16 }}
          >
            View {coinId} on CoinGecko ↗
          </a>
        )}

        <div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px', background: '#333', border: '1px solid #555',
              borderRadius: 4, color: '#eee', cursor: 'pointer', fontSize: 13,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorInfoModal({ source, message, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid #dc2626',
          borderRadius: 8, padding: 24, maxWidth: 480, width: '90%', color: 'var(--text, #eee)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#f87171' }}>
          {source} Fetch Error
        </h3>
        <div style={{
          background: '#111', border: '1px solid #333', borderRadius: 4,
          padding: '8px 12px', margin: '0 0 16px', fontSize: 12, fontFamily: 'monospace',
          color: '#f87171', wordBreak: 'break-word',
        }}>
          {message}
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.6, color: '#aaa' }}>
          The values shown for <strong style={{ color: '#eee' }}>{source}</strong> cells
          may be stale, incomplete, or zeroed out.
          Data will automatically refresh on the next successful fetch.
        </p>
        <div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px', background: '#333', border: '1px solid #555',
              borderRadius: 4, color: '#eee', cursor: 'pointer', fontSize: 13,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MarketsTable() {
  const { network } = useNetwork();
  const { data, loading, error } = useMarkets(network);
  const { data: depthData } = useMarketDepth(network, { autoFetch: IS_DEV });
  const { data: volData } = useMarketVolatility(network, { autoFetch: IS_DEV });
  const [showDepthInfo, setShowDepthInfo] = useState(false);
  const [selectedDepth, setSelectedDepth] = useState(null);
  const [selectedVol, setSelectedVol] = useState(null);
  const [errorModal, setErrorModal] = useState(null);

  const sourceErrors = data?.errors || {};

  const markets = useMemo(() => {
    const raw = (data?.markets || []).filter(m => m.visible !== false);
    if (!IS_DEV) return raw;
    const depthByMarketId = depthData?.markets
      ? Object.fromEntries(depthData.markets.map(d => [d.marketId, d]))
      : {};
    const volBySymbol = volData?.markets
      ? Object.fromEntries(volData.markets.map(v => [v.symbol, v]))
      : {};
    return raw.map(m => ({
      ...m,
      _depth: depthByMarketId[m.marketId] ?? null,
      _volatility: volBySymbol[m.baseToken?.symbol] ?? null,
    }));
  }, [data, depthData, volData]);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!markets.length) return <EmptyState message="No markets found" />;

  const onDepthInfo = (depth) => { setSelectedDepth(depth); };
  const onCloseDepthInfo = () => setSelectedDepth(null);
  const onVolInfo = (vol) => { setSelectedVol(vol); };

  const footer = (
    <>
      <div className="markets-note">
        <span className="markets-note-icon">ℹ</span>
        <span>OI values for markets using <strong>stNIBI</strong> as collateral are stored natively in stNIBI and converted to USD using the live stNIBI price.</span>
      </div>
      {IS_DEV && (
        <div className="markets-note" style={{ marginTop: 4 }}>
          <span className="markets-note-icon" style={{ color: '#f59e0b' }}>⬥</span>
          <span style={{ color: '#888' }}>
            <strong style={{ color: '#f59e0b' }}>[DEV]</strong> ±2% depth sourced from CoinGecko, refreshed once per day. Organic volatility = realized vol from 24h minute candles, scaled to 30s epoch.{' '}
            <button
              onClick={() => setShowDepthInfo(true)}
              style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}
            >
              How is this calculated?
            </button>
          </span>
        </div>
      )}
      {showDepthInfo && (
        <DepthInfoModal
          depth={{ coinId: null, fetched_at: depthData?.last_updated }}
          onClose={() => setShowDepthInfo(false)}
        />
      )}
      {selectedDepth && (
        <DepthInfoModal depth={selectedDepth} onClose={onCloseDepthInfo} />
      )}
      {selectedVol && (
        <VolatilityInfoModal vol={selectedVol} onClose={() => setSelectedVol(null)} />
      )}
      {errorModal && (
        <ErrorInfoModal
          source={errorModal.source}
          message={errorModal.message}
          onClose={() => setErrorModal(null)}
        />
      )}
    </>
  );

  return (
    <DataTable
      tableKey="markets"
      data={markets}
      columns={DEFAULT_COLUMNS}
      renderCell={(key, m) => renderCell(key, m, onDepthInfo, onVolInfo, sourceErrors, (src, msg) => setErrorModal({ source: src, message: msg }))}
      renderMobileCard={(m, i) => renderMobileCard(m, i, onDepthInfo, onVolInfo)}
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
