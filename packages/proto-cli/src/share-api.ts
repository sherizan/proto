import { z } from 'zod';

export const SHARE_API_BASE_DEFAULT = 'https://prototo.app';

export const ThemeEnum = z.enum(['liquid-glass', 'material-you']);

export const ShareCreateInputSchema = z.object({
  designerName: z.string().min(1).max(60),
  appName: z.string().min(1).max(60),
  screenCount: z.number().int().min(0).max(999),
  theme: ThemeEnum,
  tunnelUrl: z.string().url().startsWith('https://'),
});

export const ShareCreateResponseSchema = z.object({
  token: z.string().min(1).max(20),
  url: z.string().url(),
  expiresAt: z.string().min(1),
});

export const ShareLookupResponseSchema = z.object({
  designerName: z.string(),
  appName: z.string(),
  screenCount: z.number(),
  theme: ThemeEnum,
  tunnelUrl: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export type ShareCreateInput = z.infer<typeof ShareCreateInputSchema>;
export type ShareCreateResponse = z.infer<typeof ShareCreateResponseSchema>;
export type ShareLookupResponse = z.infer<typeof ShareLookupResponseSchema>;

export type ShareApiErrorKind =
  | 'network'
  | 'bad-input'
  | 'rate-limited'
  | 'not-found'
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
};

function resolveBaseUrl(opts: ShareApiOptions): string {
  if (opts.baseUrl) return opts.baseUrl;
  const env = process.env.PROTO_SHARE_API_BASE;
  return env && env.length > 0 ? env : SHARE_API_BASE_DEFAULT;
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

  let res: Response;
  try {
    res = (await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })) as Response;
  } catch {
    throw new ShareApiError('network', 'Could not reach the share service');
  }

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
