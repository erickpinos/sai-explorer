import { useEffect, useRef, useState } from 'react';
import { BarChart2, Menu, X, ChevronDown } from 'lucide-react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useNetwork } from '../../hooks/useNetwork';
import { TABS } from '../../utils/constants';

const NAV_CATEGORIES = [
  {
    label: 'Activity',
    items: [
      { id: TABS.TRADES,    label: 'Perpetual Trades',  path: '/trades' },
      { id: TABS.DEPOSITS,  label: 'LP Deposits',        path: '/deposits' },
      { id: TABS.WITHDRAWS, label: 'Withdraw Requests',  path: '/withdraws' },
      { id: TABS.VOLUME,    label: 'User Stats',         path: '/volume' },
    ],
  },
  {
    label: 'Markets',
    items: [
      { id: TABS.MARKETS,    label: 'Markets',            path: '/markets' },
      { id: TABS.COLLATERAL, label: 'Collateral Indices', path: '/collateral' },
      { id: TABS.PRICES,     label: 'Price History',      path: '/prices' },
    ],
  },
  {
    label: 'Vaults',
    items: [
      { id: TABS.VAULTS, label: 'LP Vaults', path: '/vaults' },
    ],
  },
  ...(import.meta.env.DEV ? [{
    label: 'Dev Tools',
    items: [
      { id: TABS.DB, label: 'DB Tools', path: '/db-tools' },
    ],
  }] : []),
];

function NavCategory({ category }) {
  const location = useLocation();
  const isAnyActive = category.items.some(item => location.pathname === item.path);

  return (
    <div className="nav-category">
      <button className={`nav-category-btn${isAnyActive ? ' active' : ''}`}>
        {category.label}
        <ChevronDown size={12} className="nav-category-chevron" />
      </button>
      <div className="nav-category-dropdown">
        {category.items.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `nav-dropdown-item${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function Header() {
  const { network, switchNetwork } = useNetwork();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const mobileItems = NAV_CATEGORIES.flatMap(c => c.items);

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

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <span className="logo-icon"><BarChart2 size={28} strokeWidth={1.75} /></span>
          <h1>Sai Transaction Explorer</h1>
        </Link>

        {/* Desktop nav — category dropdowns */}
        <nav className="nav-desktop">
          {NAV_CATEGORIES.map((cat) => (
            <NavCategory key={cat.label} category={cat} />
          ))}
        </nav>

        <div className="header-controls">
          <div className="network-select-wrap">
            <span className="network-select-label">
              {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
              <ChevronDown size={13} className="network-select-chevron" />
            </span>
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
                {mobileItems.map((tab) => (
                  <NavLink
                    key={tab.id}
                    to={tab.path}
                    onClick={() => setOpen(false)}
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
