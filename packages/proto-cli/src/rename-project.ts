import fs from 'node:fs';
import path from 'node:path';

// #68: a remix is its own project, so it takes its folder's name everywhere
// the original's name was stamped at scaffold time (create-proto writes
// {{name}} into these three). `expo.slug` stays: `proto share` manages it.
// Each file is best-effort; a missing or odd one is left as it is.

export function renameProject(root: string, name: string): void {
  const npmName =
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'prototype';

  edit(path.join(root, 'proto.config.js'), (src) =>
    src.replace(
      /(\bname\s*:\s*)(['"])(?:\\.|(?!\2).)*\2/,
      (_m, key: string) => `${key}'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`,
    ),
  );
  edit(path.join(root, 'package.json'), (src) => {
    const pkg = JSON.parse(src) as Record<string, unknown>;
    return `${JSON.stringify({ ...pkg, name: npmName }, null, 2)}\n`;
  });
  edit(path.join(root, '.proto', 'expo-config', 'app.json'), (src) => {
    const json = JSON.parse(src) as { expo?: Record<string, unknown> };
    if (!json.expo) return src;
    return `${JSON.stringify({ ...json, expo: { ...json.expo, name } }, null, 2)}\n`;
  });
}

function edit(file: string, change: (src: string) => string): void {
  try {
    fs.writeFileSync(file, change(fs.readFileSync(file, 'utf8')));
  } catch {
    // missing or unparsable: leave it
  }
}
