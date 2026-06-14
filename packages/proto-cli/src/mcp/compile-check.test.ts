import { describe, expect, test, vi } from 'vitest';
import { runCompileCheck } from './compile-check.js';

function deps(overrides: Partial<Parameters<typeof runCompileCheck>[0]['deps']> = {}) {
  return {
    run: vi.fn(() => ''),
    existsSync: vi.fn(() => true),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    ...overrides,
  };
}

describe('runCompileCheck', () => {
  test('reports no errors when tsc output is clean', async () => {
    const out = await runCompileCheck({ cwd: '/proj', deps: deps() });
    expect(out).toBe('No errors.');
  });

  test('invokes tsc against the managed .proto config', async () => {
    const d = deps();
    await runCompileCheck({ cwd: '/proj', deps: d });
    expect(d.run).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining(['tsc', '--noEmit', '-p', '.proto/tsconfig.mcp.json']),
      { cwd: '/proj' },
    );
  });

  test('writes the managed tsconfig when it is missing', async () => {
    const d = deps({ existsSync: vi.fn(() => false) });
    await runCompileCheck({ cwd: '/proj', deps: d });
    expect(d.mkdir).toHaveBeenCalled();
    expect(d.writeFile).toHaveBeenCalledTimes(1);
    const written = d.writeFile.mock.calls[0][1] as string;
    expect(written).toContain('expo/tsconfig.base');
    expect(written).toContain('screens');
  });

  test('does not rewrite the managed tsconfig when it already exists', async () => {
    const d = deps({ existsSync: vi.fn(() => true) });
    await runCompileCheck({ cwd: '/proj', deps: d });
    expect(d.writeFile).not.toHaveBeenCalled();
  });

  test('translates tsc errors into friendly copy', async () => {
    const d = deps({
      run: vi.fn(
        () => "screens/Home.tsx(3,21): error TS2307: Cannot find module '../components/prto'.",
      ),
    });
    const out = await runCompileCheck({ cwd: '/proj', deps: d });
    expect(out).toContain('Home.tsx');
    expect(out).toContain("import couldn't be resolved");
  });

  test('filters to a single screen when screenName is given', async () => {
    const d = deps({
      run: vi.fn(() =>
        [
          "screens/Home.tsx(3,21): error TS2307: Cannot find module './x'.",
          "screens/Settings.tsx(8,12): error TS2322: Type 'string' is not assignable to type 'number'.",
        ].join('\n'),
      ),
    });
    const out = await runCompileCheck({ cwd: '/proj', screenName: 'Settings', deps: d });
    expect(out).toContain('Settings.tsx');
    expect(out).not.toContain('Home.tsx');
  });

  test('accepts a screenName that already includes the .tsx extension', async () => {
    const d = deps({
      run: vi.fn(
        () =>
          "screens/Settings.tsx(8,12): error TS2322: Type 'string' is not assignable to type 'number'.",
      ),
    });
    const out = await runCompileCheck({ cwd: '/proj', screenName: 'Settings.tsx', deps: d });
    expect(out).toContain('Settings.tsx');
  });

  test('returns a graceful message when tsc cannot be run', async () => {
    const d = deps({
      run: vi.fn(() => {
        throw new Error('spawn npx ENOENT');
      }),
    });
    const out = await runCompileCheck({ cwd: '/proj', deps: d });
    expect(out).toContain("Couldn't type-check");
  });
});
