import { z } from 'zod';

export const SHARE_API_BASE_DEFAULT = 'https://prototo.app';

// The CLI provides a stable client-minted token (see share-token) and the
// dev-client deep link that loads the published EAS Update on Appetize. The
// server upserts { token -> deepLink } and serves prototo.app/p/<token>.
export const ShareCreateInputSchema = z.object({
  token: z.string().min(5).max(40),
  designerName: z.string().min(1).max(60),
  appName: z.string().min(1).max(60),
  deepLink: z.string().min(1).max(600),
});

export const ShareCreateResponseSchema = z.object({
  url: z.string().url(),
  // Legacy: links are permanent since the pricing relaunch; the server still
  // sends a far-future stamp for older CLIs. Tolerate its absence.
  expiresAt: z.string().min(1).optional(),
});

export const SharePreflightResponseSchema = z.object({
  allowed: z.boolean(),
  tier: z.string(),
  // Frozen legacy fields (the count cap is gone); kept while old CLIs validate them.
  activeProjects: z.number(),
  projectCap: z.number(),
  // Why a block was returned; today only 'trial_expired'.
  reason: z.string().optional(),
});
export type SharePreflightResponse = z.infer<typeof SharePreflightResponseSchema>;

export const ShareLookupResponseSchema = z.object({
  designerName: z.string(),
  appName: z.string(),
  deepLink: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export type ShareCreateInput = {
  token: string;
  designerName: string;
  appName: string;
  deepLink: string;
};
export type ShareCreateResponse = z.infer<typeof ShareCreateResponseSchema>;
export type ShareLookupResponse = z.infer<typeof ShareLookupResponseSchema>;

export type ShareApiErrorKind =
  | 'network'
  | 'bad-input'
  | 'rate-limited'
  | 'not-found'
  | 'unauthorized'
  | 'trial-expired'
  | 'owner-mismatch'
  | 'server'
  | 'bad-response';

export class ShareApiError extends Error {
  readonly kind: ShareApiErrorKind;
  constructor(kind: ShareApiErrorKind, message: string) {
    super(message);
    this.name = 'ShareApiError';
    this.kind = kind;
  }
}

export type ShareApiOptions = {
  fetch?: typeof fetch;
  baseUrl?: string;
  /** The account token from `proto login`; sent as `Authorization: Bearer`. */
  token?: string;
};

function resolveBaseUrl(opts: ShareApiOptions): string {
  if (opts.baseUrl) return opts.baseUrl;
  const env = process.env.PROTO_SHARE_API_BASE;
  return env && env.length > 0 ? env : SHARE_API_BASE_DEFAULT;
}

/** The web account page (library, billing management). */
export function accountUrl(opts: ShareApiOptions = {}): string {
  return `${resolveBaseUrl(opts)}/account`;
}

/** The upgrade page the CLI opens when a designer's Publish trial has ended. */
export function pricingUrl(opts: ShareApiOptions = {}): string {
  return `${resolveBaseUrl(opts)}/pricing`;
}

export async function createShare(
  input: ShareCreateInput,
  opts: ShareApiOptions = {},
): Promise<ShareCreateResponse> {
  const parsed = ShareCreateInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ShareApiError('bad-input', 'Invalid share input');
  }

  const fetchFn = opts.fetch ?? fetch;
  const baseUrl = resolveBaseUrl(opts);
  const url = `${baseUrl}/api/share`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = (await fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(parsed.data),
    })) as Response;
  } catch {
    throw new ShareApiError('network', 'Could not reach the share service');
  }

  if (res.status === 401) throw new ShareApiError('unauthorized', 'Sign-in required');
  // Since the pricing relaunch a 403 on this route only means the Free
  // Publish trial has ended (the count cap is gone).
  if (res.status === 403) throw new ShareApiError('trial-expired', 'Publish trial ended');
  if (res.status === 409)
    throw new ShareApiError('owner-mismatch', 'Share owned by another account');
  if (res.status === 429) throw new ShareApiError('rate-limited', 'Rate limited');
  if (res.status === 400) throw new ShareApiError('bad-input', 'Server rejected payload');
  if (res.status >= 500) throw new ShareApiError('server', `Server error ${res.status}`);
  if (!res.ok) throw new ShareApiError('server', `Unexpected status ${res.status}`);

  let bodyJson: unknown;
  try {
    bodyJson = await res.json();
  } catch {
    throw new ShareApiError('bad-response', 'Response was not JSON');
  }

  const bodyParsed = ShareCreateResponseSchema.safeParse(bodyJson);
  if (!bodyParsed.success) {
    throw new ShareApiError('bad-response', 'Response did not match schema');
  }
  return bodyParsed.data;
}

/**
 * Ask the server whether sharing this project is allowed under the owner's tier,
 * BEFORE the slow EAS publish — so a capped designer is nudged to upgrade without
 * waiting. Fail-open by design: any failure (offline, 4xx/5xx, an old server with
 * no preflight route, a malformed body) resolves to `null`, and the caller falls
 * through to publish where the authoritative 403 still enforces the cap.
 */
export async function preflightShare(
  token: string,
  opts: ShareApiOptions = {},
): Promise<SharePreflightResponse | null> {
  const fetchFn = opts.fetch ?? fetch;
  const baseUrl = resolveBaseUrl(opts);
  const url = `${baseUrl}/api/share/preflight`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  try {
    const res = (await fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token }),
    })) as Response;
    if (!res.ok) return null;
    const parsed = SharePreflightResponseSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function lookupShare(
  token: string,
  opts: ShareApiOptions = {},
): Promise<ShareLookupResponse> {
  if (!token.trim()) throw new ShareApiError('bad-input', 'Token must not be empty');
  const fetchFn = opts.fetch ?? fetch;
  const baseUrl = resolveBaseUrl(opts);
  const url = `${baseUrl}/api/share/${encodeURIComponent(token)}`;

  let res: Response;
  try {
    res = (await fetchFn(url)) as Response;
  } catch {
    throw new ShareApiError('network', 'Could not reach the share service');
  }

  if (res.status === 404) throw new ShareApiError('not-found', 'Share token not found');
  if (res.status >= 500) throw new ShareApiError('server', `Server error ${res.status}`);
  if (!res.ok) throw new ShareApiError('server', `Unexpected status ${res.status}`);

  let bodyJson: unknown;
  try {
    bodyJson = await res.json();
  } catch {
    throw new ShareApiError('bad-response', 'Response was not JSON');
  }

  const bodyParsed = ShareLookupResponseSchema.safeParse(bodyJson);
  if (!bodyParsed.success) {
    throw new ShareApiError('bad-response', 'Response did not match schema');
  }
  return bodyParsed.data;
}
