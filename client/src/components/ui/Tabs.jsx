import { TABS } from '../../utils/constants';
import { useState, useEffect } from 'react';

export default function Tabs({ activeTab, onTabChange }) {
  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('sai_explorer_current_tab', activeTab);
  }, [activeTab]);

  const tabs = [
    { id: TABS.TRADES, label: 'Perpetual Trades' },
    { id: TABS.DEPOSITS, label: 'LP Deposits' },
    { id: TABS.WITHDRAWS, label: 'Withdraw Requests' },
    { id: TABS.VOLUME, label: 'User Stats' },
    { id: TABS.MARKETS, label: 'Markets' },
    { id: TABS.COLLATERAL, label: 'Collateral Indices' },
    { id: TABS.ACTIVITY, label: 'Activity Chart' },
    { id: TABS.INSIGHTS, label: 'Insights' },
  ];

  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
