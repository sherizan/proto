import { randomBytes } from 'node:crypto';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { CLI_TOKEN_PREFIX } from './cli-token.js';
import { openBrowser as defaultOpenBrowser } from './open-browser.js';
import { SHARE_API_BASE_DEFAULT } from './share-api.js';

// `proto login` runs a one-shot loopback server, sends the designer to
// prototo.app/cli to sign in, and catches the browser redirect that carries the
// freshly-minted API token back. A random `state` ties the request to this run
// so a stray redirect can't inject someone else's token.

export type CliLoginErrorKind = 'timeout' | 'state-mismatch' | 'no-token';

export class CliLoginError extends Error {
  readonly kind: CliLoginErrorKind;
  constructor(kind: CliLoginErrorKind, message: string) {
    super(message);
    this.name = 'CliLoginError';
    this.kind = kind;
  }
}

const PAGE_STYLE =
  'body{font-family:-apple-system,system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#0b0b0c;color:#fff}div{text-align:center}';

const SUCCESS_HTML = `<!doctype html><meta charset="utf-8"><title>Prototo</title>
<style>${PAGE_STYLE}</style>
<div><h1>You're signed in</h1><p>Head back to your terminal — you can close this tab.</p></div>`;

// Shown when a request hits the loopback without a valid token — e.g. the OAuth
// round trip dropped the redirect and landed here empty. Never tell the designer
// they're signed in unless they actually are.
const INCOMPLETE_HTML = `<!doctype html><meta charset="utf-8"><title>Prototo</title>
<style>${PAGE_STYLE}</style>
<div><h1>Sign-in didn't complete</h1><p>Head back to your terminal and run the command again.</p></div>`;

/** True only when the callback carries a proto_ token AND the matching state. */
function callbackIsValid(callbackUrl: string, expectedState: string): boolean {
  try {
    const url = new URL(callbackUrl, 'http://127.0.0.1');
    const token = url.searchParams.get('token');
    return (
      !!token && token.startsWith(CLI_TOKEN_PREFIX) && url.searchParams.get('state') === expectedState
    );
  } catch {
    return false;
  }
}

export type LoopbackServer = {
  port: number;
  /** Resolves with the callback request URL (path + query) of the first GET hit. */
  waitForCallback: (timeoutMs: number) => Promise<string>;
  close: () => void;
};

export function buildLoginUrl(baseUrl: string, port: number, state: string): string {
  const url = new URL('/cli', baseUrl);
  url.searchParams.set('redirect_uri', `http://127.0.0.1:${port}`);
  url.searchParams.set('state', state);
  return url.toString();
}

export function parseCallback(callbackUrl: string, expectedState: string): string {
  const url = new URL(callbackUrl, 'http://127.0.0.1');
  const token = url.searchParams.get('token');
  const state = url.searchParams.get('state');
  if (!token || !token.startsWith(CLI_TOKEN_PREFIX)) {
    throw new CliLoginError('no-token', 'No sign-in token in the callback');
  }
  if (state !== expectedState) {
    throw new CliLoginError('state-mismatch', 'Sign-in response did not match this request');
  }
  return token;
}

/**
 * Start a one-shot loopback server on an OS-assigned port. Only a request that
 * carries a valid token + matching state resolves the wait and shows the "signed
 * in" page — an empty/stray redirect gets an honest "didn't complete" page and
 * the server keeps waiting, so the designer is never falsely told they're done.
 */
export function startLoopbackServer(expectedState: string): Promise<LoopbackServer> {
  return new Promise((resolve, reject) => {
    let onHit: ((url: string) => void) | null = null;
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const valid = req.url ? callbackIsValid(req.url, expectedState) : false;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(valid ? SUCCESS_HTML : INCOMPLETE_HTML);
      if (valid && onHit && req.url) onHit(req.url);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : 0;
      resolve({
        port,
        waitForCallback: (timeoutMs: number) =>
          new Promise<string>((resolveCb, rejectCb) => {
            const timer = setTimeout(() => {
              onHit = null;
              rejectCb(new CliLoginError('timeout', 'Sign-in timed out'));
            }, timeoutMs);
            onHit = (url) => {
              clearTimeout(timer);
              onHit = null;
              resolveCb(url);
            };
          }),
        close: () => server.close(),
      });
    });
  });
}

function resolveBaseUrl(baseUrl?: string): string {
  if (baseUrl) return baseUrl;
  const env = process.env.PROTO_SHARE_API_BASE;
  return env && env.length > 0 ? env : SHARE_API_BASE_DEFAULT;
}

export type LoginFlowDeps = {
  startServer?: (expectedState: string) => Promise<LoopbackServer>;
  openBrowser?: (url: string) => void;
  randomState?: () => string;
  baseUrl?: string;
  timeoutMs?: number;
  log?: (m: string) => void;
};

/**
 * Drive the browser sign-in and return the minted API token. Throws CliLoginError
 * on timeout, state mismatch, or a missing token.
 */
export async function loginFlow(deps: LoginFlowDeps = {}): Promise<string> {
  const startServer = deps.startServer ?? startLoopbackServer;
  const openBrowser = deps.openBrowser ?? defaultOpenBrowser;
  const randomState = deps.randomState ?? (() => randomBytes(16).toString('hex'));
  const baseUrl = resolveBaseUrl(deps.baseUrl);
  const timeoutMs = deps.timeoutMs ?? 120_000;
  const log = deps.log ?? (() => {});

  const state = randomState();
  const server = await startServer(state);
  try {
    const loginUrl = buildLoginUrl(baseUrl, server.port, state);
    openBrowser(loginUrl);
    log(`If your browser didn't open, visit:\n  ${loginUrl}`);
    const callbackUrl = await server.waitForCallback(timeoutMs);
    return parseCallback(callbackUrl, state);
  } finally {
    server.close();
  }
}
