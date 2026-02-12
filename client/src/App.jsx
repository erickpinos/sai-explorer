import { useState } from 'react';
import { NetworkProvider } from './hooks/useNetwork';
import Header from './components/ui/Header';
import Stats from './components/ui/Stats';
import Tabs from './components/ui/Tabs';
import TradesTable from './components/tables/TradesTable';
import DepositsTable from './components/tables/DepositsTable';
import WithdrawsTable from './components/tables/WithdrawsTable';
import VolumeTable from './components/tables/VolumeTable';
import MarketsTable from './components/tables/MarketsTable';
import CollateralTable from './components/tables/CollateralTable';
import ActivityChart from './components/charts/ActivityChart';
import VolumeChart from './components/charts/VolumeChart';
import { TABS } from './utils/constants';
import './App.css';

function AppContent() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('sai_explorer_current_tab') || TABS.TRADES;
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.TRADES:
        return <TradesTable />;
      case TABS.DEPOSITS:
        return <DepositsTable />;
      case TABS.WITHDRAWS:
        return <WithdrawsTable />;
      case TABS.VOLUME:
        return <VolumeTable />;
      case TABS.MARKETS:
        return <MarketsTable />;
      case TABS.COLLATERAL:
        return <CollateralTable />;
      case TABS.ACTIVITY:
        return (
          <div id="chart-container">
            <ActivityChart />
            <VolumeChart />
          </div>
        );
      default:
        return <TradesTable />;
    }
  };

  return (
    <div className="app">
      <Header />

      <div className="container">
        <Stats />

        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="content">
          {renderTabContent()}
        </div>
      </div>

      <footer className="footer">
        <p>Sai Explorer - Blockchain transaction viewer</p>
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
