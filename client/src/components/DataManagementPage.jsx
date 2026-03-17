import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { useNetwork } from '../hooks/useNetwork';
import { useStats } from '../hooks/useApi';

const DATA_TABLES = [
  { key: 'trades',    label: 'Trades' },
  { key: 'deposits',  label: 'LP Deposits' },
  { key: 'withdraws', label: 'Withdraw Requests' },
];

const initialRowState = () => ({
  loading: false,
  confirmClear: false,
  lastStatus: null,
});

export default function DataManagementPage({ setRefreshKey }) {
  const { network } = useNetwork();
  const { data: stats, refetch: refetchStats } = useStats(network);
  const counts = {
    trades: stats?.trades?.total ?? null,
    deposits: stats?.deposits?.total ?? null,
    withdraws: stats?.withdraws?.total ?? null,
  };
  const [rows, setRows] = useState(() =>
    Object.fromEntries(DATA_TABLES.map(t => [t.key, initialRowState()]))
  );

  const [backfill, setBackfill] = useState({ running: false, log: [] });
  const esRef = useRef(null);

  function startBackfill() {
    if (esRef.current) esRef.current.close();
    setBackfill({ running: true, log: ['Connecting...'] });

    const es = new EventSource('/api/backfill');
    esRef.current = es;

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'progress') {
        setBackfill(prev => {
          const last = prev.log[prev.log.length - 1];
          const line = `  ${event.network} ${event.table}: page ${event.page}, ${event.total} total`;
          // Update last line if it's the same table/network, otherwise append
          if (last && last.startsWith(`  ${event.network} ${event.table}`)) {
            return { ...prev, log: [...prev.log.slice(0, -1), line] };
          }
          return { ...prev, log: [...prev.log, line] };
        });
      } else if (event.type === 'log') {
        setBackfill(prev => ({ ...prev, log: [...prev.log, event.message] }));
      } else if (event.type === 'complete') {
        setBackfill(prev => ({ running: false, log: [...prev.log, event.message] }));
        toast.success('Full backfill complete');
        setRefreshKey(prev => prev + 1);
        refetchStats();
        es.close();
      } else if (event.type === 'error') {
        setBackfill(prev => ({ running: false, log: [...prev.log, `Error: ${event.message}`] }));
        toast.error(event.message);
        es.close();
      }
    };

    es.onerror = () => {
      setBackfill(prev => ({ running: false, log: [...prev.log, 'Connection lost'] }));
      es.close();
    };
  }

  function stopBackfill() {
    if (esRef.current) esRef.current.close();
    setBackfill(prev => ({ running: false, log: [...prev.log, 'Cancelled'] }));
  }

  function updateRow(table, patch) {
    setRows(prev => ({ ...prev, [table]: { ...prev[table], ...patch } }));
  }

  async function handleFetchNew(table) {
    updateRow(table, { loading: true, lastStatus: null });
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network, table }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      const count = data[table] ?? 0;
      const msg = `Synced ${count} new ${table}`;
      toast.success(msg);
      updateRow(table, { lastStatus: msg });
      setRefreshKey(prev => prev + 1);
      refetchStats();
    } catch (err) {
      toast.error(err.message);
      updateRow(table, { lastStatus: `Error: ${err.message}` });
    } finally {
      updateRow(table, { loading: false });
    }
  }

  async function handleRefetchAll(table) {
    updateRow(table, { loading: true, lastStatus: null });
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network, table, full: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Re-fetch failed');
      const count = data[table] ?? 0;
      const msg = `Re-fetched ${count} ${table}`;
      toast.success(msg);
      updateRow(table, { lastStatus: msg });
      setRefreshKey(prev => prev + 1);
      refetchStats();
    } catch (err) {
      toast.error(err.message);
      updateRow(table, { lastStatus: `Error: ${err.message}` });
    } finally {
      updateRow(table, { loading: false });
    }
  }

  async function handleClear(table) {
    updateRow(table, { loading: true, confirmClear: false, lastStatus: null });
    try {
      const res = await fetch('/api/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, network }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clear failed');
      const msg = `Cleared ${data.deleted} ${table}`;
      toast.success(msg);
      updateRow(table, { lastStatus: msg });
      setRefreshKey(prev => prev + 1);
      refetchStats();
    } catch (err) {
      toast.error(err.message);
      updateRow(table, { lastStatus: `Error: ${err.message}` });
    } finally {
      updateRow(table, { loading: false });
    }
  }

  return (
    <div className="insights-page">
      <div className="insights-header">
        <h2 className="insights-title">Data Management</h2>
        <p className="insights-subtitle">
          Sync or clear indexed data per table. Actions affect the current network ({network}).
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {DATA_TABLES.map(({ key, label }) => {
          const row = rows[key];
          return (
            <div
              key={key}
              className="insight-card"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}
            >
              <div style={{ minWidth: '160px' }}>
                <div style={{ fontWeight: 600, color: '#e1e1e6', marginBottom: '4px' }}>
                  {label}
                  {counts[key] !== null && (
                    <span style={{ fontWeight: 400, color: '#888', marginLeft: '8px' }}>
                      ({counts[key].toLocaleString()})
                    </span>
                  )}
                </div>
                {row.lastStatus && (
                  <div style={{ fontSize: '12px', color: '#888' }}>{row.lastStatus}</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="debug-tools-item"
                  style={{ width: 'auto', borderRadius: '8px', border: '1px solid #2a2a3a' }}
                  disabled={row.loading}
                  onClick={() => handleFetchNew(key)}
                >
                  {row.loading ? 'Working...' : 'Fetch New'}
                </button>

                <button
                  className="debug-tools-item"
                  style={{ width: 'auto', borderRadius: '8px', border: '1px solid #2a2a3a' }}
                  disabled={row.loading}
                  onClick={() => handleRefetchAll(key)}
                >
                  {row.loading ? 'Working...' : 'Fetch Most Recent 1,000'}
                </button>

                {!row.confirmClear ? (
                  <button
                    className="debug-tools-item debug-tools-item-danger"
                    style={{ width: 'auto', borderRadius: '8px', border: '1px solid #2a2a3a' }}
                    disabled={row.loading}
                    onClick={() => updateRow(key, { confirmClear: true })}
                  >
                    Clear All
                  </button>
                ) : (
                  <>
                    <span style={{ fontSize: '13px', color: '#f87171' }}>Delete all {label}?</span>
                    <button
                      className="debug-tools-item debug-tools-item-danger"
                      style={{ width: 'auto', borderRadius: '8px', border: '1px solid #ef4444' }}
                      disabled={row.loading}
                      onClick={() => handleClear(key)}
                    >
                      Confirm
                    </button>
                    <button
                      className="debug-tools-item"
                      style={{ width: 'auto', borderRadius: '8px', border: '1px solid #2a2a3a' }}
                      disabled={row.loading}
                      onClick={() => updateRow(key, { confirmClear: false })}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {import.meta.env.DEV && (
        <div className="insight-card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <strong style={{ color: '#e1e1e6', fontSize: '14px' }}>Full Historical Backfill</strong>
              <span style={{ marginLeft: '8px', fontSize: '12px', color: '#f59e0b', background: '#2a1f00', padding: '2px 6px', borderRadius: '4px' }}>dev only</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="debug-tools-item"
                style={{ width: 'auto', borderRadius: '8px', border: '1px solid #2a2a3a' }}
                disabled={backfill.running}
                onClick={startBackfill}
              >
                {backfill.running ? 'Running...' : 'Start Full Backfill'}
              </button>
              {backfill.running && (
                <button
                  className="debug-tools-item debug-tools-item-danger"
                  style={{ width: 'auto', borderRadius: '8px', border: '1px solid #2a2a3a' }}
                  onClick={stopBackfill}
                >
                  Stop
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: backfill.log.length ? '10px' : 0 }}>
            Equivalent to <code>npm run index-data</code> — fetches all historical records (up to 20,000 per table) with no page cap. Takes 10–30 min. Mainnet only.
          </div>
          {backfill.log.length > 0 && (
            <pre style={{
              margin: 0, padding: '10px', background: '#0d0d1a', borderRadius: '6px',
              fontSize: '12px', color: '#a0a0b0', maxHeight: '200px', overflowY: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {backfill.log.join('\n')}
            </pre>
          )}
        </div>
      )}

      <div className="insight-card" style={{ marginTop: '24px', fontSize: '13px', color: '#888' }}>
        <strong style={{ color: '#aaa' }}>Auto-sync:</strong> An incremental "fetch new" for all three tables across both mainnet and testnet runs automatically every 5 minutes — via the Express server on startup and on an interval locally, and via a Vercel cron job in production.
      </div>

      <div className="insight-card" style={{ marginTop: '12px', fontSize: '13px', color: '#888' }}>
        <strong style={{ color: '#aaa' }}>Sync limits:</strong> Both buttons are capped at 1,000 records per run (10 pages × 100). <em>Fetch New</em> only pulls records newer than the latest in the DB. <em>Fetch Most Recent 1,000</em> ignores that cutoff and re-fetches the most recent 1,000 records from scratch — useful to backfill missing fields, but not a full historical sync. For a complete historical backfill, use the Full Historical Backfill button above (dev only) or run <code>npm run index-data</code> from the CLI.
      </div>

      <div className="insight-card" style={{ marginTop: '12px' }}>
        <h3 style={{ color: '#e1e1e6', marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>Data Sources</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a3a' }}>
              <th style={{ textAlign: 'left', padding: '6px 12px 6px 0', color: '#888', fontWeight: 500 }}>Tab</th>
              <th style={{ textAlign: 'left', padding: '6px 12px', color: '#888', fontWeight: 500 }}>Source</th>
              <th style={{ textAlign: 'left', padding: '6px 0 6px 12px', color: '#888', fontWeight: 500 }}>Manageable here?</th>
            </tr>
          </thead>
          <tbody>
            {[
              { tab: 'Perpetual Trades', source: 'trades table', manageable: true },
              { tab: 'LP Deposits',      source: 'deposits table', manageable: true },
              { tab: 'Withdraw Requests', source: 'withdraws table', manageable: true },
              { tab: 'User Stats',       source: 'Computed from trades', manageable: false, note: 'updates when Trades synced' },
              { tab: 'Insights',         source: 'Computed from trades + live GraphQL', manageable: false, note: 'updates when Trades synced' },
              { tab: 'Markets',          source: 'Live GraphQL + cache', manageable: false },
              { tab: 'Collateral Indices', source: 'Live GraphQL + cache', manageable: false },
            ].map(({ tab, source, manageable, note }) => (
              <tr key={tab} style={{ borderBottom: '1px solid #1a1a2a' }}>
                <td style={{ padding: '8px 12px 8px 0', color: '#e1e1e6' }}>{tab}</td>
                <td style={{ padding: '8px 12px', color: '#aaa' }}>{source}</td>
                <td style={{ padding: '8px 0 8px 12px' }}>
                  {manageable
                    ? <span style={{ color: '#4ade80' }}>Yes</span>
                    : <span style={{ color: '#888' }}>No{note ? ` — ${note}` : ''}</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
