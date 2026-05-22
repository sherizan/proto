import { messages } from '../messages.js';
import { findConfig } from '../find-config.js';
import { startPromptServer, type ServerHandle } from '../prompt-server.js';
import { spawnExpo } from '../expo-spawn.js';
import { makeKillPort } from '../kill-port.js';

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

  const expo = spawnExpo({ cwd: config.root });

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
