import { describe, it, expect } from 'vitest';
import { publishUpdate, type UpdateRunner } from './publish-update.js';

const PROJECT = '8c8ddf7d-1f6a-4b21-a7cc-116ec4d72c6d';

// Shape of `eas update --json`: an array of per-platform updates sharing one `group`.
function easJson(group: string): string {
  return JSON.stringify([
    { id: 'a1', group, branch: 'N62YV', platform: 'ios', runtimeVersion: 'prototo-56' },
    { id: 'a2', group, branch: 'N62YV', platform: 'android', runtimeVersion: 'prototo-56' },
  ]);
}

function runnerOk(group: string, capture?: (args: string[]) => void): UpdateRunner {
  return async (_cmd, args) => {
    capture?.(args);
    return { stdout: easJson(group), stderr: '', code: 0 };
  };
}

describe('publishUpdate', () => {
  it('publishes to the token branch and builds the dev-client deep link', async () => {
    let seenArgs: string[] = [];
    const res = await publishUpdate(
      { root: '/tmp/proj', branch: 'N62YV', projectId: PROJECT },
      runnerOk('grp-123', (a) => (seenArgs = a)),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.updateUrl).toBe(`https://u.expo.dev/${PROJECT}/group/grp-123`);
      expect(res.deepLink).toBe(
        `prototo://expo-development-client/?url=https://u.expo.dev/${PROJECT}/group/grp-123`,
      );
      expect(res.groupId).toBe('grp-123');
    }
    // publishes to the branch named after the token, non-interactively, as JSON
    expect(seenArgs).toContain('update');
    expect(seenArgs).toContain('--branch');
    expect(seenArgs).toContain('N62YV');
    expect(seenArgs).toContain('--json');
    expect(seenArgs).toContain('--non-interactive');
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
    const run: UpdateRunner = async () => ({ stdout: 'Building…not json', stderr: '', code: 0 });
    const res = await publishUpdate({ root: '/p', branch: 'N62YV', projectId: PROJECT }, run);
    expect(res.ok).toBe(false);
  });

  it('fails cleanly when no update group is present', async () => {
    const run: UpdateRunner = async () => ({ stdout: '[]', stderr: '', code: 0 });
    const res = await publishUpdate({ root: '/p', branch: 'N62YV', projectId: PROJECT }, run);
    expect(res.ok).toBe(false);
  });
});
