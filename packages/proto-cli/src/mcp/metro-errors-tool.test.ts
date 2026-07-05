import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { messages } from '../messages.js';
import { persistErrors } from '../metro-errors.js';
import { runGetMetroErrors } from './metro-errors-tool.js';

const tmpProject = () => fs.mkdtempSync(path.join(os.tmpdir(), 'proto-metro-tool-'));

describe('runGetMetroErrors', () => {
  it('reports a clean state when no errors file exists (proto start not run yet)', async () => {
    const cwd = tmpProject();
    expect(await runGetMetroErrors({ cwd })).toBe(messages.metroClean);
  });

  it('reports a clean state when the file exists but has no errors', async () => {
    const cwd = tmpProject();
    persistErrors(cwd, []);
    expect(await runGetMetroErrors({ cwd })).toBe(messages.metroClean);
  });

  it('reports a clean state when the file is corrupt instead of leaking a parse error', async () => {
    const cwd = tmpProject();
    fs.mkdirSync(path.join(cwd, '.proto'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.proto', 'metro-errors.json'), 'not json {');
    expect(await runGetMetroErrors({ cwd })).toBe(messages.metroClean);
  });

  it('returns each error with a designer-friendly translation, the raw text, and its screen', async () => {
    const cwd = tmpProject();
    persistErrors(
      cwd,
      [
        {
          raw: 'iOS Bundling failed 383ms index.ts (582 modules)\nUnable to resolve "components/proto/Buttonn" from "screens/Home.tsx"',
          at: '2026-07-05T00:00:00.000Z',
        },
        {
          raw: 'ERROR  TypeError: undefined is not a function\n    at Settings (screens/Settings.tsx:14:10)',
          at: '2026-07-05T00:00:01.000Z',
        },
      ],
      { now: () => '2026-07-05T00:00:02.000Z' },
    );

    const result = JSON.parse(await runGetMetroErrors({ cwd }));

    expect(result.updatedAt).toBe('2026-07-05T00:00:02.000Z');
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toEqual({
      friendly: messages.componentNotFound,
      raw: expect.stringContaining('Unable to resolve'),
      at: '2026-07-05T00:00:00.000Z',
      screen: 'Home',
    });
    expect(result.errors[1].screen).toBe('Settings');
    expect(result.errors[1].friendly).toBe(messages.generic);
  });

  it('omits screen when the error names no screen file', async () => {
    const cwd = tmpProject();
    persistErrors(cwd, [{ raw: 'ERROR  something global broke', at: '2026-07-05T00:00:00.000Z' }]);

    const result = JSON.parse(await runGetMetroErrors({ cwd }));
    expect(result.errors[0]).not.toHaveProperty('screen');
  });
});
