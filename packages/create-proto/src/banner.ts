import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ART = [
  '██████╗ ██████╗  ██████╗ ████████╗ ██████╗ ████████╗ ██████╗ ',
  '██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔═══██╗╚══██╔══╝██╔═══██╗',
  '██████╔╝██████╔╝██║   ██║   ██║   ██║   ██║   ██║   ██║   ██║',
  '██╔═══╝ ██╔══██╗██║   ██║   ██║   ██║   ██║   ██║   ██║   ██║',
  '██║     ██║  ██║╚██████╔╝   ██║   ╚██████╔╝   ██║   ╚██████╔╝',
  '╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝    ╚═╝    ╚═════╝ ',
].join('\n');

const TAGLINE = 'Describe a screen. Watch your prototype run natively on iPhone.';

export function renderBanner(version: string): string {
  return `${ART}\n\nPrototo v${version}\n${TAGLINE}\n`;
}

export function readOwnVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, '..', 'package.json'),
    path.join(here, '..', '..', 'package.json'),
  ];
  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (pkg.name === 'create-proto' && typeof pkg.version === 'string') {
        return pkg.version;
      }
    } catch {
      // continue
    }
  }
  return '0.0.0';
}
