import { runStart } from './commands/start.js';
import { runNewScreen } from './commands/new-screen.js';
import { runReset } from './commands/reset.js';
import { runDesign, runDesignUpdate } from './commands/design.js';
import { runShare } from './commands/share.js';
import type { TemplateName } from './commands/new-screen-templates.js';

const KNOWN_TEMPLATES: TemplateName[] = ['empty', 'home', 'list', 'detail', 'form', 'modal'];

const HELP = `Prototo — design native iOS prototypes from the terminal.

Usage:
  proto <command>

Commands:
  start                          Boot Metro and open the iOS Simulator
  share [--as <name>]            Start tunnel + register prototo.app/p/<token> share
  new-screen <Name> [--template] Scaffold a new screen
                                 Templates: ${KNOWN_TEMPLATES.join(', ')}
  reset                          Clear Metro + project caches
  design                         Interactive: theme + accent + component library
  design update                  Print a hint about updating DESIGN.md via Claude Code
  help                           Show this message

Examples:
  proto start
  proto new-screen Settings --template form
  proto design
  proto reset

Learn more: https://github.com/sherizan/proto
`;

export async function dispatch(argv: string[]): Promise<void> {
  const command = argv[2];

  if (command === '--help' || command === '-h' || command === 'help') {
    console.log(HELP);
    return;
  }

  if (command === 'start' || command === undefined) {
    const flags = new Set(argv.slice(3));
    await runStart({ verbose: flags.has('--verbose') });
    return;
  }

  if (command === 'share') {
    const rest = argv.slice(3);
    const asIdx = rest.indexOf('--as');
    const cliOverride =
      asIdx >= 0 && typeof rest[asIdx + 1] === 'string' ? rest[asIdx + 1] : undefined;
    await runShare({ cliOverride });
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

  if (command === 'design') {
    const sub = argv[3];
    if (sub === 'update') {
      runDesignUpdate();
      return;
    }
    await runDesign();
    return;
  }

  console.error(`Unknown command: ${command}\n`);
  console.error(HELP);
  process.exit(1);
}
