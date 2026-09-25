import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  allowBuilds,
  healIgnoredBuilds,
  parseIgnoredBuilds,
  withProtoReleaseAgeExclude,
} from './pnpm-builds.js';

const NOTICE = `Done in 3s
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @shopify/react-native-skia@2.6.2, sharp@0.33.5

Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
`;

describe('parseIgnoredBuilds', () => {
  it('returns the package names without versions, scoped or not', () => {
    expect(parseIgnoredBuilds(NOTICE)).toEqual(['@shopify/react-native-skia', 'sharp']);
  });
  it('returns nothing for any other output', () => {
    expect(parseIgnoredBuilds('npm ERR! 404')).toEqual([]);
    expect(parseIgnoredBuilds('')).toEqual([]);
  });
});

describe('allowBuilds', () => {
  const scaffold = `node-linker: hoisted\nallowBuilds:\n  cloudflared: true\n`;

  it("flips pnpm 11's placeholder line to true", () => {
    const yaml = `node-linker: hoisted\nallowBuilds:\n  '@shopify/react-native-skia': set this to true or false\n  cloudflared: true\n`;
    expect(allowBuilds(yaml, [])).toBe(
      `node-linker: hoisted\nallowBuilds:\n  '@shopify/react-native-skia': true\n  cloudflared: true\n`,
    );
  });
  it('adds named packages under an existing allowBuilds block', () => {
    expect(allowBuilds(scaffold, ['@shopify/react-native-skia'])).toBe(
      `node-linker: hoisted\nallowBuilds:\n  '@shopify/react-native-skia': true\n  cloudflared: true\n`,
    );
  });
  it('creates the block when the file has none', () => {
    expect(allowBuilds('node-linker: hoisted', ['sharp'])).toBe(
      `node-linker: hoisted\nallowBuilds:\n  'sharp': true\n`,
    );
  });
  it('leaves an already-allowed package alone', () => {
    expect(allowBuilds(scaffold, ['cloudflared'])).toBe(scaffold);
  });
});

describe('healIgnoredBuilds', () => {
  let root: string;
  const file = () => path.join(root, 'pnpm-workspace.yaml');
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-builds-'));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('rewrites the workspace file from the install output and reports it', () => {
    fs.writeFileSync(file(), `node-linker: hoisted\nallowBuilds:\n  cloudflared: true\n`);
    expect(healIgnoredBuilds(root, NOTICE)).toBe(true);
    expect(fs.readFileSync(file(), 'utf8')).toContain(`'@shopify/react-native-skia': true`);
    expect(fs.readFileSync(file(), 'utf8')).toContain(`'sharp': true`);
  });
  it('heals a leftover placeholder with no output at all', () => {
    fs.writeFileSync(file(), `allowBuilds:\n  '@shopify/react-native-skia': set this to true or false\n`);
    expect(healIgnoredBuilds(root)).toBe(true);
    expect(fs.readFileSync(file(), 'utf8')).toBe(`allowBuilds:\n  '@shopify/react-native-skia': true\n`);
  });
  it('is a no-op for npm projects and for a clean file', () => {
    expect(healIgnoredBuilds(root, NOTICE)).toBe(false);
    fs.writeFileSync(file(), `allowBuilds:\n  cloudflared: true\n`);
    expect(healIgnoredBuilds(root)).toBe(false);
  });
});

describe('withProtoReleaseAgeExclude', () => {
  const line = "  - '@sherizan/proto-cli'";
  it('appends the exclusion block when the key is missing', () => {
    expect(withProtoReleaseAgeExclude('node-linker: hoisted\n')).toBe(
      `node-linker: hoisted\nminimumReleaseAgeExclude:\n${line}\n`,
    );
  });
  it('joins an existing list (a one-version entry is not enough)', () => {
    expect(
      withProtoReleaseAgeExclude("minimumReleaseAgeExclude:\n  - '@sherizan/proto-cli@0.8.3'\n"),
    ).toBe(`minimumReleaseAgeExclude:\n${line}\n  - '@sherizan/proto-cli@0.8.3'\n`);
  });
  it('is idempotent', () => {
    const once = withProtoReleaseAgeExclude('node-linker: hoisted\n');
    expect(withProtoReleaseAgeExclude(once)).toBe(once);
  });
  it('leaves a flow-style value alone (a second key would be invalid YAML)', () => {
    const yaml = "minimumReleaseAgeExclude: ['x']\n";
    expect(withProtoReleaseAgeExclude(yaml)).toBe(yaml);
  });
});
