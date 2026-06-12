import { spawn } from 'node:child_process';

// Runs a command to completion, capturing stdout/stderr. Injectable for tests.
export type UpdateRunner = (
  cmd: string,
  args: string[],
  opts: { cwd: string; env?: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr: string; code: number }>;

export type PublishUpdateInput = {
  root: string; // the prototype project directory
  branch: string; // the share token — EAS Update branch name
  projectId: string; // the central prototo-share EAS project id (for the update URL)
  scheme?: string; // the dev client's scheme (default 'prototo')
  message?: string;
};

export type PublishUpdateResult =
  | { ok: true; deepLink: string; updateUrl: string; groupId: string }
  | { ok: false; error: string };

/**
 * Publishes a prototype's real bundle as an EAS Update on the central project
 * (branch = token), then constructs the dev-client deep link that loads it on
 * Appetize. The bundle is hosted by EAS Update (u.expo.dev) — no custom CDN.
 */
export async function publishUpdate(
  input: PublishUpdateInput,
  run: UpdateRunner = defaultRunner,
): Promise<PublishUpdateResult> {
  const { root, branch, projectId, scheme = 'prototo', message = 'Prototo share' } = input;

  const res = await run(
    'npx',
    ['eas', 'update', '--branch', branch, '--message', message, '--json', '--non-interactive'],
    { cwd: root },
  );

  if (res.code !== 0) {
    return { ok: false, error: res.stderr.trim() || `eas update exited ${res.code}` };
  }

  let updates: Array<{ group?: string; platform?: string }>;
  try {
    const parsed = JSON.parse(res.stdout);
    updates = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return { ok: false, error: 'could not parse eas update output' };
  }

  const groupId = (updates.find((u) => u.platform === 'ios') ?? updates[0])?.group;
  if (!groupId) {
    return { ok: false, error: 'eas update returned no update group' };
  }

  const updateUrl = `https://u.expo.dev/${projectId}/group/${groupId}`;
  const deepLink = `${scheme}://expo-development-client/?url=${updateUrl}`;
  return { ok: true, deepLink, updateUrl, groupId };
}

function defaultRunner(
  cmd: string,
  args: string[],
  opts: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    child.on('exit', (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    child.on('error', (e) => resolve({ stdout, stderr: stderr + String(e), code: 1 }));
  });
}
