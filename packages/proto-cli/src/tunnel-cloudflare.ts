import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

const TRYCLOUDFLARE_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

export function parseCloudflareUrl(text: string): string | null {
  const m = text.match(TRYCLOUDFLARE_REGEX);
  return m ? m[0] : null;
}

type SpawnedChild = {
  stdout: { on(event: 'data', listener: (chunk: Buffer | string) => void): void };
  stderr: { on(event: 'data', listener: (chunk: Buffer | string) => void): void };
  on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
  kill(signal?: NodeJS.Signals): boolean;
};

export type TunnelDeps = {
  spawn: (cmd: string, args: string[]) => SpawnedChild;
  timeoutMs: number;
  log: (message: string) => void;
};

export type TunnelOptions = {
  localPort: number;
  cloudflaredPath: string;
  deps?: Partial<TunnelDeps>;
};

export type TunnelHandle = {
  tunnelUrl: Promise<string>;
  kill: () => Promise<void>;
};

const DEFAULT_TIMEOUT_MS = 30_000;

const defaultSpawn = (cmd: string, args: string[]): SpawnedChild =>
  nodeSpawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }) as ChildProcessWithoutNullStreams;

export function startCloudflareTunnel(opts: TunnelOptions): TunnelHandle {
  const deps: TunnelDeps = {
    spawn: opts.deps?.spawn ?? defaultSpawn,
    timeoutMs: opts.deps?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    log: opts.deps?.log ?? (() => {}),
  };

  const args = ['tunnel', '--url', `http://localhost:${opts.localPort}`];
  const child = deps.spawn(opts.cloudflaredPath, args);

  const tunnelUrl = new Promise<string>((resolve, reject) => {
    let buffer = '';
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('cloudflared tunnel start timeout'));
      }
    }, deps.timeoutMs);

    const onData = (chunk: Buffer | string): void => {
      if (resolved) return;
      buffer += chunk.toString();
      const url = parseCloudflareUrl(buffer);
      if (url) {
        resolved = true;
        clearTimeout(timer);
        deps.log(`cloudflared: tunnel up at ${url}`);
        resolve(url);
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code, signal) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(new Error(`cloudflared exited before tunnel was ready (code=${code} signal=${signal})`));
      }
    });
  });

  return {
    tunnelUrl,
    kill: async () => {
      child.kill('SIGTERM');
    },
  };
}
