import { z } from 'zod';

export const SHARE_API_BASE = 'https://prototo.app';

const ShareLookupResponseSchema = z.object({
  designerName: z.string(),
  appName: z.string(),
  screenCount: z.number(),
  theme: z.enum(['liquid-glass', 'material-you']),
  tunnelUrl: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export type ShareLookupResponse = z.infer<typeof ShareLookupResponseSchema>;

export type ShareLookupErrorKind = 'expired' | 'unreachable';

export class ShareLookupError extends Error {
  readonly kind: ShareLookupErrorKind;
  constructor(kind: ShareLookupErrorKind, message: string) {
    super(message);
    this.name = 'ShareLookupError';
    this.kind = kind;
  }
}

export type LookupOptions = {
  fetch?: typeof fetch;
  baseUrl?: string;
};

export async function lookupShare(
  token: string,
  opts: LookupOptions = {},
): Promise<ShareLookupResponse> {
  if (!token.trim()) throw new ShareLookupError('expired', 'Token must not be empty');

  const fetchFn = opts.fetch ?? fetch;
  const baseUrl = opts.baseUrl ?? SHARE_API_BASE;
  const url = `${baseUrl}/api/share/${encodeURIComponent(token)}`;

  let res: Response;
  try {
    res = (await fetchFn(url)) as Response;
  } catch {
    throw new ShareLookupError('unreachable', 'Could not reach the share service');
  }

  if (res.status === 404) throw new ShareLookupError('expired', 'Share token not found');
  if (!res.ok) throw new ShareLookupError('unreachable', `Unexpected status ${res.status}`);

  let bodyJson: unknown;
  try {
    bodyJson = await res.json();
  } catch {
    throw new ShareLookupError('unreachable', 'Response was not JSON');
  }

  const parsed = ShareLookupResponseSchema.safeParse(bodyJson);
  if (!parsed.success) {
    throw new ShareLookupError('unreachable', 'Response did not match schema');
  }
  return parsed.data;
}
