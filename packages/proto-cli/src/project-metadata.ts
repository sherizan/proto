import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export type Theme = 'liquid-glass' | 'material-you';

export type ProjectMetadata = {
  appName: string;
  screenCount: number;
  theme: Theme;
};

const KNOWN_THEMES: Record<string, Theme> = {
  liquidGlass: 'liquid-glass',
  'liquid-glass': 'liquid-glass',
  materialYou: 'material-you',
  'material-you': 'material-you',
};

export function mapTheme(input: unknown): Theme {
  if (typeof input !== 'string') return 'liquid-glass';
  return KNOWN_THEMES[input] ?? 'liquid-glass';
}

function loadProtoConfig(cwd: string): { name?: unknown; theme?: unknown } {
  const candidates = ['proto.config.js', 'proto.config.cjs', 'proto.config.mjs'];
  for (const name of candidates) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) {
      const req = createRequire(path.join(cwd, 'noop.js'));
      const mod = req(p);
      return (mod && typeof mod === 'object' ? mod : {}) as { name?: unknown; theme?: unknown };
    }
  }
  throw new Error('proto.config.js not found');
}

function countScreens(cwd: string): number {
  const dir = path.join(cwd, 'screens');
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith('.tsx')).length;
}

export function readProjectMetadata(cwd: string): ProjectMetadata {
  const cfg = loadProtoConfig(cwd);
  const rawName = typeof cfg.name === 'string' ? cfg.name.trim() : '';
  if (!rawName) throw new Error('proto.config.js missing "name"');
  return {
    appName: rawName,
    screenCount: countScreens(cwd),
    theme: mapTheme(cfg.theme),
  };
}
