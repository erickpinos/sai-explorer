import { useEffect, useRef, useState } from 'react';
import { BarChart2, Menu, X } from 'lucide-react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useNetwork } from '../../hooks/useNetwork';
import { TABS } from '../../utils/constants';

const tabs = [
  { id: TABS.TRADES, label: 'Perpetual Trades', path: '/trades' },
  { id: TABS.DEPOSITS, label: 'LP Deposits', path: '/deposits' },
  { id: TABS.WITHDRAWS, label: 'Withdraw Requests', path: '/withdraws' },
  { id: TABS.MARKETS, label: 'Markets', path: '/markets' },
  { id: TABS.COLLATERAL, label: 'Collateral Indices', path: '/collateral' },
  { id: TABS.VOLUME, label: 'User Stats', path: '/volume' },
  { id: TABS.INSIGHTS, label: 'Insights', path: '/insights' },
  { id: TABS.VAULTS, label: 'LP Vaults', path: '/vaults' },
  { id: TABS.PRICES, label: 'Price History', path: '/prices' },
  ...(import.meta.env.DEV ? [{ id: TABS.DB, label: 'DB Tools', path: '/db-tools' }] : []),
];

export default function Header() {
  const { network, switchNetwork } = useNetwork();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <span className="logo-icon"><BarChart2 size={28} strokeWidth={1.75} /></span>
          <h1>Sai Transaction Explorer</h1>
        </Link>
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

          {/* Hamburger — mobile only */}
          <div className="nav-hamburger-wrap" ref={menuRef}>
            <button
              className="nav-hamburger-btn"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={open}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>

            {open && (
              <div className="nav-dropdown">
                {tabs.map((tab) => (
                  <NavLink
                    key={tab.id}
                    to={tab.path}
                    className={({ isActive }) => `nav-dropdown-item${isActive ? ' active' : ''}`}
                  >
                    {tab.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
