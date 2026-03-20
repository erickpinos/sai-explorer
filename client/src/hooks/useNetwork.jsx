import { createContext, useContext, useState } from 'react';
import { NETWORK_CONFIG } from '../utils/constants';

const NetworkContext = createContext();

export function NetworkProvider({ children }) {
  const [network, setNetwork] = useState(() => {
    return localStorage.getItem('network') || 'mainnet';
  });

  const switchNetwork = (newNetwork) => {
    setNetwork(newNetwork);
    localStorage.setItem('network', newNetwork);
  };

  const config = NETWORK_CONFIG[network];

  return (
    <NetworkContext.Provider value={{ network, switchNetwork, config }}>
      {children}
    </NetworkContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
}
