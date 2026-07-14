import { runAdd } from './commands/add.js';
import { runDesign, runDesignUpdate } from './commands/design.js';
import { runLogin } from './commands/login.js';
import type { TemplateName } from './commands/new-screen-templates.js';
import { runNewScreen } from './commands/new-screen.js';
import { runRecord } from './commands/record.js';
import { runReset } from './commands/reset.js';
import { runShare } from './commands/share.js';
import { runShot } from './commands/shot.js';
import { runStart } from './commands/start.js';
import { runUpgrade } from './commands/upgrade.js';
import { findConfig } from './find-config.js';

const KNOWN_TEMPLATES: TemplateName[] = ['empty', 'home', 'list', 'detail', 'form', 'modal'];

const HELP = `Prototo — design native iOS prototypes from the terminal.

Usage:
  proto <command>

Commands:
  start                          Open your prototype in the live preview
  add <package...>               Add a library to your prototype, the safe way
  login                          Sign in so your shares are saved to your account
  share [--as <name>]            Publish your prototype and get a shareable link
  record                         Record your prototype and open it in Prototo Studio
  upgrade                        Update Prototo to the latest version
  reset                          Clear the project’s caches and start fresh
  design                         Set up your theme, accent, and component library
  design update                  Get a hint for updating your design system with Claude Code
  help                           Show this message

Examples:
  proto start
  proto share
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

  // Hidden from `proto help`: Claude Code writes screen files directly, so the
  // manual scaffolder is vestigial. Kept functional for anything that still calls it.
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

  if (command === 'login') {
    await runLogin();
    return;
  }

  if (command === 'record') {
    await runRecord();
    return;
  }

  if (command === 'reset') {
    await runReset();
    return;
  }

  if (command === 'upgrade') {
    await runUpgrade();
    return;
  }

  if (command === 'add') {
    const config = findConfig(process.cwd());
    if (!config.ok) {
      console.error(config.reason);
      process.exit(1);
    }
    const result = await runAdd({
      packages: argv.slice(3),
      cwd: config.root,
      deps: { log: (m) => console.log(m) },
    });
    if (result.ok) return;
    console.error(result.reason);
    process.exit(1);
  }

  // Hidden from `proto help`: superseded by the MCP get_simulator_screenshot tool.
  // Kept functional as the no-MCP fallback that template/AGENTS.md still documents.
  if (command === 'shot') {
    const result = await runShot({ cwd: process.cwd() });
    if (result.ok) {
      console.log(result.path);
      return;
    }
    console.error(result.reason);
    process.exit(1);
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
