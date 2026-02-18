export const NETWORK_CONFIG = {
  mainnet: {
    api: 'https://sai-keeper.nibiru.fi/query',
    explorerTx: 'https://nibiru.explorers.guru/transaction/',
    explorerEvmTx: 'https://nibiscan.io/tx/',
    evmRpc: 'https://evm-rpc.nibiru.fi',
  },
  testnet: {
    api: 'https://sai-keeper.testnet-2.nibiru.fi/query',
    explorerTx: 'https://nibiru.explorers.guru/transaction/',
    explorerEvmTx: 'https://nibiscan.io/tx/',
    evmRpc: 'https://evm-rpc.testnet-2.nibiru.fi',
  },
};

export const TABS = {
  TRADES: 'trades',
  DEPOSITS: 'deposits',
  WITHDRAWS: 'withdraws',
  VOLUME: 'volume',
  MARKETS: 'markets',
  COLLATERAL: 'collateral',
  ACTIVITY: 'activity',
  INSIGHTS: 'insights',
};

export const TRADES_PER_PAGE = 50;
export const DEPOSITS_PER_PAGE = 50;
export const WITHDRAWS_PER_PAGE = 50;
