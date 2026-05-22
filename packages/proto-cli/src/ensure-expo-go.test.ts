import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureExpoGoMatchesProject, parseExpoGoVersion } from './ensure-expo-go.js';

function makeProject(expoVersion: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ensure-go-'));
  const expoPkg = path.join(dir, 'node_modules', 'expo');
  fs.mkdirSync(expoPkg, { recursive: true });
  fs.writeFileSync(
    path.join(expoPkg, 'package.json'),
    JSON.stringify({ name: 'expo', version: expoVersion }),
  );
  return dir;
}

describe('parseExpoGoVersion', () => {
  it('extracts CFBundleShortVersionString from the Expo Go block', () => {
    const sample = `
      "some.other.app" = {
        ApplicationType = "User";
        CFBundleShortVersionString = "99.0.0";
      };
      "host.exp.Exponent" = {
        ApplicationType = "User";
        CFBundleIdentifier = "host.exp.Exponent";
        CFBundleShortVersionString = "55.0.34";
      };
    `;
    expect(parseExpoGoVersion(sample)).toBe('55.0.34');
  });

  it('returns null when Expo Go is not present', () => {
    expect(parseExpoGoVersion('"com.apple.notes" = { CFBundleShortVersionString = "1.0"; };')).toBe(
      null,
    );
  });

  it('returns null when block has no version string', () => {
    expect(parseExpoGoVersion('"host.exp.Exponent" = { CFBundleIdentifier = "host.exp.Exponent"; };')).toBe(
      null,
    );
  });
});

describe('ensureExpoGoMatchesProject', () => {
  let project: string;

  beforeEach(() => {
    project = makeProject('55.0.26');
  });

  afterEach(() => {
    if (fs.existsSync(project)) fs.rmSync(project, { recursive: true, force: true });
  });

  function joinArgs(args: string[]): string {
    return args.join(' ');
  }

  it('no-ops when no simulator is booted', () => {
    const calls: string[] = [];
    ensureExpoGoMatchesProject({
      cwd: project,
      run: (cmd, args) => {
        const full = `${cmd} ${joinArgs(args)}`;
        calls.push(full);
        if (full.includes('list devices booted')) return '== Devices ==\n-- iOS 26.0 --\n';
        return '';
      },
    });
    expect(calls.some((c) => c.includes('uninstall'))).toBe(false);
  });

  it('no-ops when Expo Go is not installed', () => {
    const calls: string[] = [];
    ensureExpoGoMatchesProject({
      cwd: project,
      run: (cmd, args) => {
        const full = `${cmd} ${joinArgs(args)}`;
        calls.push(full);
        if (full.includes('list devices booted')) return '(Booted)';
        if (full.includes('listapps')) return '"com.apple.something" = { };';
        return '';
      },
    });
    expect(calls.some((c) => c.includes('uninstall'))).toBe(false);
  });

  it('no-ops when Expo Go major matches project SDK', () => {
    const calls: string[] = [];
    ensureExpoGoMatchesProject({
      cwd: project,
      run: (cmd, args) => {
        const full = `${cmd} ${joinArgs(args)}`;
        calls.push(full);
        if (full.includes('list devices booted')) return '(Booted)';
        if (full.includes('listapps'))
          return '"host.exp.Exponent" = { CFBundleShortVersionString = "55.0.30"; };';
        return '';
      },
    });
    expect(calls.some((c) => c.includes('uninstall'))).toBe(false);
  });

  it('uninstalls Expo Go when major version mismatches', () => {
    const calls: string[] = [];
    const logs: string[] = [];
    ensureExpoGoMatchesProject({
      cwd: project,
      run: (cmd, args) => {
        const full = `${cmd} ${joinArgs(args)}`;
        calls.push(full);
        if (full.includes('list devices booted')) return '(Booted)';
        if (full.includes('listapps'))
          return '"host.exp.Exponent" = { CFBundleShortVersionString = "54.0.7"; };';
        return '';
      },
      log: (m) => logs.push(m),
    });
    expect(calls.some((c) => c.includes('uninstall booted host.exp.Exponent'))).toBe(true);
    expect(logs.some((m) => m.includes('Refreshing'))).toBe(true);
  });

  it('no-ops silently when xcrun is unavailable', () => {
    expect(() =>
      ensureExpoGoMatchesProject({
        cwd: project,
        run: () => {
          throw new Error('xcrun: command not found');
        },
      }),
    ).not.toThrow();
  });

  it('no-ops when project has no expo dep installed', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-empty-'));
    const calls: string[] = [];
    ensureExpoGoMatchesProject({
      cwd: empty,
      run: (cmd, args) => {
        calls.push(`${cmd} ${joinArgs(args)}`);
        return '';
      },
    });
    expect(calls.length).toBe(0);
    fs.rmSync(empty, { recursive: true, force: true });
  });
});
