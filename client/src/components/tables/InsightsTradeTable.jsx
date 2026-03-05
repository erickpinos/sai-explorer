import { formatNumber, formatAddress, formatDate } from '../../utils/formatters';
import { shortenHash } from '../../utils/tradeHelpers';
import { useViewToggle } from '../ui/ViewToggle';
import { useSortedData } from '../../hooks/useSortedData';
import SortTh from '../ui/SortTh';
import SortDropdown from '../ui/SortDropdown';

const SORT_GETTERS = {
  trader:       (t) => t.evmTrader || t.trader || '',
  symbol:       (t) => t.symbol || '',
  direction:    (t) => t.isLong ? 1 : 0,
  leverage:     (t) => t.leverage || 0,
  pnlUsd:       (t) => Math.abs(t.pnlUsd || 0),
  pnlPct:       (t) => Math.abs(t.pnlPct || 0),
  positionSize: (t) => t.positionSize || 0,
  timestamp:    (t) => new Date(t.timestamp || 0).getTime(),
};

const SORT_OPTIONS_USD = [
  { key: 'pnlUsd', label: 'PnL $' },
  { key: 'positionSize', label: 'Position Size' },
  { key: 'leverage', label: 'Leverage' },
  { key: 'symbol', label: 'Market' },
  { key: 'timestamp', label: 'Date' },
];

const SORT_OPTIONS_PCT = [
  { key: 'pnlPct', label: 'PnL %' },
  { key: 'pnlUsd', label: 'PnL $' },
  { key: 'positionSize', label: 'Position Size' },
  { key: 'leverage', label: 'Leverage' },
  { key: 'symbol', label: 'Market' },
  { key: 'timestamp', label: 'Date' },
];

export default function InsightsTradeTable({ trades, config, isPct, isLoss, onSelectUser, onSelectTrade }) {
  const { toggle, viewClass } = useViewToggle();
  const defaultSort = isPct ? 'pnlPct' : 'pnlUsd';
  const { sorted, sortCol, sortDir, handleSort } = useSortedData(trades, defaultSort, 'desc', SORT_GETTERS);
  const sortOptions = isPct ? SORT_OPTIONS_PCT : SORT_OPTIONS_USD;

  const Th = ({ col, children }) => (
    <SortTh col={col} sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>{children}</SortTh>
  );

  return (
    <div className={viewClass}>
      <div className="table-info">
        {sorted.length} trades
        {toggle}
      </div>
      <div className="table-wrapper profile-table-desktop">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <Th col="trader">Trader</Th>
              <Th col="symbol">Market</Th>
              <Th col="direction">Direction</Th>
              <Th col="leverage">Leverage</Th>
              {isPct && <Th col="pnlPct">PnL %</Th>}
              <Th col="pnlUsd">PnL {isPct ? '$' : ''}</Th>
              <Th col="positionSize">Position Size</Th>
              <Th col="timestamp">Date</Th>
              <th>TX Hash</th>
              <th>EVM TX Hash</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={i} className="clickable-row" onClick={() => onSelectTrade(t)}>
                <td>{i + 1}</td>
                <td><span className="address-link" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelectUser({ bech32: t.trader, evm: t.evmTrader }); }}>{formatAddress(t.evmTrader || t.trader)}</span></td>
                <td>{t.symbol}</td>
                <td><span className={`badge ${t.isLong ? 'badge-green' : 'badge-red'}`}>{t.isLong ? 'Long' : 'Short'}</span></td>
                <td>{t.leverage}x</td>
                {isPct && <td className={isLoss ? 'pnl-negative' : 'pnl-positive'}>{isLoss ? '' : '+'}{formatNumber(t.pnlPct, 2)}%</td>}
                <td className={isLoss ? 'pnl-negative' : 'pnl-positive'}>{isLoss ? '-' : '+'}${formatNumber(Math.abs(t.pnlUsd), 2)}</td>
                <td>${formatNumber(t.positionSize, 2)}</td>
                <td>{formatDate(t.timestamp)}</td>
                <td onClick={(e) => e.stopPropagation()}>{t.txHash ? <a href={`${config.explorerTx}${t.txHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash">{shortenHash(t.txHash)}</a> : '-'}</td>
                <td onClick={(e) => e.stopPropagation()}>{t.evmTxHash ? <a href={`${config.explorerEvmTx}${t.evmTxHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash">{shortenHash(t.evmTxHash)}</a> : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SortDropdown options={sortOptions} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
      <div className="profile-cards-mobile">
        {sorted.map((t, i) => (
          <div key={i} className="profile-card clickable-row" onClick={() => onSelectTrade(t)}>
            <div className="profile-card-header">
              <div className="profile-card-badges">
                <span className="profile-card-rank">#{i + 1}</span>
                <span className={`badge ${t.isLong ? 'badge-green' : 'badge-red'}`}>{t.isLong ? 'Long' : 'Short'}</span>
                <span className="profile-card-market">{t.symbol}</span>
              </div>
              <span className="profile-card-time">{formatDate(t.timestamp)}</span>
            </div>
            <div className="profile-card-row">
              {isPct && (
                <>
                  <span className="profile-card-label">PnL %</span>
                  <span className={`profile-card-value ${isLoss ? 'pnl-negative' : 'pnl-positive'}`}>{isLoss ? '' : '+'}{formatNumber(t.pnlPct, 2)}%</span>
                </>
              )}
              <span className="profile-card-label">PnL $</span>
              <span className={`profile-card-value ${isLoss ? 'pnl-negative' : 'pnl-positive'}`}>{isLoss ? '-' : '+'}${formatNumber(Math.abs(t.pnlUsd), 2)}</span>
            </div>
            <div className="profile-card-row">
              <span className="profile-card-label">Leverage</span>
              <span className="profile-card-value">{t.leverage}x</span>
              <span className="profile-card-label">Size</span>
              <span className="profile-card-value">${formatNumber(t.positionSize, 2)}</span>
            </div>
            <div className="profile-card-row">
              <span className="profile-card-label">Trader</span>
              <span className="profile-card-value"><span className="address-link" onClick={(e) => { e.stopPropagation(); onSelectUser({ bech32: t.trader, evm: t.evmTrader }); }}>{formatAddress(t.evmTrader || t.trader)}</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
