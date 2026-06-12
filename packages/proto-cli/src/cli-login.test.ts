import { describe, expect, it, vi } from 'vitest';
import {
  CliLoginError,
  type LoopbackServer,
  buildLoginUrl,
  loginFlow,
  parseCallback,
  startLoopbackServer,
} from './cli-login.js';

describe('buildLoginUrl', () => {
  it('points at /cli with the loopback redirect_uri and state', () => {
    const url = buildLoginUrl('https://prototo.app', 51789, 'st4te');
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://prototo.app');
    expect(parsed.pathname).toBe('/cli');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:51789');
    expect(parsed.searchParams.get('state')).toBe('st4te');
  });
});

describe('parseCallback', () => {
  it('returns the token when state matches', () => {
    const token = parseCallback('/?token=proto_abc123&state=st4te', 'st4te');
    expect(token).toBe('proto_abc123');
  });

  it('throws state-mismatch when the state does not match', () => {
    expect(() => parseCallback('/?token=proto_abc123&state=evil', 'st4te')).toThrowError(
      expect.objectContaining({ kind: 'state-mismatch' }),
    );
  });

  it('throws no-token when the token is missing', () => {
    expect(() => parseCallback('/?state=st4te', 'st4te')).toThrowError(
      expect.objectContaining({ kind: 'no-token' }),
    );
  });

  it('throws no-token when the token is not a proto_ token', () => {
    expect(() => parseCallback('/?token=nope&state=st4te', 'st4te')).toThrowError(
      expect.objectContaining({ kind: 'no-token' }),
    );
  });

  it('ignores favicon and other non-callback requests (no token, no state)', () => {
    expect(() => parseCallback('/favicon.ico', 'st4te')).toThrowError(
      expect.objectContaining({ kind: 'no-token' }),
    );
  });
});

function fakeServer(callbackUrl: string | (() => Promise<string>)): {
  server: LoopbackServer;
  closed: () => boolean;
} {
  let isClosed = false;
  const server: LoopbackServer = {
    port: 51789,
    waitForCallback: async () =>
      typeof callbackUrl === 'function' ? await callbackUrl() : callbackUrl,
    close: () => {
      isClosed = true;
    },
  };
  return { server, closed: () => isClosed };
}

describe('loginFlow', () => {
  it('opens the browser to the login URL and returns the captured token', async () => {
    const { server, closed } = fakeServer('/?token=proto_live123&state=fixedstate');
    const openBrowser = vi.fn();
    const logs: string[] = [];

    const token = await loginFlow({
      startServer: async () => server,
      openBrowser,
      randomState: () => 'fixedstate',
      baseUrl: 'https://prototo.app',
      log: (m) => logs.push(m),
    });

    expect(token).toBe('proto_live123');
    expect(openBrowser).toHaveBeenCalledWith(
      'https://prototo.app/cli?redirect_uri=http%3A%2F%2F127.0.0.1%3A51789&state=fixedstate',
    );
    expect(closed()).toBe(true);
  });

  it('still prints the login URL so the designer can open it manually', async () => {
    const { server } = fakeServer('/?token=proto_live123&state=fixedstate');
    const logs: string[] = [];
    await loginFlow({
      startServer: async () => server,
      openBrowser: () => {},
      randomState: () => 'fixedstate',
      baseUrl: 'https://prototo.app',
      log: (m) => logs.push(m),
    });
    expect(logs.join('\n')).toContain('https://prototo.app/cli?redirect_uri=');
  });

  it('rejects (and closes the server) when the callback state does not match', async () => {
    const { server, closed } = fakeServer('/?token=proto_live123&state=wrong');
    await expect(
      loginFlow({
        startServer: async () => server,
        openBrowser: () => {},
        randomState: () => 'fixedstate',
        baseUrl: 'https://prototo.app',
        log: () => {},
      }),
    ).rejects.toMatchObject({ name: 'CliLoginError', kind: 'state-mismatch' });
    expect(closed()).toBe(true);
  });

  it('propagates a timeout from the server and closes it', async () => {
    const { server, closed } = fakeServer(async () => {
      throw new CliLoginError('timeout', 'timed out');
    });
    await expect(
      loginFlow({
        startServer: async () => server,
        openBrowser: () => {},
        randomState: () => 'fixedstate',
        baseUrl: 'https://prototo.app',
        log: () => {},
      }),
    ).rejects.toMatchObject({ kind: 'timeout' });
    expect(closed()).toBe(true);
  });
});

describe('startLoopbackServer (real socket)', () => {
  it('binds to 127.0.0.1, captures the first callback, and returns its URL', async () => {
    const server = await startLoopbackServer();
    try {
      expect(server.port).toBeGreaterThan(0);
      const pending = server.waitForCallback(2000);
      const res = await fetch(`http://127.0.0.1:${server.port}/?token=proto_socket1&state=xyz`);
      expect(res.ok).toBe(true);
      await expect(pending).resolves.toContain('token=proto_socket1');
    } finally {
      server.close();
    }
  });

  it('rejects with a timeout when no callback arrives', async () => {
    const server = await startLoopbackServer();
    try {
      await expect(server.waitForCallback(50)).rejects.toMatchObject({ kind: 'timeout' });
    } finally {
      server.close();
    }
  });
});
