import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

export type EnsureCloudflaredDeps = {
  which: () => string | null;
  npmBinPath: () => string | null;
  log: (message: string) => void;
};

export type EnsureCloudflaredOptions = {
  deps?: Partial<EnsureCloudflaredDeps>;
};

const defaultWhich = (): string | null => {
  try {
    const out = execFileSync('which', ['cloudflared'], { stdio: 'pipe' }).toString().trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
};

const defaultNpmBinPath = (): string | null => {
  try {
    const req = createRequire(import.meta.url);
    const mod = req('cloudflared') as { bin?: string };
    return typeof mod.bin === 'string' ? mod.bin : null;
  } catch {
    return null;
  }
};

export async function ensureCloudflared(opts: EnsureCloudflaredOptions = {}): Promise<string> {
  const deps: EnsureCloudflaredDeps = {
    which: opts.deps?.which ?? defaultWhich,
    npmBinPath: opts.deps?.npmBinPath ?? defaultNpmBinPath,
    log: opts.deps?.log ?? (() => {}),
  };

  const sys = deps.which();
  if (sys && fs.existsSync(sys)) {
    deps.log(`cloudflared: using system binary at ${sys}`);
    return sys;
  }

  const npmPath = deps.npmBinPath();
  if (npmPath && fs.existsSync(npmPath)) {
    deps.log(`cloudflared: using npm-managed binary at ${npmPath}`);
    return npmPath;
  }

  throw new Error('cloudflared binary not available');
}
