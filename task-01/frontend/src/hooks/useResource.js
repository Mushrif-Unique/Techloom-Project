import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';
export function useResource(path, interval = 15000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const result = await api(path);
      if (current === sequence.current) {
        setData(result);
        setError('');
      }
      return result;
    } catch (error) {
      if (current === sequence.current) setError(error.message);
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setData(null);
    setLoading(true);
    reload();
    const timer = setInterval(reload, interval);
    const requestSequence = sequence;
    return () => {
      clearInterval(timer);
      requestSequence.current++;
    };
  }, [reload, interval]);
  return { data, error, loading, reload };
}
