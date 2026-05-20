import { runStart } from './commands/start.js';
import { runNewScreen } from './commands/new-screen.js';
import { runReset } from './commands/reset.js';
import type { TemplateName } from './commands/new-screen-templates.js';

const KNOWN_TEMPLATES: TemplateName[] = ['empty', 'home', 'list', 'detail', 'form', 'modal'];

export async function dispatch(argv: string[]): Promise<void> {
  const command = argv[2];

  if (command === 'start' || command === undefined) {
    const flags = new Set(argv.slice(3));
    await runStart({ verbose: flags.has('--verbose') });
    return;
  }

  if (command === 'new-screen') {
    const rawName = argv[3] ?? '';
    const rest = argv.slice(4);
    const templateIdx = rest.indexOf('--template');
    let template: TemplateName = 'empty';
    if (templateIdx >= 0) {
      const candidate = rest[templateIdx + 1];
      if (candidate && (KNOWN_TEMPLATES as string[]).includes(candidate)) {
        template = candidate as TemplateName;
      }
    }
    await runNewScreen({ rawName, template });
    return;
  }

  if (command === 'reset') {
    await runReset();
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
