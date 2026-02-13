import { useNetwork } from '../../hooks/useNetwork';

export default function Header({ onFetchNew, onRefetchAll, syncing = false }) {
  const { network, switchNetwork } = useNetwork();

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">📊</span>
          <h1>Sai Explorer</h1>
        </div>
        <div className="header-controls">
          <button
            onClick={onFetchNew}
            className="btn btn-primary"
            style={{ marginRight: '10px' }}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Fetch New Transactions'}
          </button>
          <button
            onClick={onRefetchAll}
            className="btn btn-secondary"
            style={{ marginRight: '10px' }}
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
