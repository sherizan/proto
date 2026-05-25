import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import { startCloudflareTunnel, parseCloudflareUrl, type TunnelDeps } from './tunnel-cloudflare.js';

describe('parseCloudflareUrl', () => {
  it('extracts the trycloudflare.com URL from typical stdout', () => {
    const sample = [
      '2026-05-25T12:00:00Z INF +-------------------------------------------+',
      '2026-05-25T12:00:00Z INF | https://orange-fox-92.trycloudflare.com   |',
      '2026-05-25T12:00:00Z INF +-------------------------------------------+',
    ].join('\n');
    expect(parseCloudflareUrl(sample)).toBe('https://orange-fox-92.trycloudflare.com');
  });

  it('ignores other https URLs in the output', () => {
    const sample = 'Some preamble https://example.com/x and https://abc.trycloudflare.com/y after';
    expect(parseCloudflareUrl(sample)).toBe('https://abc.trycloudflare.com');
  });

  it('returns null when no trycloudflare URL is present', () => {
    expect(parseCloudflareUrl('just noise')).toBe(null);
  });

  it('strips trailing path/query if present', () => {
    expect(parseCloudflareUrl('https://abc.trycloudflare.com/foo?bar=1 trailing'))
      .toBe('https://abc.trycloudflare.com');
  });
});

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill(signal?: NodeJS.Signals): boolean {
    this.killed = true;
    setTimeout(() => this.emit('exit', 0, signal ?? 'SIGTERM'), 0);
    return true;
  }
}

function makeDeps(child: FakeChild): TunnelDeps {
  return {
    spawn: () => child as unknown as ReturnType<TunnelDeps['spawn']>,
    timeoutMs: 1000,
    log: () => {},
  };
}

describe('startCloudflareTunnel', () => {
  it('resolves tunnelUrl when cloudflared prints the URL on stdout', async () => {
    const child = new FakeChild();
    const handle = startCloudflareTunnel({
      localPort: 8081,
      cloudflaredPath: '/tmp/cf',
      deps: makeDeps(child),
    });

    setTimeout(() => {
      child.stdout.emit(
        'data',
        Buffer.from('https://blue-otter-42.trycloudflare.com listening'),
      );
    }, 10);

    const url = await handle.tunnelUrl;
    expect(url).toBe('https://blue-otter-42.trycloudflare.com');
  });

  it('resolves when the URL arrives on stderr (cloudflared writes there)', async () => {
    const child = new FakeChild();
    const handle = startCloudflareTunnel({
      localPort: 8081,
      cloudflaredPath: '/tmp/cf',
      deps: makeDeps(child),
    });

    setTimeout(() => {
      child.stderr.emit('data', Buffer.from('https://red-cat-1.trycloudflare.com'));
    }, 10);

    const url = await handle.tunnelUrl;
    expect(url).toBe('https://red-cat-1.trycloudflare.com');
  });

  it('rejects on timeout when no URL appears', async () => {
    const child = new FakeChild();
    const handle = startCloudflareTunnel({
      localPort: 8081,
      cloudflaredPath: '/tmp/cf',
      deps: makeDeps(child),
    });
    await expect(handle.tunnelUrl).rejects.toThrow(/timeout/i);
  });

  it('kill() sends SIGTERM to the child and resolves', async () => {
    const child = new FakeChild();
    const handle = startCloudflareTunnel({
      localPort: 8081,
      cloudflaredPath: '/tmp/cf',
      deps: makeDeps(child),
    });
    setTimeout(() => {
      child.stdout.emit('data', Buffer.from('https://x.trycloudflare.com'));
    }, 10);
    await handle.tunnelUrl;
    await handle.kill();
    expect(child.killed).toBe(true);
  });

  it('passes --url http://localhost:<port> to cloudflared', async () => {
    const child = new FakeChild();
    let capturedArgs: string[] = [];
    startCloudflareTunnel({
      localPort: 8181,
      cloudflaredPath: '/tmp/cf',
      deps: {
        ...makeDeps(child),
        spawn: (_cmd, args) => {
          capturedArgs = args;
          return child as unknown as ReturnType<TunnelDeps['spawn']>;
        },
      },
    });
    expect(capturedArgs).toContain('--url');
    expect(capturedArgs).toContain('http://localhost:8181');
    expect(capturedArgs[0]).toBe('tunnel');
  });
});
