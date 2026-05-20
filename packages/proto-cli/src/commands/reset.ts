import { intro, log, outro, spinner } from '@clack/prompts';
import { messages } from '../messages.js';
import { findConfig } from '../find-config.js';
import { makeKillPort } from '../kill-port.js';
import { clearCaches } from '../clear-caches.js';

export async function runReset(): Promise<void> {
  intro(messages.startingHeader);

  const config = findConfig(process.cwd());
  if (!config.ok) {
    log.error(config.reason);
    process.exit(1);
  }

  const s = spinner();
  s.start(messages.resetting);

  const killPort = makeKillPort();
  await killPort(8081);
  await killPort(3001);
  await clearCaches(config.root);

  s.stop(messages.resetDone);
  outro(messages.resetDone);
}
