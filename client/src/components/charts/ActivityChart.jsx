import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
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

export default function ActivityChart() {
  const { network } = useNetwork();
  const [period, setPeriod] = useState('28');
  const { data, loading, error } = useChartData(network, period);

  const chartData = useMemo(() => {
    const activity = data?.activity || [];
    const tradesByDayByAsset = data?.tradesByDayByAsset || [];

    // Build deposit dataset from activity (keyed by date)
    const depositsByDate = {};
    for (const row of activity) depositsByDate[row.date] = row.deposits;

    if (tradesByDayByAsset.length === 0) {
      return {
        labels: activity.map(d => d.date),
        datasets: [
          {
            label: 'Perpetual Trades',
            data: activity.map(d => d.trades),
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            borderColor: 'rgba(99, 102, 241, 1)',
            borderWidth: 1,
            stack: 'trades',
          },
          {
            label: 'LP Deposits',
            data: activity.map(d => d.deposits),
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 1,
            stack: 'deposits',
          },
        ],
      };
    }

    // Collect sorted unique dates and assets ordered by total trade count descending
    const dateSet = new Set();
    const assetTotals = {};
    for (const row of tradesByDayByAsset) {
      dateSet.add(row.date);
      assetTotals[row.asset] = (assetTotals[row.asset] || 0) + row.trades;
    }
    const dates = Array.from(dateSet).sort();
    const assets = Object.keys(assetTotals).sort((a, b) => assetTotals[b] - assetTotals[a]);

    // Build lookup: { date -> { asset -> tradeCount } }
    const lookup = {};
    for (const row of tradesByDayByAsset) {
      if (!lookup[row.date]) lookup[row.date] = {};
      lookup[row.date][row.asset] = row.trades;
    }

    const assetDatasets = assets.map((asset, i) => {
      const color = ASSET_COLORS[i % ASSET_COLORS.length];
      return {
        label: asset,
        data: dates.map(d => lookup[d]?.[asset] || 0),
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 1,
        stack: 'trades',
      };
    });

    const depositDataset = {
      label: 'LP Deposits',
      data: dates.map(d => depositsByDate[d] || 0),
      backgroundColor: 'rgba(34, 197, 94, 0.8)',
      borderColor: 'rgba(34, 197, 94, 1)',
      borderWidth: 1,
      stack: 'deposits',
    };

    return { labels: dates, datasets: [...assetDatasets, depositDataset] };
  }, [data]);

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
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}`,
          footer: (items) => {
            const tradeTotal = items
              .filter(i => i.dataset.stack === 'trades')
              .reduce((sum, i) => sum + i.parsed.y, 0);
            return tradeTotal > 0 ? `Total Trades: ${tradeTotal.toLocaleString()}` : '';
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
          precision: 0,
        },
        grid: { color: '#2a2a3a' },
      },
    },
  }), []);

  const labels = chartData.labels;

  return (
    <div className="chart-section">
      <div className="chart-header">
        <h3 className="chart-title">Daily Activity</h3>
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
        <div className="chart-empty">No activity data found</div>
      )}
      {!loading && !error && labels.length > 0 && (
        <Bar data={chartData} options={options} />
      )}
    </div>
  );
}
