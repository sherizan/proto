import { describe, expect, test, vi } from 'vitest';
import { runScroll, runTap } from './sim-input.js';

const BOOTED = JSON.stringify({
  devices: {
    'iOS-26': [
      { udid: 'SHUT', state: 'Shutdown' },
      { udid: 'UDID-1', state: 'Booted' },
    ],
  },
});

function fakeDeps(listOutput = BOOTED) {
  const touches: Array<[string, number, number]> = [];
  const openHid = vi.fn((_udid: string) => ({
    touch: async (type: string, x: number, y: number) => {
      touches.push([type, x, y]);
    },
  }));
  return {
    touches,
    openHid,
    deps: { run: () => listOutput, sleep: async () => {}, openHid },
  };
}

describe('runTap', () => {
  test('sends begin then end at the same point on the booted device', async () => {
    const f = fakeDeps();
    const out = await runTap({ x: 0.3, y: 0.33, deps: f.deps });
    expect(f.openHid).toHaveBeenCalledWith('UDID-1');
    expect(f.touches).toEqual([
      ['begin', 0.3, 0.33],
      ['end', 0.3, 0.33],
    ]);
    expect(out).toContain('Tapped at (0.30, 0.33)');
  });

  test('reports no simulator when nothing is booted', async () => {
    const f = fakeDeps(
      JSON.stringify({ devices: { 'iOS-26': [{ udid: 'X', state: 'Shutdown' }] } }),
    );
    expect(await runTap({ x: 0.5, y: 0.5, deps: f.deps })).toContain('No booted Simulator');
    expect(f.touches).toEqual([]);
  });

  test('a missing HID addon is reported, not thrown', async () => {
    const f = fakeDeps();
    const out = await runTap({
      x: 0.5,
      y: 0.5,
      deps: {
        ...f.deps,
        openHid: () => {
          throw new Error('no addon');
        },
      },
    });
    expect(out).toContain('Couldn’t send touches');
  });
});

describe('runScroll', () => {
  test('"down" drags the finger up through the middle, holding x', async () => {
    const f = fakeDeps();
    await runScroll({ direction: 'down', deps: f.deps });
    const [first, last] = [f.touches[0], f.touches.at(-1)];
    expect(first).toEqual(['begin', 0.5, 0.75]);
    expect(last?.[0]).toBe('end');
    expect(last?.[2]).toBeCloseTo(0.25);
    expect(f.touches.every(([, x]) => x === 0.5)).toBe(true);
  });

  test('"right" drags the finger left and amount sets the distance', async () => {
    const f = fakeDeps();
    await runScroll({ direction: 'right', amount: 0.2, deps: f.deps });
    expect(f.touches[0]).toEqual(['begin', 0.6, 0.5]);
    expect(f.touches.at(-1)?.[1]).toBeCloseTo(0.4);
  });
});
