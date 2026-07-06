import { describe, expect, test, vi } from 'vitest';
import { runReloadApp } from './reload-app.js';

function deps(over: Partial<Parameters<typeof runReloadApp>[0]> = {}) {
  return over;
}

function makeRun(calls: string[], impl?: (full: string) => string) {
  return vi.fn((cmd: string, args: string[]) => {
    const full = `${cmd} ${args.join(' ')}`;
    calls.push(full);
    return impl ? impl(full) : full.includes('list devices booted') ? '(Booted)' : '';
  });
}

describe('runReloadApp', () => {
  test('terminates, launches, settles, then opens the connect link — in that order', async () => {
    const calls: string[] = [];
    const out = await runReloadApp({
      deps: { run: makeRun(calls), sleep: async () => {}, env: {} },
    });
    expect(out).toContain('restarted');
    const idx = (needle: string) => calls.findIndex((c) => c.includes(needle));
    expect(idx('terminate booted com.sherizan.prototo')).toBeGreaterThan(-1);
    expect(idx('launch booted com.sherizan.prototo')).toBeGreaterThan(idx('terminate booted'));
    expect(idx('openurl')).toBeGreaterThan(idx('launch booted com.sherizan.prototo'));
    // terminal context: no ui=bare
    expect(calls.find((c) => c.includes('openurl'))).not.toContain('ui=bare');
  });

  test('appends ui=bare under PROTO_HEADLESS_SIM=1 (Prototo Desktop context)', async () => {
    const calls: string[] = [];
    await runReloadApp({
      deps: { run: makeRun(calls), sleep: async () => {}, env: { PROTO_HEADLESS_SIM: '1' } },
    });
    expect(calls.find((c) => c.includes('openurl'))).toContain('&ui=bare');
  });

  test('reports no simulator when nothing is booted', async () => {
    const out = await runReloadApp({
      deps: {
        run: vi.fn((_c: string, args: string[]) =>
          args.join(' ').includes('list devices booted') ? '(Shutdown)' : '',
        ),
        sleep: async () => {},
        env: {},
      },
    });
    expect(out).toContain('No booted Simulator');
  });

  test('a failed terminate is ignored; a failed launch is reported', async () => {
    const calls: string[] = [];
    const out = await runReloadApp({
      deps: {
        run: makeRun(calls, (full) => {
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('terminate') || full.includes('launch booted')) throw new Error('nope');
          return '';
        }),
        sleep: async () => {},
        env: {},
      },
    });
    expect(out).toContain('Couldn’t restart');
    expect(calls.some((c) => c.includes('launch booted'))).toBe(true);
  });
});
