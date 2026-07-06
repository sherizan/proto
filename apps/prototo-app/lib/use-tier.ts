import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { supabase } from './supabase';

export type Tier = 'free' | 'plus';

// Reads the signed-in user's plan from their own profiles row (RLS "own profile read").
// null while loading; anything the DB holds that isn't 'plus' counts as 'free'.
export function useTier(): Tier | null {
  const { session } = useAuth();
  const [tier, setTier] = useState<Tier | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('tier')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setTier(data?.tier === 'plus' ? 'plus' : 'free');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return tier;
}
