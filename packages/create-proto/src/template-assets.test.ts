import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(here, '../template/assets');

function pngChunkCrcErrors(file: Buffer): string[] {
  const errors: string[] = [];
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!file.subarray(0, 8).equals(sig)) {
    return [`missing PNG signature`];
  }
  let off = 8;
  while (off + 8 <= file.length) {
    const len = file.readUInt32BE(off);
    const type = file.subarray(off + 4, off + 8);
    const dataStart = off + 8;
    const dataEnd = dataStart + len;
    const stored = file.readUInt32BE(dataEnd);
    const calc = zlib.crc32(file.subarray(off + 4, dataEnd)) >>> 0;
    if (stored !== calc) {
      errors.push(
        `${type.toString('latin1')} chunk CRC mismatch: stored 0x${stored.toString(16)} != computed 0x${calc.toString(16)}`,
      );
    }
    off = dataEnd + 4;
    if (type.toString('latin1') === 'IEND') break;
  }
  return errors;
}

describe('template PNG assets', () => {
  const pngs = fs
    .readdirSync(assetsDir)
    .filter((f) => f.toLowerCase().endsWith('.png'));

  it('has at least the icon and splash placeholders', () => {
    expect(pngs).toContain('icon.png');
    expect(pngs).toContain('splash.png');
  });

  it.each(pngs)('%s has valid chunk CRCs (decodable by expo prebuild)', (name) => {
    const file = fs.readFileSync(path.join(assetsDir, name));
    expect(pngChunkCrcErrors(file)).toEqual([]);
  });
});
