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

export function useInsights(network) {
  return useApi('insights', network);
}

export function useTvlBreakdown(network) {
  return useApi('tvl-breakdown', network);
}

// User-specific hooks
export function useUserStats(address, network = 'mainnet') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!address) return;

    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = `/api/user-stats?network=${network}&address=${encodeURIComponent(address)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch user stats');
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching user stats:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [address, network]);

  return { data, loading, error };
}

export function useUserTrades(address, network = 'mainnet') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!address) return;

    const fetchTrades = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = `/api/user-trades?network=${network}&address=${encodeURIComponent(address)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch user trades');
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching user trades:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
  }, [address, network]);

  return { data, loading, error };
}

export function useUserDeposits(address, network = 'mainnet') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!address) return;

    const fetchDeposits = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = `/api/user-deposits?network=${network}&address=${encodeURIComponent(address)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch user deposits');
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching user deposits:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDeposits();
  }, [address, network]);

  return { data, loading, error };
}

export function useUserWithdraws(address, network = 'mainnet') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!address) return;

    const fetchWithdraws = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = `/api/user-withdraws?network=${network}&address=${encodeURIComponent(address)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch user withdraws');
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching user withdraws:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWithdraws();
  }, [address, network]);

  return { data, loading, error };
}
