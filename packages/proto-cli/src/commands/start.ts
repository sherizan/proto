import { ensureAgentFiles } from '../ensure-agent-files.js';
import { ensurePrototoAppMatchesProject } from '../ensure-prototo-app.js';
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
    server = await startPromptServer({ port: 3001 });
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

  await warnUnsupportedNativeModules({ cwd: config.root, deps: { log: (m) => console.log(m) } });

  // Non-blocking, fail-open: nudge if a newer Prototo is out (throttled to ~daily).
  await notifyUpdate((m) => console.log(m));

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
