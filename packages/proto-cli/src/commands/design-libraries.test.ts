import { describe, expect, it } from 'vitest';
import {
  LIBRARY_IDS,
  getLibrary,
  resolveCustomLibrary,
  type LibraryDescriptor,
} from './design-libraries.js';

describe('design-libraries', () => {
  it('exposes all known library ids in declaration order', () => {
    expect(LIBRARY_IDS).toEqual([
      'proto',
      'tamagui',
      'gluestack',
      'react-native-paper',
      'nativewind',
      'custom',
    ]);
  });

  it('returns descriptor for built-in proto', () => {
    const lib = getLibrary('proto') as LibraryDescriptor;
    expect(lib.kind).toBe('builtin');
    expect(lib.designPackage).toBe('proto (built-in)');
    expect(lib.importFrom).toBe('../components/proto');
    expect(lib.installPackage).toBeNull();
  });

  it('exposes motion / gestures / lottie / canvas subpaths on the proto descriptor', () => {
    const lib = getLibrary('proto') as LibraryDescriptor;
    expect(lib.subpaths).toBeDefined();
    const names = (lib.subpaths ?? []).map((s) => s.name);
    expect(names).toEqual(['motion', 'gestures', 'lottie', 'canvas']);
    const importFroms = (lib.subpaths ?? []).map((s) => s.importFrom);
    expect(importFroms).toEqual([
      '../components/proto/motion',
      '../components/proto/gestures',
      '../components/proto/lottie',
      '../components/proto/canvas',
    ]);
  });

  it('does not attach subpaths to non-proto libraries', () => {
    expect((getLibrary('tamagui') as LibraryDescriptor).subpaths).toBeUndefined();
    expect((getLibrary('gluestack') as LibraryDescriptor).subpaths).toBeUndefined();
    expect((getLibrary('react-native-paper') as LibraryDescriptor).subpaths).toBeUndefined();
    expect((getLibrary('nativewind') as LibraryDescriptor).subpaths).toBeUndefined();
    expect(resolveCustomLibrary({ packageName: '@acme/ui' }).subpaths).toBeUndefined();
  });

  it('returns descriptor for tamagui with install package', () => {
    const lib = getLibrary('tamagui') as LibraryDescriptor;
    expect(lib.kind).toBe('known');
    expect(lib.installPackage).toBe('@tamagui/core');
    expect(lib.importFrom).toBe('@tamagui/core');
    expect(lib.docs).toBe('https://tamagui.dev/docs/components');
    expect(lib.fallback).toBe('proto');
  });

  it('returns descriptor for gluestack', () => {
    const lib = getLibrary('gluestack') as LibraryDescriptor;
    expect(lib.installPackage).toBe('@gluestack-ui/themed');
    expect(lib.docs).toBe('https://ui.gluestack.io/docs');
  });

  it('returns descriptor for react-native-paper', () => {
    const lib = getLibrary('react-native-paper') as LibraryDescriptor;
    expect(lib.installPackage).toBe('react-native-paper');
    expect(lib.docs).toBe('https://callstack.github.io/react-native-paper');
  });

  it('returns descriptor for nativewind', () => {
    const lib = getLibrary('nativewind') as LibraryDescriptor;
    expect(lib.installPackage).toBe('nativewind');
    expect(lib.docs).toBe('https://www.nativewind.dev/docs');
  });

  it('resolves custom library from a package name', () => {
    const lib = resolveCustomLibrary({ packageName: '@acme/ui', docs: 'https://acme.dev' });
    expect(lib.kind).toBe('custom');
    expect(lib.installPackage).toBe('@acme/ui');
    expect(lib.importFrom).toBe('@acme/ui');
    expect(lib.designPackage).toBe('@acme/ui');
    expect(lib.docs).toBe('https://acme.dev');
    expect(lib.fallback).toBe('proto');
  });

  it('omits docs line when not provided for custom', () => {
    const lib = resolveCustomLibrary({ packageName: '@acme/ui' });
    expect(lib.docs).toBeUndefined();
  });
});
