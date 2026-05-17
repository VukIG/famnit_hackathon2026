import { useState, useCallback } from 'react';
import { fetchPrediction } from '../api/predict';

// Stateful wrapper around the prediction API.
export function useForecast() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (date, time) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPrediction(date, time);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, load };
}
