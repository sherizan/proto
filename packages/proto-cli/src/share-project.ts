import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { CompileConfig } from '@sherizan/proto-compile';

export type ScreenSource = { name: string; source: string };

/** Read every screen `.tsx` under `<root>/screens` as { name, source }, sorted by name. */
export function enumerateScreens(root: string): ScreenSource[] {
  const dir = path.join(root, 'screens');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.tsx'))
    .sort()
    .map((f) => ({ name: f.slice(0, -4), source: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

type RawConfig = {
  name?: unknown;
  theme?: unknown;
  colorScheme?: unknown;
  accentColor?: unknown;
  tokens?: unknown;
  screens?: { initial?: unknown };
  initialScreen?: unknown;
};

function loadProtoConfig(root: string): RawConfig {
  for (const name of ['proto.config.js', 'proto.config.cjs', 'proto.config.mjs']) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) {
      const req = createRequire(path.join(root, 'noop.js'));
      const mod = req(p);
      return (mod && typeof mod === 'object' ? mod : {}) as RawConfig;
    }
  }
  throw new Error('proto.config.js not found');
}

const THEME_NAMES = new Set(['liquidGlass', 'materialYou', 'base']);
const SCHEMES = new Set(['system', 'light', 'dark']);

export type GatheredProject = { screens: ScreenSource[]; config: CompileConfig };

/**
 * Gather everything `compileManifest` needs from a designer's project: the screen
 * sources and a CompileConfig derived from `proto.config.js`. Throws on a missing
 * or nameless config (surfaced to the designer as a friendly message upstream).
 */
export function gatherProject(root: string): GatheredProject {
  const cfg = loadProtoConfig(root);
  const name = typeof cfg.name === 'string' ? cfg.name.trim() : '';
  if (!name) throw new Error('proto.config.js missing "name"');

  const screens = enumerateScreens(root);

  const initialFromCfg =
    typeof cfg.screens?.initial === 'string'
      ? cfg.screens.initial
      : typeof cfg.initialScreen === 'string'
        ? cfg.initialScreen
        : undefined;
  const initialScreen = initialFromCfg ?? screens[0]?.name ?? 'Home';

  const config: CompileConfig = { name, initialScreen };
  if (typeof cfg.theme === 'string' && THEME_NAMES.has(cfg.theme)) {
    config.theme = cfg.theme as CompileConfig['theme'];
  }
  if (typeof cfg.colorScheme === 'string' && SCHEMES.has(cfg.colorScheme)) {
    config.colorScheme = cfg.colorScheme as CompileConfig['colorScheme'];
  }
  if (typeof cfg.accentColor === 'string') config.accentColor = cfg.accentColor;
  if (cfg.tokens && typeof cfg.tokens === 'object') {
    config.tokens = cfg.tokens as CompileConfig['tokens'];
  }

  return { screens, config };
}
