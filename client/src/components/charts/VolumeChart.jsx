import { useState } from 'react';
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

export default function VolumeChart() {
  const { network } = useNetwork();
  const [period, setPeriod] = useState('28');
  const { data, loading, error } = useChartData(network, period);

  const volumeByDay = data?.volumeByDay || [];
  const labels = volumeByDay.map(d => d.date);
  const values = volumeByDay.map(d => d.volume);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Trading Volume (USD)',
        data: values,
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
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
  };

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
    </div>
  );
}
