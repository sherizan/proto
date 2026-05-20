import fs from 'node:fs';
import path from 'node:path';
import { messages } from './messages.js';

export type ConfigLookup =
  | { ok: true; root: string; configPath: string }
  | { ok: false; reason: string };

const CANDIDATES = ['proto.config.js', 'proto.config.mjs', 'proto.config.cjs', 'proto.config.ts'];

export function findConfig(cwd: string): ConfigLookup {
  for (const name of CANDIDATES) {
    const candidate = path.join(cwd, name);
    if (fs.existsSync(candidate)) {
      return { ok: true, root: cwd, configPath: candidate };
    }
  }
  return { ok: false, reason: messages.noConfig };
}
