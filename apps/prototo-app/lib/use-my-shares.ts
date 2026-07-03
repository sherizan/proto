import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { fetchMyShares, type MyShare } from './my-shares';

// Shared by both dashboard tabs: My Prototypes renders these; Shared uses them to
// exclude the user's own prototypes from the opened-history.
export function useMyShares() {
  const { session } = useAuth();
  const [shares, setShares] = useState<MyShare[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    const token = session?.access_token;
    if (!token) {
      setStatus('ready');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    fetchMyShares(token).then((res) => {
      if (cancelled) return;
      setShares(res.ok ? res.shares : []);
      setStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  return { shares, status };
}
