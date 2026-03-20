import { useState, useMemo } from 'react';
import { Info, X, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useChartData } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const PERIODS = [
  { label: 'Last 7 Days', value: '7' },
  { label: 'Last 14 Days', value: '14' },
  { label: 'Last 28 Days', value: '28' },
  { label: 'All Time', value: 'all' },
];

const ASSET_COLORS = [
  { bg: 'rgba(247, 147, 26, 0.85)',  border: 'rgba(247, 147, 26, 1)' },
  { bg: 'rgba(98, 126, 234, 0.85)',  border: 'rgba(98, 126, 234, 1)' },
  { bg: 'rgba(52, 211, 153, 0.85)',  border: 'rgba(52, 211, 153, 1)' },
  { bg: 'rgba(251, 191, 36, 0.85)',  border: 'rgba(251, 191, 36, 1)' },
  { bg: 'rgba(239, 68, 68, 0.85)',   border: 'rgba(239, 68, 68, 1)' },
  { bg: 'rgba(96, 165, 250, 0.85)',  border: 'rgba(96, 165, 250, 1)' },
  { bg: 'rgba(167, 139, 250, 0.85)', border: 'rgba(167, 139, 250, 1)' },
  { bg: 'rgba(244, 114, 182, 0.85)', border: 'rgba(244, 114, 182, 1)' },
];

export default function VolumeChart({ showMethodology = false }) {
  const { network } = useNetwork();
  const [period, setPeriod] = useState('28');
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const { data, loading, error } = useChartData(network, period);

  const volumeByDayByAsset = data?.volumeByDayByAsset || [];
  const volumeByDay = data?.volumeByDay || [];

  const chartData = useMemo(() => {
    if (volumeByDayByAsset.length === 0) {
      // Fallback to aggregate data if breakdown not available
      return {
        labels: volumeByDay.map(d => d.date),
        datasets: [{
          label: 'Volume (USD)',
          data: volumeByDay.map(d => d.volume),
          backgroundColor: 'rgba(139, 92, 246, 0.8)',
          borderColor: 'rgba(139, 92, 246, 1)',
          borderWidth: 1,
        }],
      };
    }

    // Collect sorted unique dates and assets ordered by total volume descending
    const dateSet = new Set();
    const assetTotals = {};
    for (const row of volumeByDayByAsset) {
      dateSet.add(row.date);
      assetTotals[row.asset] = (assetTotals[row.asset] || 0) + row.volume;
    }
    const dates = Array.from(dateSet).sort();
    const assets = Object.keys(assetTotals).sort((a, b) => assetTotals[b] - assetTotals[a]);

    // Build a lookup: { date -> { asset -> volume } }
    const lookup = {};
    for (const row of volumeByDayByAsset) {
      if (!lookup[row.date]) lookup[row.date] = {};
      lookup[row.date][row.asset] = row.volume;
    }

    const datasets = assets.map((asset, i) => {
      const color = ASSET_COLORS[i % ASSET_COLORS.length];
      return {
        label: asset,
        data: dates.map(d => lookup[d]?.[asset] || 0),
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 1,
        stack: 'volume',
      };
    });

    return { labels: dates, datasets };
  }, [volumeByDayByAsset, volumeByDay]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2.5,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        filter: (item) => item.parsed.y > 0,
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: $` + ctx.parsed.y.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          footer: (items) => {
            const total = items.reduce((sum, item) => sum + item.parsed.y, 0);
            return 'Total: $' + total.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: '#888',
          font: { size: 11 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
        grid: { color: '#2a2a3a' },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          color: '#888',
          font: { size: 11 },
          callback: (v) => '$' + v.toLocaleString(),
        },
        grid: { color: '#2a2a3a' },
      },
    },
  }), []);

  const labels = chartData.labels;

  return (
    <div className="chart-section">
      <div className="chart-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <h3 className="chart-title">Daily Trading Volume</h3>
          <button
            className="chart-info-btn"
            onClick={() => setMethodologyOpen(true)}
            aria-label="Volume methodology"
          >
            <Info size={15} />
          </button>
        </div>
        <div className="chart-period-select-wrap">
          <span className="chart-period-select-label">
            {PERIODS.find(p => p.value === period)?.label}
            <ChevronDown size={13} className="chart-period-select-chevron" />
          </span>
          <select
            className="chart-period-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="chart-loading">Loading...</div>}
      {error && <div className="chart-error">Error: {error}</div>}
      {!loading && !error && labels.length === 0 && (
        <div className="chart-empty">No volume data found</div>
      )}
      {!loading && !error && labels.length > 0 && (
        <Bar data={chartData} options={options} />
      )}

      {methodologyOpen && createPortal(
        <div className="modal-overlay" onClick={() => setMethodologyOpen(false)}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Volume Methodology</h2>
              <button className="modal-close" onClick={() => setMethodologyOpen(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-content" style={{ padding: '24px', overflowY: 'auto' }}>
              <div className="methodology-section">
                <h3>How Trading Volume is Calculated</h3>
                <p>
                  Trading volume represents the total <strong>notional value</strong> of all perpetual trades executed on the platform, counted on both the open and close of each position. This matches the methodology used by DeFiLlama and most industry aggregators.
                </p>
              </div>
              <div className="methodology-section">
                <h3>Formula</h3>
                <div className="methodology-formula">
                  Volume = Collateral Amount &times; Leverage
                </div>
                <p>
                  Each trade's notional size is calculated by multiplying the collateral by the leverage used.
                  For example, a $100 collateral position at 10x leverage = $1,000 notional volume per leg.
                  A full round-trip (open + close) contributes $2,000 total.
                </p>
              </div>
              <div className="methodology-section">
                <h3>What's Counted</h3>
                <ul>
                  <li><strong>Position Opens</strong> &mdash; Direct opens and triggered limit/stop orders</li>
                  <li><strong>Position Closes</strong> &mdash; User closes, take profit, and stop loss triggers</li>
                  <li><strong>Liquidations</strong> &mdash; When a position is liquidated</li>
                </ul>
              </div>
              <div className="methodology-section">
                <h3>What's Excluded</h3>
                <ul>
                  <li><strong>TP/SL Updates</strong> &mdash; Parameter changes only, no capital deployed</li>
                  <li><strong>Limit/Stop Order Created/Cancelled</strong> &mdash; Pending orders that haven't executed or were cancelled</li>
                </ul>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
