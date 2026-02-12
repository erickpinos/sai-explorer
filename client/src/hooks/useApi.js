import { useState, useEffect } from 'react';

export function useApi(endpoint, network = 'mainnet', options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { limit = 5000, autoFetch = true } = options;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = `/api/${endpoint}?network=${network}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error(`Error fetching ${endpoint}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [endpoint, network, limit, autoFetch]);

  return { data, loading, error, refetch: fetchData };
}

export function useTrades(network) {
  return useApi('trades', network);
}

export function useDeposits(network) {
  return useApi('deposits', network);
}

export function useWithdraws(network) {
  return useApi('withdraws', network);
}

export function useStats(network) {
  return useApi('stats', network);
}
