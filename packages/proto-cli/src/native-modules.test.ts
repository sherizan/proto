import { describe, expect, it, vi } from 'vitest';
import { computeUnsupported, warnUnsupportedNativeModules } from './native-modules.js';

describe('computeUnsupported', () => {
  const isNative = (p: string) =>
    ['react-native-svg', 'expo-location', 'react-native-maps'].includes(p);

  it('flags native deps that are not in the bundled set', () => {
    const out = computeUnsupported(
      ['react-native-svg', 'expo-location', 'date-fns', 'zod'],
      ['react-native-svg'],
      isNative,
    );
    expect(out).toEqual(['expo-location']);
  });

  it('ignores JS-only deps entirely', () => {
    const out = computeUnsupported(['date-fns', 'zod', 'lodash'], [], isNative);
    expect(out).toEqual([]);
  });

  it('returns nothing when every native dep is bundled', () => {
    const out = computeUnsupported(
      ['react-native-svg', 'expo-location'],
      ['react-native-svg', 'expo-location', 'react-native-maps'],
      isNative,
    );
    expect(out).toEqual([]);
  });
});

function fakeFetch(manifest: unknown, ok = true): typeof fetch {
  return (async () => ({ ok, json: async () => manifest })) as unknown as typeof fetch;
}

describe('warnUnsupportedNativeModules', () => {
  const baseDeps = {
    isNative: (p: string) => p === 'expo-location',
    readDeps: () => ['expo-location', 'zod'],
    readSdkMajor: () => '55',
  };

  it('logs the honest update message and returns unsupported natives', async () => {
    const log = vi.fn();
    const out = await warnUnsupportedNativeModules({
      cwd: '/proj',
      deps: { ...baseDeps, log, fetch: fakeFetch({ nativeModules: ['react-native-svg'] }) },
    });
    expect(out).toEqual(['expo-location']);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/expo-location/);
    expect(log.mock.calls[0][0]).toMatch(/Prototo/i);
  });

  it('is a silent no-op when the manifest has no nativeModules field (older builds)', async () => {
    const log = vi.fn();
    const out = await warnUnsupportedNativeModules({
      cwd: '/proj',
      deps: { ...baseDeps, log, fetch: fakeFetch({ sdkMajor: 55, sha256: 'x' }) },
    });
    expect(out).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  });

  it('is a silent no-op when offline / fetch throws', async () => {
    const log = vi.fn();
    const out = await warnUnsupportedNativeModules({
      cwd: '/proj',
      deps: {
        ...baseDeps,
        log,
        fetch: (async () => {
          throw new Error('network down');
        }) as unknown as typeof fetch,
      },
    });
    expect(out).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  });

  it('only checks the given packages when `only` is passed', async () => {
    const log = vi.fn();
    const out = await warnUnsupportedNativeModules({
      cwd: '/proj',
      only: ['zod'],
      deps: { ...baseDeps, log, fetch: fakeFetch({ nativeModules: [] }) },
    });
    // zod is not native → nothing flagged even though expo-location (in full deps) would be
    expect(out).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  });
});
