import { ensureAgentFiles } from '../ensure-agent-files.js';
import { ensurePrototoAppMatchesProject } from '../ensure-prototo-app.js';
import { ensureTouchDots } from '../ensure-touch-dots.js';
import { excludeProtoFromReleaseAge, healIgnoredBuilds } from '../pnpm-builds.js';
import { spawnExpo } from '../expo-spawn.js';
import { findConfig } from '../find-config.js';
import { makeKillPort } from '../kill-port.js';
import { messages } from '../messages.js';
import { createMetroScanner, persistErrors, resetErrorsFile } from '../metro-errors.js';
import { warnUnsupportedNativeModules } from '../native-modules.js';
import { type ServerHandle, startPromptServer } from '../prompt-server.js';
import { notifyUpdate } from '../update-check.js';

export type StartOptions = { verbose: boolean };

export async function runStart(_options: StartOptions): Promise<void> {
  const config = findConfig(process.cwd());
  if (!config.ok) {
    console.error(messages.noConfig);
    process.exit(1);
  }

  const killPort = makeKillPort();
  const cleared = await killPort(8081);
  if (cleared.killed > 0) {
    console.log(messages.stoppedPrevious);
  }

  let server: ServerHandle | null = null;
  try {
    server = await startPromptServer({ port: 3001, root: config.root });
  } catch (err) {
    if (err instanceof Error && /EADDRINUSE/.test(err.message)) {
      console.error(messages.portInUse);
      process.exit(1);
    }
    throw err;
  }

  await ensurePrototoAppMatchesProject({ cwd: config.root, deps: { log: (m) => console.log(m) } });

  // Pre-0.7.11 scaffolds lack AGENTS.md + .codex/config.toml (Codex support);
  // heal them in place so switching agents works on existing projects.
  ensureAgentFiles(config.root);
  // Older scaffolds lack the dev overlay Prototo Desktop's point-and-edit
  // resolves taps through; add it (and mount it) in place.
  ensureTouchDots(config.root);
  // A project that gained a native library before proto-cli 0.8.7 still carries
  // pnpm's unflipped placeholder; heal it so its next install exits 0.
  healIgnoredBuilds(config.root);
  // …and let `proto upgrade` see a CLI release on the day it ships (#75).
  excludeProtoFromReleaseAge(config.root);

  await warnUnsupportedNativeModules({ cwd: config.root, deps: { log: (m) => console.log(m) } });

  // Non-blocking, fail-open: nudge if a newer Prototo is out (throttled to ~daily),
  // and if this project's runtime is behind the one the current Prototo ships.
  await notifyUpdate((m) => console.log(m), { root: config.root });

  // Capture Metro's error state for the get_metro_errors MCP tool. Reset at
  // startup so a previous session's errors never leak into this one.
  resetErrorsFile(config.root);
  const scanner = createMetroScanner({
    onChange: (errors) => persistErrors(config.root, errors),
  });

  const expo = spawnExpo({ cwd: config.root, onLine: (line) => scanner.feed(line) });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await Promise.all([expo.kill(), server?.close()]);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await expo.waitUntilExit;
  await server?.close();
}
