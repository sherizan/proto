import { describe, it, expect } from 'vitest';
import { publishUpdate, type UpdateRunner } from './publish-update.js';

const PROJECT = '8c8ddf7d-1f6a-4b21-a7cc-116ec4d72c6d';

// Shape of `eas update --json`: an array of per-platform updates sharing one `group`.
function easJson(group: string): string {
  return JSON.stringify([
    { id: 'a1', group, branch: 'N62YV', platform: 'ios', runtimeVersion: 'prototo-56' },
  ]);
}

type Seen = { args: string[]; env: NodeJS.ProcessEnv | undefined };

function runnerOk(group: string, seen?: Seen, stdoutPrefix = ''): UpdateRunner {
  return async (_cmd, args, opts) => {
    if (seen) {
      seen.args = args;
      seen.env = opts.env;
    }
    return { stdout: stdoutPrefix + easJson(group), stderr: '', code: 0 };
  };
}

describe('publishUpdate', () => {
  it('publishes ios/production to the token branch with the no-VCS env, and builds the deep link', async () => {
    const seen: Seen = { args: [], env: undefined };
    const res = await publishUpdate(
      { root: '/tmp/proj', branch: 'N62YV', projectId: PROJECT },
      runnerOk('grp-123', seen),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.updateUrl).toBe(`https://u.expo.dev/${PROJECT}/group/grp-123`);
      expect(res.deepLink).toBe(
        `prototo://expo-development-client/?url=https://u.expo.dev/${PROJECT}/group/grp-123`,
      );
      expect(res.groupId).toBe('grp-123');
    }
    // the exact eas update invocation we validated
    for (const flag of ['update', '--branch', 'N62YV', '--platform', 'ios', '--environment', 'production', '--non-interactive', '--json']) {
      expect(seen.args).toContain(flag);
    }
    // prototypes aren't git repos — EAS must not require VCS
    expect(seen.env?.EAS_NO_VCS).toBe('1');
  });

  it('strips git-warning pollution that EAS prints to stdout before the JSON', async () => {
    const polluted =
      'Failed to get Git root path with `git rev-parse --show-toplevel`.\nFalling back to using current working directory.\n';
    const res = await publishUpdate(
      { root: '/p', branch: 'N62YV', projectId: PROJECT },
      runnerOk('grp-xyz', undefined, polluted),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.groupId).toBe('grp-xyz');
  });

  it('honors a custom dev-client scheme', async () => {
    const res = await publishUpdate(
      { root: '/tmp/proj', branch: 'N62YV', projectId: PROJECT, scheme: 'prototoX' },
      runnerOk('g'),
    );
    expect(res.ok && res.deepLink.startsWith('prototoX://expo-development-client/?url=')).toBe(true);
  });

  it('fails cleanly on a non-zero exit', async () => {
    const run: UpdateRunner = async () => ({ stdout: '', stderr: 'not logged in', code: 1 });
    const res = await publishUpdate({ root: '/p', branch: 'N62YV', projectId: PROJECT }, run);
    expect(res.ok).toBe(false);
  });

  it('fails cleanly on unparseable output', async () => {
    const run: UpdateRunner = async () => ({ stdout: 'Building… no json here', stderr: '', code: 0 });
    const res = await publishUpdate({ root: '/p', branch: 'N62YV', projectId: PROJECT }, run);
    expect(res.ok).toBe(false);
  });

  it('fails cleanly when no update group is present', async () => {
    const run: UpdateRunner = async () => ({ stdout: '[]', stderr: '', code: 0 });
    const res = await publishUpdate({ root: '/p', branch: 'N62YV', projectId: PROJECT }, run);
    expect(res.ok).toBe(false);
  });
});
