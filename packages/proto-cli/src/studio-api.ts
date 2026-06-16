import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
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
  // Optional so an older server (pre-cap deploy) still parses; the CLI applies a
  // safe Free default when absent.
  tier: z.string().optional(),
  maxRecordingSeconds: z.number().positive().optional(),
});
export type StudioCreateResponse = z.infer<typeof StudioCreateResponseSchema>;

const StudioOpenResponseSchema = z.object({ url: z.string().url() });

/** Reports upload completion as a fraction in (0, 1]. */
export type UploadProgress = (fraction: number) => void;

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

/**
 * Transport seam for the upload PUT — returns the HTTP status. Tests inject a
 * fake; production uses Node's core http client (see `nodeUploadTransport`).
 */
export type UploadTransport = (args: {
  url: string;
  body: Uint8Array;
  headers: Record<string, string>;
  onProgress: UploadProgress;
}) => Promise<number>;

/**
 * Upload via Node's core http/https client (NOT `fetch`): a plain buffered PUT
 * with an explicit Content-Length, written in chunks so `onProgress` can report a
 * real percentage. We avoid `fetch` + a `ReadableStream` body here because that
 * path is unreliable across Node/undici versions (a streamed body with
 * `duplex:'half'` fails on older Node), whereas the core client behaves
 * consistently everywhere.
 */
const nodeUploadTransport: UploadTransport = ({ url, body, headers, onProgress }) =>
  new Promise<number>((resolve, reject) => {
    const requestFn = new URL(url).protocol === 'http:' ? httpRequest : httpsRequest;
    const req = requestFn(
      url,
      { method: 'PUT', headers: { ...headers, 'Content-Length': String(body.byteLength) } },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res.statusCode ?? 0));
      },
    );
    req.on('error', reject);

    const total = body.byteLength;
    if (total === 0) {
      onProgress(1);
      req.end();
      return;
    }
    const CHUNK = 256 * 1024;
    let sent = 0;
    const pump = () => {
      while (sent < total) {
        const end = Math.min(sent + CHUNK, total);
        const flushed = req.write(body.subarray(sent, end));
        sent = end;
        onProgress(sent / total);
        if (!flushed) {
          req.once('drain', pump);
          return;
        }
      }
      req.end();
    };
    pump();
  });

/**
 * PUT the recording bytes directly to the signed Storage URL, reporting upload
 * progress as a fraction. The signed URL bypasses the API body cap.
 */
export async function uploadRecording(
  uploadUrl: string,
  body: Uint8Array,
  opts: { onProgress?: UploadProgress; transport?: UploadTransport } = {},
): Promise<void> {
  const onProgress = opts.onProgress ?? (() => {});
  const transport = opts.transport ?? nodeUploadTransport;
  let status: number;
  try {
    status = await transport({
      url: uploadUrl,
      body,
      headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
      onProgress,
    });
  } catch {
    throw new StudioApiError('upload-failed', 'Could not upload the recording');
  }
  if (status < 200 || status >= 300) {
    throw new StudioApiError('upload-failed', `Upload failed (${status})`);
  }
}

/**
 * Ask the server for a one-time sign-in handoff URL so the browser opens Studio
 * already authenticated (mirrors `preflightShare` — fail-open). Any failure
 * resolves to `null`; the caller then opens the plain `/studio` URL, where the
 * recipient signs in once.
 */
export async function studioOpenLink(
  sessionToken: string,
  opts: StudioApiOptions = {},
): Promise<string | null> {
  const fetchFn = opts.fetch ?? fetch;
  const url = `${resolveStudioBaseUrl(opts)}/api/studio/${encodeURIComponent(sessionToken)}/open`;
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  try {
    const res = (await fetchFn(url, { method: 'POST', headers })) as Response;
    if (!res.ok) return null;
    const parsed = StudioOpenResponseSchema.safeParse(await res.json());
    return parsed.success ? parsed.data.url : null;
  } catch {
    return null;
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
