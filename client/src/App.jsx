import { useState } from 'react';
import { NetworkProvider, useNetwork } from './hooks/useNetwork';
import Header from './components/ui/Header';
import Stats from './components/ui/Stats';
import Tabs from './components/ui/Tabs';
import TradesTable from './components/tables/TradesTable';
import DepositsTable from './components/tables/DepositsTable';
import WithdrawsTable from './components/tables/WithdrawsTable';
import VolumeTable from './components/tables/VolumeTable';
import MarketsTable from './components/tables/MarketsTable';
import CollateralTable from './components/tables/CollateralTable';
import FunFacts from './components/ui/FunFacts';
import InsightsPage from './components/InsightsPage';
import { TABS } from './utils/constants';
import './App.css';

function AppContent() {
  const { network } = useNetwork();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('sai_explorer_current_tab') || TABS.TRADES;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const handleFetchNew = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Sync completed:', result);
        alert(`Synced ${result.trades} trades, ${result.deposits} deposits, ${result.withdraws} withdraws`);
        // Trigger refresh of all data
        setRefreshKey(prev => prev + 1);
      } else {
        alert('Sync failed. Check console for details.');
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Sync failed: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleRefetchAll = async () => {
    // For now, just trigger the same sync
    // In future, could call a different endpoint that does full re-index
    await handleFetchNew();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.TRADES:
        return <TradesTable key={`trades-${refreshKey}`} />;
      case TABS.DEPOSITS:
        return <DepositsTable key={`deposits-${refreshKey}`} />;
      case TABS.WITHDRAWS:
        return <WithdrawsTable key={`withdraws-${refreshKey}`} />;
      case TABS.VOLUME:
        return <VolumeTable key={`volume-${refreshKey}`} />;
      case TABS.MARKETS:
        return <MarketsTable key={`markets-${refreshKey}`} />;
      case TABS.COLLATERAL:
        return <CollateralTable key={`collateral-${refreshKey}`} />;
      case TABS.INSIGHTS:
        return <InsightsPage key={`insights-${refreshKey}`} />;
      default:
        return <TradesTable key={`trades-default-${refreshKey}`} />;
    }
  };

  return (
    <div className="app">
      <Header onFetchNew={handleFetchNew} onRefetchAll={handleRefetchAll} syncing={syncing} />

      <div className="container">
        <Stats key={`stats-${refreshKey}`} />

        <FunFacts key={`funfacts-${refreshKey}`} onNavigateToInsights={setActiveTab} />

        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="content">
          {renderTabContent()}
        </div>
      </div>

      <footer className="footer">
        <p>Sai Transaction Explorer - Blockchain transaction viewer</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <NetworkProvider>
      <AppContent />
    </NetworkProvider>
  );
}
