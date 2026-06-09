import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runShot } from './shot.js';

function makeRun(outputs: Record<string, string>, calls: string[][]) {
  return (cmd: string, args: string[]) => {
    calls.push([cmd, ...args]);
    const key = [cmd, ...args].join(' ');
    for (const [match, out] of Object.entries(outputs)) {
      if (key.includes(match)) return out;
    }
    return '';
  };
}

describe('runShot', () => {
  it('captures the booted simulator to .proto/last-shot.png and returns the path', async () => {
    const calls: string[][] = [];
    const run = makeRun({ 'simctl list devices booted': 'iPhone 16 (ABC) (Booted)' }, calls);
    const mkdir = vi.fn();

    const result = await runShot({ cwd: '/proj', deps: { run, mkdir } });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe(path.join('/proj', '.proto', 'last-shot.png'));

    // ensured the output dir exists
    expect(mkdir).toHaveBeenCalledWith(path.join('/proj', '.proto'));

    // issued the screenshot to the booted device at that path
    const screenshot = calls.find((c) => c.includes('screenshot'));
    expect(screenshot).toEqual([
      'xcrun',
      'simctl',
      'io',
      'booted',
      'screenshot',
      path.join('/proj', '.proto', 'last-shot.png'),
    ]);
  });

  it('fails cleanly with a designer-friendly reason when no simulator is booted', async () => {
    const calls: string[][] = [];
    const run = makeRun({ 'simctl list devices booted': '' }, calls);

    const result = await runShot({ cwd: '/proj', deps: { run, mkdir: vi.fn() } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/proto start/i);
    // never attempted a screenshot
    expect(calls.find((c) => c.includes('screenshot'))).toBeUndefined();
  });

  it('fails cleanly when the screenshot command throws', async () => {
    const calls: string[][] = [];
    const run = (cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      if (args.includes('booted') && args.includes('list')) return 'Booted';
      throw new Error('xcrun: device busy');
    };

    const result = await runShot({ cwd: '/proj', deps: { run, mkdir: vi.fn() } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).not.toMatch(/xcrun|Error/);
  });
});
