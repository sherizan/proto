import { describe, expect, test, vi } from 'vitest';
import { getSimulatorScreenshot } from './screenshot.js';

describe('getSimulatorScreenshot', () => {
  test('returns the captured PNG as a base64 image content block', async () => {
    const png = Buffer.from('fake-png-bytes');
    const result = await getSimulatorScreenshot({
      cwd: '/proj',
      deps: {
        runShot: vi.fn(async () => ({ ok: true, path: '/proj/.proto/last-shot.png' })),
        readFile: vi.fn(() => png),
      },
    });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: 'image',
      data: png.toString('base64'),
      mimeType: 'image/png',
    });
  });

  test('returns a friendly text block when no simulator is running', async () => {
    const result = await getSimulatorScreenshot({
      cwd: '/proj',
      deps: {
        runShot: vi.fn(async () => ({ ok: false, reason: 'No preview is running yet.' })),
        readFile: vi.fn(),
      },
    });
    expect(result.content[0]).toEqual({ type: 'text', text: 'No preview is running yet.' });
  });

  test('reads the screenshot from the path runShot reports', async () => {
    const readFile = vi.fn(() => Buffer.from('x'));
    await getSimulatorScreenshot({
      cwd: '/proj',
      deps: {
        runShot: vi.fn(async () => ({ ok: true, path: '/proj/.proto/last-shot.png' })),
        readFile,
      },
    });
    expect(readFile).toHaveBeenCalledWith('/proj/.proto/last-shot.png');
  });
});
