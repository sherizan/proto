import { describe, expect, it } from 'vitest';
import { capturePreview } from './preview-shot.js';

describe('capturePreview', () => {
  it('screenshots the booted Simulator, scales it, and returns the PNG bytes', async () => {
    const calls: string[][] = [];
    const res = await capturePreview({
      run: (cmd, args) => {
        calls.push([cmd, ...args]);
        if (args[0] === 'simctl' && args[1] === 'list') return 'iPhone 17 Pro (Booted)';
        return '';
      },
      readFile: () => Buffer.from('png'),
      cleanup: () => {},
    });
    expect(res).toEqual({ ok: true, bytes: Buffer.from('png') });
    expect(calls[1]?.slice(0, 5)).toEqual(['xcrun', 'simctl', 'io', 'booted', 'screenshot']);
    // scaled to 600 px wide for the share page + social card, not the 3x raw
    expect(calls[2]).toEqual(expect.arrayContaining(['sips', '--resampleWidth', '600']));
  });

  it('skips quietly when no Simulator is booted', async () => {
    const res = await capturePreview({
      run: (_cmd, args) => (args[1] === 'list' ? 'iPhone 17 Pro (Shutdown)' : ''),
      readFile: () => Buffer.from('png'),
      cleanup: () => {},
    });
    expect(res).toEqual({ ok: false });
  });

  it('skips quietly when the capture or scale fails', async () => {
    const res = await capturePreview({
      run: (_cmd, args) => {
        if (args[1] === 'list') return '(Booted)';
        throw new Error('simctl blew up');
      },
      readFile: () => Buffer.from('png'),
      cleanup: () => {},
    });
    expect(res).toEqual({ ok: false });
  });
});
