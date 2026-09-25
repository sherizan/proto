import fs from 'node:fs';
import path from 'node:path';

// The paper trail for a remix: which share the copy came from. Written by
// `proto remix` into the copy, read by `proto share` and sent as `remixedFrom`
// so the website can show "Remixed from X by Y" wherever the share is listed.

export type RemixOrigin = {
  from: string;
  appName: string;
  designerName: string;
  at: string;
};

const FILE = ['.proto', 'remix.json'] as const;

export function writeRemixOrigin(root: string, origin: RemixOrigin): void {
  fs.mkdirSync(path.join(root, '.proto'), { recursive: true });
  fs.writeFileSync(path.join(root, ...FILE), `${JSON.stringify(origin, null, 2)}\n`);
}

export function readRemixOrigin(root: string): RemixOrigin | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(root, ...FILE), 'utf8'),
    ) as Partial<RemixOrigin>;
    return typeof parsed.from === 'string' && parsed.from ? (parsed as RemixOrigin) : null;
  } catch {
    return null;
  }
}
