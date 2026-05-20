import fs from 'node:fs';
import path from 'node:path';

export type CopyOptions = {
  templateRoot: string;
  destRoot: string;
  projectName: string;
  substitutions?: Record<string, string>;
};

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.txt',
  '.html',
]);

export async function copyTemplate(options: CopyOptions): Promise<void> {
  const { templateRoot, destRoot, projectName, substitutions } = options;
  const map = { '{{name}}': projectName, ...(substitutions ?? {}) };
  await walk(templateRoot, destRoot, map);
}

async function walk(
  srcDir: string,
  destDir: string,
  substitutions: Record<string, string>,
): Promise<void> {
  await fs.promises.mkdir(destDir, { recursive: true });
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await walk(srcPath, destPath, substitutions);
      continue;
    }
    const ext = path.extname(entry.name);
    if (TEXT_EXTENSIONS.has(ext)) {
      const text = await fs.promises.readFile(srcPath, 'utf8');
      const replaced = applySubstitutions(text, substitutions);
      await fs.promises.writeFile(destPath, replaced, 'utf8');
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

function applySubstitutions(text: string, substitutions: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(substitutions)) {
    out = out.split(key).join(value);
  }
  return out;
}
