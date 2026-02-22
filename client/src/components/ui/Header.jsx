import { useState, useRef, useEffect } from 'react';
import { useNetwork } from '../../hooks/useNetwork';

export default function Header({ onFetchNew, onRefetchAll, syncing = false }) {
  const { network, switchNetwork } = useNetwork();
  const [toolsOpen, setToolsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">📊</span>
          <h1>Sai Transaction Explorer</h1>
        </div>
        <div className="header-controls">
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
          <div className="debug-tools-wrapper" ref={menuRef}>
            <button
              className="debug-tools-toggle"
              onClick={() => setToolsOpen(!toolsOpen)}
              title="Debug Tools"
            >
              🔧
            </button>
            {toolsOpen && (
              <div className="debug-tools-menu">
                <button
                  onClick={() => { onFetchNew(); setToolsOpen(false); }}
                  className="debug-tools-item"
                  disabled={syncing}
                >
                  {syncing ? 'Syncing...' : 'Fetch New Transactions'}
                </button>
                <button
                  onClick={() => { onRefetchAll(); setToolsOpen(false); }}
                  className="debug-tools-item debug-tools-item-danger"
                  disabled={syncing}
                >
                  {syncing ? 'Syncing...' : 'Re-Fetch All Transactions'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
