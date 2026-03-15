import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { NetworkProvider, useNetwork } from './hooks/useNetwork';
import Header from './components/ui/Header';
import Stats from './components/ui/Stats';
import Tabs from './components/ui/Tabs';
import FunFacts from './components/ui/FunFacts';
import LoadingSpinner from './components/ui/LoadingSpinner';
import UserProfileModal from './components/modals/UserProfileModal';
import './App.css';

const TradesTable = lazy(() => import('./components/tables/TradesTable'));
const DepositsTable = lazy(() => import('./components/tables/DepositsTable'));
const WithdrawsTable = lazy(() => import('./components/tables/WithdrawsTable'));
const VolumeTable = lazy(() => import('./components/tables/VolumeTable'));
const MarketsTable = lazy(() => import('./components/tables/MarketsTable'));
const CollateralTable = lazy(() => import('./components/tables/CollateralTable'));
const InsightsPage = lazy(() => import('./components/InsightsPage'));

function UserProfileRoute() {
  const { address } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const background = location.state?.background;

  return (
    <UserProfileModal
      address={address}
      onClose={() => background ? navigate(-1) : navigate('/trades')}
    />
  );
}

function AppContent() {
  const { network } = useNetwork();
  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const background = location.state?.background;

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
    await handleFetchNew();
  };

  // When showing user modal, render the background tab (or /trades if navigated directly)
  const contentLocation = background || (location.pathname.startsWith('/user/') ? { pathname: '/trades' } : null);

  return (
    <div className="app">
      <Header onFetchNew={handleFetchNew} onRefetchAll={handleRefetchAll} syncing={syncing} />

      <div className="disclaimer-banner">
        Values shown are estimates. For official stats, visit{' '}
        <a href="https://defillama.com/protocol/sai" target="_blank" rel="noopener noreferrer">DefiLlama</a>.
      </div>

      <div className="container">
        <Stats key={`stats-${refreshKey}`} />

        <FunFacts key={`funfacts-${refreshKey}`} />

        <Tabs />

        <div className="content">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes location={contentLocation || location}>
              <Route path="/" element={<Navigate to="/trades" replace />} />
              <Route path="/trades" element={<TradesTable key={`trades-${refreshKey}`} />} />
              <Route path="/deposits" element={<DepositsTable key={`deposits-${refreshKey}`} />} />
              <Route path="/withdraws" element={<WithdrawsTable key={`withdraws-${refreshKey}`} />} />
              <Route path="/volume" element={<VolumeTable key={`volume-${refreshKey}`} />} />
              <Route path="/markets" element={<MarketsTable key={`markets-${refreshKey}`} />} />
              <Route path="/collateral" element={<CollateralTable key={`collateral-${refreshKey}`} />} />
              <Route path="/insights" element={<InsightsPage key={`insights-${refreshKey}`} />} />
              <Route path="/user/:address" element={<Navigate to="/trades" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>

      <footer className="footer">
        <Toaster position="bottom-right" />
        <p>Sai Transaction Explorer - Blockchain transaction viewer</p>
      </footer>

      <Routes>
        <Route path="/user/:address" element={<UserProfileRoute />} />
      </Routes>
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
