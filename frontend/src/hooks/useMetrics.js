import { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';

export const useMetrics = () => {
  const [hostMetrics, setHostMetrics] = useState([]);
  const [containerMetrics, setContainerMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/metrics`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const data = await response.json();
      setHostMetrics(data.host_metrics || []);
      setContainerMetrics(data.container_metrics || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Fetch every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { hostMetrics, containerMetrics, loading, error, refetch: fetchMetrics };
};
