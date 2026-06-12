import { describe, expect, it, vi } from 'vitest';
import { CliLoginError } from '../cli-login.js';
import { type LoginDeps, runLogin } from './login.js';

const TOKEN = 'proto_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234';

function makeDeps(overrides: Partial<LoginDeps>): LoginDeps {
  return {
    loginFlow: async () => TOKEN,
    saveCliToken: () => {},
    log: () => {},
    ...overrides,
  };
}

describe('runLogin', () => {
  it('persists the minted token and reports success', async () => {
    const saveCliToken = vi.fn();
    const logs: string[] = [];
    const token = await runLogin(makeDeps({ saveCliToken, log: (m) => logs.push(m) }));

    expect(token).toBe(TOKEN);
    expect(saveCliToken).toHaveBeenCalledWith(TOKEN);
    expect(logs.join('\n')).toContain('signed in');
  });

  it('returns null and shows a friendly message on timeout', async () => {
    const saveCliToken = vi.fn();
    const logs: string[] = [];
    const token = await runLogin(
      makeDeps({
        loginFlow: async () => {
          throw new CliLoginError('timeout', 'timed out');
        },
        saveCliToken,
        log: (m) => logs.push(m),
      }),
    );

    expect(token).toBeNull();
    expect(saveCliToken).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain('timed out');
  });

  it('returns null and shows a friendly message on a state mismatch', async () => {
    const logs: string[] = [];
    const token = await runLogin(
      makeDeps({
        loginFlow: async () => {
          throw new CliLoginError('state-mismatch', 'bad state');
        },
        log: (m) => logs.push(m),
      }),
    );
    expect(token).toBeNull();
    expect(logs.join('\n')).toContain('didn’t complete');
  });
});
