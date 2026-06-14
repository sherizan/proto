import { z } from 'zod';

// Prototo Studio API client. Studio is the post-production export tool: `proto
// record` creates a session, uploads the recording straight to storage via the
// returned signed URL (bypasses the API body cap), then marks it ready. Mirrors
// share-api.ts; reuses the same PROTO_SHARE_API_BASE override.
export const STUDIO_API_BASE_DEFAULT = 'https://prototo.app';

export const StudioCreateResponseSchema = z.object({
  token: z.string().min(1),
  uploadUrl: z.string().url(),
  videoPath: z.string().min(1),
  expiresAt: z.string().min(1),
});
export type StudioCreateResponse = z.infer<typeof StudioCreateResponseSchema>;

export type StudioApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'rate-limited'
  | 'server'
  | 'bad-response'
  | 'upload-failed';

export class StudioApiError extends Error {
  readonly kind: StudioApiErrorKind;
  constructor(kind: StudioApiErrorKind, message: string) {
    super(message);
    this.name = 'StudioApiError';
    this.kind = kind;
  }
}

export type StudioApiOptions = {
  fetch?: typeof fetch;
  baseUrl?: string;
  /** The account token from `proto login`; sent as `Authorization: Bearer`. */
  token?: string;
  /** Booted Simulator device name, e.g. "iPhone 17 Pro" — picks the Studio frame. */
  device?: string | null;
};

export function resolveStudioBaseUrl(opts: StudioApiOptions = {}): string {
  if (opts.baseUrl) return opts.baseUrl;
  const env = process.env.PROTO_SHARE_API_BASE;
  return env && env.length > 0 ? env : STUDIO_API_BASE_DEFAULT;
}

/** The browser URL a designer opens to wrap + export a recording. */
export function studioPageUrl(token: string, opts: StudioApiOptions = {}): string {
  return `${resolveStudioBaseUrl(opts)}/studio?v=${encodeURIComponent(token)}`;
}

/** POST /api/studio — create a pending session and get a signed upload URL. */
export async function createStudioSession(
  opts: StudioApiOptions = {},
): Promise<StudioCreateResponse> {
  const fetchFn = opts.fetch ?? fetch;
  const url = `${resolveStudioBaseUrl(opts)}/api/studio`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = (await fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ device: opts.device ?? null }),
    })) as Response;
  } catch {
    throw new StudioApiError('network', 'Could not reach the Studio service');
  }

  if (res.status === 401) throw new StudioApiError('unauthorized', 'Sign-in required');
  if (res.status === 429) throw new StudioApiError('rate-limited', 'Rate limited');
  if (res.status >= 500) throw new StudioApiError('server', `Server error ${res.status}`);
  if (!res.ok) throw new StudioApiError('server', `Unexpected status ${res.status}`);

  let bodyJson: unknown;
  try {
    bodyJson = await res.json();
  } catch {
    throw new StudioApiError('bad-response', 'Response was not JSON');
  }
  const parsed = StudioCreateResponseSchema.safeParse(bodyJson);
  if (!parsed.success) {
    throw new StudioApiError('bad-response', 'Response did not match schema');
  }
  return parsed.data;
}

/** PUT the recording bytes directly to the signed Storage URL. */
export async function uploadRecording(
  uploadUrl: string,
  body: Uint8Array,
  opts: Pick<StudioApiOptions, 'fetch'> = {},
): Promise<void> {
  const fetchFn = opts.fetch ?? fetch;
  let res: Response;
  try {
    res = (await fetchFn(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
      body,
    })) as Response;
  } catch {
    throw new StudioApiError('upload-failed', 'Could not upload the recording');
  }
  if (!res.ok) {
    throw new StudioApiError('upload-failed', `Upload failed (${res.status})`);
  }
}

/** POST /api/studio/<token>/ready — confirm the upload finished. */
export async function markStudioReady(token: string, opts: StudioApiOptions = {}): Promise<void> {
  const fetchFn = opts.fetch ?? fetch;
  const url = `${resolveStudioBaseUrl(opts)}/api/studio/${encodeURIComponent(token)}/ready`;
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = (await fetchFn(url, { method: 'POST', headers })) as Response;
  } catch {
    throw new StudioApiError('network', 'Could not reach the Studio service');
  }
  if (res.status === 401) throw new StudioApiError('unauthorized', 'Sign-in required');
  if (!res.ok) throw new StudioApiError('server', `Unexpected status ${res.status}`);
}
