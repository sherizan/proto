export type Tier = 'free' | 'plus';

// Mirror of the website's effectiveTier (prototo-website lib/plan.ts): Plus is
// either a paid tier (Stripe webhook sets tier='plus') or a comp grant whose
// plus_until is still in the future — comps live in their own column so a
// webhook flipping tier never clobbers them. Keep the two in sync.
export function effectiveTier(
  row: { tier?: string | null; plus_until?: string | null } | null | undefined,
  nowMs: number = Date.now(),
): Tier {
  if (row?.plus_until && new Date(row.plus_until).getTime() > nowMs) return 'plus';
  return row?.tier === 'plus' ? 'plus' : 'free';
}
