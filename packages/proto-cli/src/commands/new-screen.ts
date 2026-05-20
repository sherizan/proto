import fs from 'node:fs';
import path from 'node:path';
import { intro, log, outro } from '@clack/prompts';
import { messages } from '../messages.js';
import { findConfig } from '../find-config.js';
import { toPascalCase } from '../pascal-case.js';
import { renderTemplate, type TemplateName } from './new-screen-templates.js';

export type NewScreenOptions = {
  rawName: string;
  template: TemplateName;
};

export async function runNewScreen(options: NewScreenOptions): Promise<void> {
  intro(messages.startingHeader);

  const config = findConfig(process.cwd());
  if (!config.ok) {
    log.error(config.reason);
    process.exit(1);
  }

  if (!options.rawName.trim()) {
    log.error(messages.noScreenName);
    process.exit(1);
  }

  const cased = toPascalCase(options.rawName);
  if (!cased.ok) {
    log.error(messages.invalidScreenName);
    process.exit(1);
  }
  const name = cased.name;

  const screensDir = path.join(config.root, 'screens');
  const target = path.join(screensDir, `${name}.tsx`);
  if (fs.existsSync(target)) {
    log.error(messages.screenExists(name));
    process.exit(1);
  }

  await fs.promises.mkdir(screensDir, { recursive: true });
  const source = renderTemplate(options.template, name);
  await fs.promises.writeFile(target, source, 'utf8');

  outro(messages.screenCreated(name));
}
