import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { intro, outro, spinner, log } from '@clack/prompts';
import { messages } from './messages.js';
import { validateName } from './validate-name.js';
import { detectPm } from './detect-pm.js';
import { copyTemplate } from './copy-template.js';
import { installDeps } from './install-deps.js';

const DEFAULT_NAME = 'my-prototype';

export async function run(argv: string[]): Promise<void> {
  intro(messages.header);

  const rawName = argv[2] ?? DEFAULT_NAME;
  if (argv[2] === undefined) {
    log.info(messages.usingDefaultName(DEFAULT_NAME));
  }
  const validated = validateName(rawName);
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

  const cleanupAndExit = () => {
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    console.log('\n' + messages.cancelled);
    process.exit(130);
  };
  process.on('SIGINT', cleanupAndExit);

  const startMs = Date.now();
  const s = spinner();
  s.start(messages.settingUp(name));

  try {
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

    const pm = detectPm(process.env.npm_config_user_agent);
    await installDeps({ cwd: dest, pm });
    const elapsed = Math.round((Date.now() - startMs) / 1000);
    s.stop(messages.installed(elapsed));
  } catch (err) {
    s.stop(err instanceof Error ? err.message : messages.installFailed);
    if (fs.existsSync(dest)) {
      log.info(messages.installFailedHint(name));
    }
    process.exit(1);
  }

  outro(messages.bootingProto);
  await spawnProtoStart(dest, name);
}

async function spawnProtoStart(cwd: string, name: string): Promise<void> {
  const protoCliBin = resolveProtoCli();
  if (!protoCliBin) {
    log.error(messages.protoCliNotFound(name));
    return;
  }

  await new Promise<void>((resolve) => {
    const child = spawn(process.execPath, [protoCliBin, 'start'], {
      cwd,
      stdio: 'inherit',
    });
    child.on('exit', () => resolve());
    child.on('error', () => {
      log.error(messages.protoCliNotFound(name));
      resolve();
    });
  });
}

function resolveProtoCli(): string | null {
  // Pre-publish dev path: walk to sibling package inside monorepo
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const sibling = path.resolve(here, '../../proto-cli/dist/index.js');
    if (fs.existsSync(sibling)) return sibling;
  } catch {}

  // Post-publish path: resolve via require
  try {
    const req = createRequire(import.meta.url);
    return req.resolve('proto-cli/dist/index.js');
  } catch {
    return null;
  }
}
