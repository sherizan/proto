import fs from 'node:fs';
import path from 'node:path';

export type ClearCachesResult = { cleared: string[] };

const TARGETS = [
  '.expo',
  path.join('node_modules', '.cache'),
];

export async function clearCaches(projectRoot: string): Promise<ClearCachesResult> {
  const cleared: string[] = [];
  for (const target of TARGETS) {
    const full = path.join(projectRoot, target);
    if (fs.existsSync(full)) {
      await fs.promises.rm(full, { recursive: true, force: true });
      cleared.push(target.split(path.sep).join('/'));
    }
  }
  return { cleared };
}
