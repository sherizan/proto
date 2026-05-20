import { runStart } from './commands/start.js';

export async function dispatch(argv: string[]): Promise<void> {
  const command = argv[2];
  const flags = new Set(argv.slice(3));

  if (command === 'start' || command === undefined) {
    await runStart({ verbose: flags.has('--verbose') });
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
