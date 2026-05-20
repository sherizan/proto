import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const src = path.join(repoRoot, 'packages/proto-components/src');
const dest = path.join(repoRoot, 'packages/create-proto/template/components/proto');

const EXCLUDE = new Set(['proto-config.d.ts']);

async function main() {
  if (!fs.existsSync(src)) {
    throw new Error(`proto-components source not found at ${src}`);
  }
  await fs.promises.rm(dest, { recursive: true, force: true });
  await fs.promises.mkdir(dest, { recursive: true });

  await walk(src, dest);

  const keep = path.join(dest, '.gitkeep');
  if (!fs.existsSync(keep)) {
    await fs.promises.writeFile(keep, '');
  }
}

async function walk(srcDir: string, destDir: string): Promise<void> {
  await fs.promises.mkdir(destDir, { recursive: true });
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await walk(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
