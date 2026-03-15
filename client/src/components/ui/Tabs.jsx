import { NavLink } from 'react-router-dom';
import { TABS } from '../../utils/constants';

const tabs = [
  { id: TABS.TRADES, label: 'Perpetual Trades', path: '/trades' },
  { id: TABS.DEPOSITS, label: 'LP Deposits', path: '/deposits' },
  { id: TABS.WITHDRAWS, label: 'Withdraw Requests', path: '/withdraws' },
  { id: TABS.MARKETS, label: 'Markets', path: '/markets' },
  { id: TABS.COLLATERAL, label: 'Collateral Indices', path: '/collateral' },
  { id: TABS.VOLUME, label: 'User Stats', path: '/volume' },
  { id: TABS.INSIGHTS, label: 'Insights', path: '/insights' },
];

export default function Tabs() {
  return (
    <div className="tabs">
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
  );
}
