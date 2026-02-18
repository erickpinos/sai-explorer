import { useNetwork } from '../../hooks/useNetwork';

export default function Header({ onFetchNew, onRefetchAll, syncing = false }) {
  const { network, switchNetwork } = useNetwork();

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">📊</span>
          <h1>Sai Transaction Explorer</h1>
        </div>
        <div className="header-controls">
          <button
            onClick={onFetchNew}
            className="fetch-btn fetch-new-btn"
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Fetch New Transactions'}
          </button>
          <button
            onClick={onRefetchAll}
            className="fetch-btn fetch-all-btn"
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Re-Fetch All Transactions'}
          </button>
          <select
            id="network-select"
            value={network}
            onChange={(e) => switchNetwork(e.target.value)}
            className="network-select"
            disabled={syncing}
          >
            <option value="mainnet">Mainnet</option>
            <option value="testnet">Testnet</option>
          </select>
        </div>
      </div>
    </header>
  );
}
