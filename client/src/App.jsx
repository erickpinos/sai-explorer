import { useState, lazy, Suspense } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { NetworkProvider, useNetwork } from './hooks/useNetwork';
import Header from './components/ui/Header';
import Stats from './components/ui/Stats';
import Tabs from './components/ui/Tabs';
import FunFacts from './components/ui/FunFacts';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { TABS } from './utils/constants';
import './App.css';

const TradesTable = lazy(() => import('./components/tables/TradesTable'));
const DepositsTable = lazy(() => import('./components/tables/DepositsTable'));
const WithdrawsTable = lazy(() => import('./components/tables/WithdrawsTable'));
const VolumeTable = lazy(() => import('./components/tables/VolumeTable'));
const MarketsTable = lazy(() => import('./components/tables/MarketsTable'));
const CollateralTable = lazy(() => import('./components/tables/CollateralTable'));
const InsightsPage = lazy(() => import('./components/InsightsPage'));

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
        toast.success(`Synced ${result.trades} trades, ${result.deposits} deposits, ${result.withdraws} withdraws`);
        // Trigger refresh of all data
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error('Sync failed. Check console for details.');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Sync failed: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleRefetchAll = async () => {
    // For now, just trigger the same sync
    // In future, could call a different endpoint that does full re-index
    await handleFetchNew();
  };

  const wrapTab = (key, child) => (
    <ErrorBoundary key={key} title={`Failed to load ${activeTab} tab`}>
      {child}
    </ErrorBoundary>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.TRADES:
        return wrapTab(`trades-eb-${refreshKey}`, <TradesTable key={`trades-${refreshKey}`} />);
      case TABS.DEPOSITS:
        return wrapTab(`deposits-eb-${refreshKey}`, <DepositsTable key={`deposits-${refreshKey}`} />);
      case TABS.WITHDRAWS:
        return wrapTab(`withdraws-eb-${refreshKey}`, <WithdrawsTable key={`withdraws-${refreshKey}`} />);
      case TABS.VOLUME:
        return wrapTab(`volume-eb-${refreshKey}`, <VolumeTable key={`volume-${refreshKey}`} />);
      case TABS.MARKETS:
        return wrapTab(`markets-eb-${refreshKey}`, <MarketsTable key={`markets-${refreshKey}`} />);
      case TABS.COLLATERAL:
        return wrapTab(`collateral-eb-${refreshKey}`, <CollateralTable key={`collateral-${refreshKey}`} />);
      case TABS.INSIGHTS:
        return wrapTab(`insights-eb-${refreshKey}`, <InsightsPage key={`insights-${refreshKey}`} />);
      default:
        return wrapTab(`trades-default-eb-${refreshKey}`, <TradesTable key={`trades-default-${refreshKey}`} />);
    }
  };

  return (
    <div className="app">
      <Header onFetchNew={handleFetchNew} onRefetchAll={handleRefetchAll} syncing={syncing} />

      <div className="disclaimer-banner">
        Values shown are estimates. For official stats, visit{' '}
        <a href="https://defillama.com/protocol/sai" target="_blank" rel="noopener noreferrer">DefiLlama</a>.
      </div>

      <div className="container">
        <ErrorBoundary title="Failed to load stats">
          <Stats key={`stats-${refreshKey}`} />
        </ErrorBoundary>

        <ErrorBoundary title="Failed to load fun facts">
          <FunFacts key={`funfacts-${refreshKey}`} onNavigateToInsights={setActiveTab} />
        </ErrorBoundary>

        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="content">
          <Suspense fallback={<LoadingSpinner />}>
            {renderTabContent()}
          </Suspense>
        </div>
      </div>

      <footer className="footer">
        <Toaster position="bottom-right" />
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
