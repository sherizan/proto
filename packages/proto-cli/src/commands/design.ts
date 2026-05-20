import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { intro, outro, log, select, text, confirm, spinner, isCancel, cancel } from '@clack/prompts';
import { messages } from '../messages.js';
import { findConfig } from '../find-config.js';
import {
  getLibrary,
  resolveCustomLibrary,
  LIBRARY_IDS,
  type LibraryDescriptor,
  type LibraryId,
} from './design-libraries.js';
import { renderDesignDoc, type ThemeName } from './design-template.js';

export type SpawnResult = { code: number | null; stderr: string };
export type SpawnFn = (
  cmd: string,
  args: string[],
  opts: { cwd: string },
) => Promise<SpawnResult>;

export type RunDesignOptions = {
  spawnFn?: SpawnFn;
};

const THEME_ACCENT_DEFAULT: Record<ThemeName, string> = {
  liquidGlass: '#007AFF',
  materialYou: '#6750A4',
  base: '#000000',
};

export async function runDesign(options: RunDesignOptions = {}): Promise<void> {
  intro(messages.designIntro);

  const config = findConfig(process.cwd());
  if (!config.ok) {
    log.error(config.reason);
    process.exit(1);
  }

  const designPath = path.join(config.root, 'DESIGN.md');
  if (fs.existsSync(designPath)) {
    const proceed = await confirm({ message: messages.designOverwritePrompt, initialValue: false });
    if (isCancel(proceed) || proceed !== true) {
      cancel(messages.designCancelled);
      process.exit(0);
    }
  }

  const theme = (await select({
    message: messages.designThemePrompt,
    options: [
      { value: 'liquidGlass', label: 'Liquid Glass' },
      { value: 'materialYou', label: 'Material You' },
      { value: 'base', label: 'Base' },
    ],
  })) as ThemeName | symbol;
  if (isCancel(theme)) {
    cancel(messages.designCancelled);
    process.exit(0);
  }

  const accentInput = await text({
    message: messages.designAccentPrompt,
    initialValue: THEME_ACCENT_DEFAULT[theme as ThemeName],
  });
  if (isCancel(accentInput) || typeof accentInput !== 'string') {
    cancel(messages.designCancelled);
    process.exit(0);
  }
  const accent = accentInput.trim();

  const libraryChoice = (await select({
    message: messages.designLibraryPrompt,
    options: [
      { value: 'proto', label: 'Proto (built-in) — no install' },
      { value: 'tamagui', label: 'Tamagui — installs @tamagui/core' },
      { value: 'gluestack', label: 'Gluestack UI — installs @gluestack-ui/themed' },
      { value: 'react-native-paper', label: 'React Native Paper — installs react-native-paper' },
      { value: 'nativewind', label: 'NativeWind — installs nativewind' },
      { value: 'custom', label: 'Custom — bring your own package' },
    ],
  })) as LibraryId | symbol;
  if (isCancel(libraryChoice)) {
    cancel(messages.designCancelled);
    process.exit(0);
  }

  let library: LibraryDescriptor;
  if (libraryChoice === 'custom') {
    const pkg = await text({
      message: messages.designCustomPackagePrompt,
      validate: (v) => (v && v.trim().length > 0 ? undefined : 'Enter a package name'),
    });
    if (isCancel(pkg) || typeof pkg !== 'string') {
      cancel(messages.designCancelled);
      process.exit(0);
    }
    const docs = await text({ message: messages.designCustomDocsPrompt, initialValue: '' });
    if (isCancel(docs)) {
      cancel(messages.designCancelled);
      process.exit(0);
    }
    const docsClean = typeof docs === 'string' ? docs.trim() : '';
    library = resolveCustomLibrary({
      packageName: pkg.trim(),
      docs: docsClean.length > 0 ? docsClean : undefined,
    });
  } else {
    library = getLibrary(libraryChoice as Exclude<LibraryId, 'custom'>);
  }

  const appNameInput = await text({
    message: messages.designAppNamePrompt,
    initialValue: path.basename(config.root),
    validate: (v) => (v && v.trim().length > 0 ? undefined : 'Enter an app name'),
  });
  if (isCancel(appNameInput) || typeof appNameInput !== 'string') {
    cancel(messages.designCancelled);
    process.exit(0);
  }
  const appName = appNameInput.trim();

  if (library.kind === 'known' && library.installPackage) {
    const s = spinner();
    s.start(messages.designInstalling);
    const fn = options.spawnFn ?? defaultSpawn;
    const result = await fn('pnpm', ['add', library.installPackage], { cwd: config.root });
    if (result.code !== 0) {
      s.stop(messages.designInstallFailed);
      process.exit(1);
    }
    s.stop(messages.designInstalling);
  } else if (library.kind === 'custom' && library.installPackage) {
    log.info(messages.designCustomInstallHint(`pnpm add ${library.installPackage}`));
  }

  const today = new Date().toISOString().slice(0, 10);
  const md = renderDesignDoc({
    appName,
    theme: theme as ThemeName,
    accent,
    library,
    date: today,
  });
  await fs.promises.writeFile(designPath, md, 'utf8');

  log.success(messages.designReadyTitle);
  outro(messages.designReadyHint);
}

export function runDesignUpdate(): void {
  intro(messages.designIntro);
  log.info(messages.designUpdateHint);
  outro(messages.designReadyTitle);
}

function defaultSpawn(cmd: string, args: string[], opts: { cwd: string }): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => resolve({ code, stderr }));
    child.on('error', (err) => resolve({ code: 1, stderr: err.message }));
  });
}

export { LIBRARY_IDS };
