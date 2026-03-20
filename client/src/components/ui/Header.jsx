import { BarChart2 } from 'lucide-react';
import { useNetwork } from '../../hooks/useNetwork';

export default function Header() {
  const { network, switchNetwork } = useNetwork();

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon"><BarChart2 size={28} strokeWidth={1.75} /></span>
          <h1>Sai Transaction Explorer</h1>
        </div>
        <div className="header-controls">
          <select
            id="network-select"
            value={network}
            onChange={(e) => switchNetwork(e.target.value)}
            className="network-select"
          >
            <option value="mainnet">Mainnet</option>
            <option value="testnet">Testnet</option>
          </select>
        </div>
      </div>
    </header>
  );
}
