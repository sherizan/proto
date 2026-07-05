import fs from 'node:fs';
import path from 'node:path';
import { translateMetroError } from '../error-translation.js';
import { messages } from '../messages.js';
import { METRO_ERRORS_REL, type MetroErrorsFile } from '../metro-errors.js';

export type MetroErrorsDeps = {
  readFile: (p: string) => string;
};

const defaultDeps: MetroErrorsDeps = {
  readFile: (p) => fs.readFileSync(p, 'utf8'),
};

const SCREEN_RE = /screens\/([A-Za-z0-9_.-]+)\.tsx/;

export async function runGetMetroErrors(opts: {
  cwd: string;
  deps?: Partial<MetroErrorsDeps>;
}): Promise<string> {
  const deps = { ...defaultDeps, ...opts.deps };

  let file: MetroErrorsFile;
  try {
    file = JSON.parse(deps.readFile(path.join(opts.cwd, METRO_ERRORS_REL)));
  } catch {
    // Missing or unreadable file means proto start hasn't captured anything.
    return messages.metroClean;
  }
  if (!Array.isArray(file?.errors) || file.errors.length === 0) return messages.metroClean;

  const errors = file.errors.map((e) => {
    const screen = e.raw.match(SCREEN_RE)?.[1]?.replace(/\.tsx?$/, '');
    return {
      friendly: translateMetroError(e.raw),
      raw: e.raw,
      at: e.at,
      ...(screen ? { screen } : {}),
    };
  });

  return JSON.stringify({ updatedAt: file.updatedAt, errors }, null, 2);
}
