import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { supabase } from './supabase';
import { effectiveTier, type Tier } from './tier';

export type { Tier } from './tier';

// Reads the signed-in user's plan from their own profiles row (RLS "own profile read").
// null while loading.
export function useTier(): Tier | null {
  const { session } = useAuth();
  const [tier, setTier] = useState<Tier | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('tier, plus_until')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setTier(effectiveTier(data));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return tier;
}
