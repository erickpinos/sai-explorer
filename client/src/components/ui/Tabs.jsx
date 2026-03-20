import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { TABS } from '../../utils/constants';
import { Menu, X } from 'lucide-react';

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

export default function Tabs() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef(null);

  const activeTab = tabs.find((t) => location.pathname === t.path || location.pathname.startsWith(t.path + '/'));

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
    <>
      {/* Desktop tabs */}
      <div className="tabs tabs-desktop">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.path}
            className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Mobile hamburger */}
      <div className="tabs-mobile" ref={menuRef}>
        <button
          className="tabs-hamburger"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
          <span className="tabs-hamburger-label">{activeTab?.label ?? 'Menu'}</span>
        </button>

        {open && (
          <div className="tabs-dropdown">
            {tabs.map((tab) => (
              <NavLink
                key={tab.id}
                to={tab.path}
                className={({ isActive }) => `tabs-dropdown-item${isActive ? ' active' : ''}`}
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
