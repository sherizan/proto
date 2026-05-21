import { intro, log, outro, spinner } from '@clack/prompts';
import { messages } from '../messages.js';
import { findConfig } from '../find-config.js';
import { startPromptServer, type ServerHandle } from '../prompt-server.js';
import { spawnExpo } from '../expo-spawn.js';
import { filterMetroLine } from '../metro-filter.js';
import { translateMetroError } from '../error-translation.js';
import { renderQr } from '../render-qr.js';

export type StartOptions = { verbose: boolean };

export async function runStart(options: StartOptions): Promise<void> {
  intro(messages.startingHeader);

  const config = findConfig(process.cwd());
  if (!config.ok) {
    log.error(config.reason);
    process.exit(1);
  }

  let server: ServerHandle | null = null;
  try {
    server = await startPromptServer({ port: 3001 });
  } catch (err) {
    if (err instanceof Error && /EADDRINUSE/.test(err.message)) {
      log.error(messages.portInUse);
      process.exit(1);
    }
    throw err;
  }

  const s = spinner();
  s.start(messages.starting);

  let qrShown = false;
  const expo = spawnExpo({
    cwd: config.root,
    onStdoutLine: (line) => {
      if (options.verbose) console.log(line);
      const r = filterMetroLine(line);
      if (r.type === 'qr-url' && !qrShown) {
        qrShown = true;
        s.stop(messages.ready);
        console.log('\n' + renderQr(r.url) + '\n');
      }
    },
    onStderrLine: (line) => {
      if (options.verbose) console.error(line);
      log.error(translateMetroError(line));
    },
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    s.stop(messages.stopped);
    await Promise.all([expo.kill(), server?.close()]);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await expo.waitUntilExit;
  await server?.close();
  outro(messages.stopped);
}
