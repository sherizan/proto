import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { intro, outro, text, spinner, isCancel, cancel, log } from '@clack/prompts';
import { messages } from './messages.js';
import { validateName } from './validate-name.js';
import { detectPm } from './detect-pm.js';
import { copyTemplate } from './copy-template.js';
import { installDeps } from './install-deps.js';
import { renderQr } from './render-qr.js';

export async function run(argv: string[]): Promise<void> {
  intro(messages.header);

  const folderArg = argv[2];
  const defaultName = folderArg ?? 'my-prototype';

  const nameInput = await text({
    message: messages.namePrompt,
    initialValue: defaultName,
    validate: (v) => {
      const r = validateName(v ?? '');
      return r.ok ? undefined : r.reason;
    },
  });
  if (isCancel(nameInput) || typeof nameInput !== 'string') {
    cancel('Cancelled.');
    process.exit(0);
  }

  const validated = validateName(nameInput);
  if (!validated.ok) {
    log.error(validated.reason);
    process.exit(1);
  }
  const name = validated.sanitized;

  const dest = path.resolve(process.cwd(), name);
  if (fs.existsSync(dest)) {
    log.error(messages.folderExists(name));
    process.exit(1);
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const templateRoot = path.resolve(here, '../template');

  const s = spinner();
  s.start(messages.settingUp);
  const today = new Date().toISOString().slice(0, 10);
  await copyTemplate({
    templateRoot,
    destRoot: dest,
    projectName: name,
    substitutions: {
      '{{APP_NAME}}': name,
      '{{DATE}}': today,
    },
  });
  s.stop(messages.filesReady);

  const pm = detectPm(process.env.npm_config_user_agent);
  const s2 = spinner();
  s2.start(messages.installing);
  try {
    await installDeps({ cwd: dest, pm });
    s2.stop(messages.ready);
  } catch (err) {
    s2.stop(err instanceof Error ? err.message : messages.installFailed);
    process.exit(1);
  }

  log.info(renderQr('http://localhost:8081'));
  outro(messages.final);
}
