import fs from 'node:fs';
import path from 'node:path';

export type CopyOptions = {
  templateRoot: string;
  destRoot: string;
  projectName: string;
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
  const { templateRoot, destRoot, projectName } = options;
  await walk(templateRoot, destRoot, projectName);
}

async function walk(srcDir: string, destDir: string, projectName: string): Promise<void> {
  await fs.promises.mkdir(destDir, { recursive: true });
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await walk(srcPath, destPath, projectName);
      continue;
    }
    if (entry.name === '.gitkeep') continue;
    const ext = path.extname(entry.name);
    if (TEXT_EXTENSIONS.has(ext)) {
      const text = await fs.promises.readFile(srcPath, 'utf8');
      const replaced = text.replaceAll('{{name}}', projectName);
      await fs.promises.writeFile(destPath, replaced, 'utf8');
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}
