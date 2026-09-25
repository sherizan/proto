// Plus bought through the App Store (#67). The server verifies every purchase
// and owns the plan; the app only asks what it is. A purchase is finished once
// the server has answered for good (ok or a final 4xx); an unreachable server
// leaves it open so StoreKit hands it back on the next launch.

const API_BASE = 'https://prototo.app';
type Opts = { fetch?: typeof fetch; baseUrl?: string };

export const PLUS_SKUS = ['plus.monthly', 'plus.annual'] as const;
export type PlusStatus = { plus: boolean; via: 'apple' | 'web' | null };
export type ConfirmResult = 'ok' | 'rejected' | 'retry';

export async function fetchPlusStatus(accessToken: string, opts: Opts = {}): Promise<PlusStatus | null> {
  try {
    const res = await (opts.fetch ?? fetch)(`${opts.baseUrl ?? API_BASE}/api/billing/apple`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok ? ((await res.json()) as PlusStatus) : null;
  } catch {
    return null;
  }
}

export async function confirmPurchase(
  accessToken: string,
  signedTransaction: string,
  opts: Opts = {},
): Promise<ConfirmResult> {
  try {
    const res = await (opts.fetch ?? fetch)(`${opts.baseUrl ?? API_BASE}/api/billing/apple`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedTransaction }),
    });
    if (res.ok) return 'ok';
    return res.status >= 400 && res.status < 500 ? 'rejected' : 'retry';
  } catch {
    return 'retry';
  }
}

export async function settlePurchase(
  purchase: { productId: string; purchaseToken?: string | null },
  accessToken: string,
  deps: { confirm: typeof confirmPurchase; finish: () => Promise<unknown> },
): Promise<ConfirmResult> {
  if (!(PLUS_SKUS as readonly string[]).includes(purchase.productId) || !purchase.purchaseToken) return 'retry';
  const result = await deps.confirm(accessToken, purchase.purchaseToken);
  if (result !== 'retry') await deps.finish();
  return result;
}
