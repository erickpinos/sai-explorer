import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { TAB_LABELS } from './utils/constants';
import { Toaster } from 'react-hot-toast';
import { NetworkProvider } from './hooks/useNetwork';
import Header from './components/ui/Header';
import Stats from './components/ui/Stats';
import Tabs from './components/ui/Tabs';
import FunFacts from './components/ui/FunFacts';
import LoadingSpinner from './components/ui/LoadingSpinner';
import UserProfileModal from './components/modals/UserProfileModal';
import TradeDetailModal from './components/modals/TradeDetailModal';
import VaultDetailModal from './components/modals/VaultDetailModal';
import ErrorBoundary from './components/ui/ErrorBoundary';
import './App.css';

const TradesTable = lazy(() => import('./components/tables/TradesTable'));
const DepositsTable = lazy(() => import('./components/tables/DepositsTable'));
const WithdrawsTable = lazy(() => import('./components/tables/WithdrawsTable'));
const VolumeTable = lazy(() => import('./components/tables/VolumeTable'));
const MarketsTable = lazy(() => import('./components/tables/MarketsTable'));
const CollateralTable = lazy(() => import('./components/tables/CollateralTable'));
const InsightsPage = lazy(() => import('./components/InsightsPage'));
const LpVaultsTable = lazy(() => import('./components/tables/LpVaultsTable'));
const DataManagementPage = lazy(() => import('./components/DataManagementPage'));
const CoinGeckoPricesTable = lazy(() => import('./components/tables/CoinGeckoPricesTable'));

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

function TradeDetailRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const background = location.state?.background;
  const trade = location.state?.trade;

  if (!trade) {
    navigate('/trades', { replace: true });
    return null;
  }

  return (
    <TradeDetailModal
      trade={trade}
      onClose={() => background ? navigate(-1) : navigate('/trades')}
    />
  );
}

function VaultDetailRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const background = location.state?.background;
  const vault = location.state?.vault;

  if (!vault) {
    navigate('/vaults', { replace: true });
    return null;
  }

  return (
    <VaultDetailModal
      vault={vault}
      onClose={() => background ? navigate(-1) : navigate('/vaults')}
    />
  );
}

function AppContent() {
  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);

  const background = location.state?.background;

  // When showing a modal, render the background tab (or /trades if navigated directly)
  const contentLocation = background || (
    location.pathname.startsWith('/vault/')
      ? { pathname: '/vaults' }
      : (location.pathname.startsWith('/user/') || location.pathname.startsWith('/trade/'))
        ? { pathname: '/trades' }
        : null
  );

  return (
    <div className="app">
      <Header />

      <div className="disclaimer-banner">
        Values shown are estimates. For official stats, visit{' '}
        <a href="https://defillama.com/protocol/sai" target="_blank" rel="noopener noreferrer">DefiLlama</a>.
      </div>

      <div className="container">
        <ErrorBoundary title="Failed to load stats">
          <Stats key={`stats-${refreshKey}`} />
        </ErrorBoundary>

        <ErrorBoundary title="Failed to load fun facts">
          <FunFacts key={`funfacts-${refreshKey}`} />
        </ErrorBoundary>

        <Tabs />

        {TAB_LABELS[location.pathname] && (
          <h2 className="page-title">{TAB_LABELS[location.pathname]}</h2>
        )}

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
              <Route path="/vaults" element={<LpVaultsTable key={`vaults-${refreshKey}`} />} />
              <Route path="/prices" element={<CoinGeckoPricesTable key={`prices-${refreshKey}`} />} />
              {import.meta.env.DEV && <Route path="/db-tools" element={<DataManagementPage setRefreshKey={setRefreshKey} />} />}
              <Route path="/user/:address" element={<Navigate to="/trades" replace />} />
              <Route path="/trade/:id" element={<Navigate to="/trades" replace />} />
              <Route path="/vault/:address" element={<Navigate to="/vaults" replace />} />
              <Route path="*" element={<Navigate to="/trades" replace />} />
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
        <Route path="/trade/:id" element={<TradeDetailRoute />} />
        <Route path="/vault/:address" element={<VaultDetailRoute />} />
        <Route path="*" element={null} />
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
