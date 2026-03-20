import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useTrades, useVolume } from '../hooks/useApi';
import { useNetwork } from '../hooks/useNetwork';
import { formatNumber, formatDate, formatAddress, formatUSD } from '../utils/formatters';
import { getBadgeClass, formatTradeTypeBadge, formatPnl, toUsd } from '../utils/tradeHelpers';
import Stats from './ui/Stats';
import FunFacts from './ui/FunFacts';
import LoadingSpinner from './ui/LoadingSpinner';

const PREVIEW_COUNT = 5;

function TradesPreview({ network }) {
  const navigate = useNavigate();
  const { data, loading } = useTrades(network);

  const rows = Array.isArray(data) ? data.slice(0, PREVIEW_COUNT) : [];

  return (
    <div className="preview-section">
      <div className="preview-header">
        <h3 className="preview-title">Recent Trades</h3>
        <Link to="/trades" className="preview-view-all">View all →</Link>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Market</th>
                <th>Direction</th>
                <th>PnL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => {
                const pnl = toUsd(t.realizedPnlCollateral, t.collateralPrice);
                return (
                  <tr
                    key={i}
                    className="clickable-row"
                    onClick={() => navigate('/trades')}
                  >
                    <td>{formatDate(t.block?.block_ts)}</td>
                    <td>
                      <span className={getBadgeClass(t.tradeChangeType, t.txFailed)}>
                        {formatTradeTypeBadge(t.tradeChangeType, t.txFailed)}
                      </span>
                    </td>
                    <td>{t.trade?.perpBorrowing?.baseToken?.symbol || '-'}</td>
                    <td>
                      {t.trade?.isLong != null ? (
                        <span className={t.trade.isLong ? 'badge badge-green' : 'badge badge-red'}>
                          {t.trade.isLong ? 'Long' : 'Short'}
                        </span>
                      ) : '-'}
                    </td>
                    <td className={pnl > 0 ? 'pnl-positive' : pnl < 0 ? 'pnl-negative' : ''}>
                      {pnl !== 0 ? formatPnl(pnl) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TradersPreview({ network }) {
  const navigate = useNavigate();
  const { data, loading } = useVolume(network);

  const rows = data?.users ? [...data.users].slice(0, PREVIEW_COUNT) : [];

  return (
    <div className="preview-section">
      <div className="preview-header">
        <h3 className="preview-title">Top Traders</h3>
        <Link to="/volume" className="preview-view-all">View all →</Link>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Trader</th>
                <th>Volume</th>
                <th>Trades</th>
                <th>PnL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u, i) => (
                <tr
                  key={i}
                  className="clickable-row"
                  onClick={() => navigate('/volume')}
                >
                  <td>{i + 1}</td>
                  <td>
                    <span className="address-link" title={u.evmTrader || u.trader}>
                      {formatAddress(u.evmTrader || u.trader)}
                    </span>
                  </td>
                  <td>{formatUSD(u.totalVolume)}</td>
                  <td>{u.tradeCount}</td>
                  <td className={u.realizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                    {formatPnl(u.realizedPnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const { network } = useNetwork();

  return (
    <>
      <Stats />
      <FunFacts />
      <div className="preview-grid">
        <TradesPreview network={network} />
        <TradersPreview network={network} />
      </div>
    </>
  );
}
