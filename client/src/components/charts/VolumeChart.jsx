import { useState, useMemo } from 'react';
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

export default function VolumeChart({ showMethodology = false }) {
  const { network } = useNetwork();
  const [period, setPeriod] = useState('28');
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const { data, loading, error } = useChartData(network, period);

  const volumeByDay = data?.volumeByDay || [];

  const chartData = useMemo(() => ({
    labels: volumeByDay.map(d => d.date),
    datasets: [
      {
        label: 'Trading Volume (USD)',
        data: volumeByDay.map(d => d.volume),
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      },
    ],
  }), [volumeByDay]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2.5,
    plugins: {
      legend: {
        labels: {
          color: '#e1e1e6',
          font: { size: 12 },
          padding: 10,
          boxWidth: 15,
          boxHeight: 15,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            'Volume: $' + ctx.parsed.y.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
        },
      },
    },
    scales: {
      x: {
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
        <h3 className="chart-title">Daily Trading Volume</h3>
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

      {loading && <div className="chart-loading">Loading...</div>}
      {error && <div className="chart-error">Error: {error}</div>}
      {!loading && !error && labels.length === 0 && (
        <div className="chart-empty">No volume data found</div>
      )}
      {!loading && !error && labels.length > 0 && (
        <Bar data={chartData} options={options} />
      )}

      {showMethodology && (
        <div className="volume-methodology-dropdown">
          <button
            className="volume-methodology-toggle"
            onClick={() => setMethodologyOpen(o => !o)}
          >
            <span>Volume Methodology</span>
            <span className="volume-methodology-chevron">{methodologyOpen ? '▲' : '▼'}</span>
          </button>
          {methodologyOpen && (
            <div className="volume-methodology-body">
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
          )}
        </div>
      )}
    </div>
  );
}
