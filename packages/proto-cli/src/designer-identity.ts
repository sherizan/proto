import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const MAX_LEN = 60;

export type RunCommand = (cmd: string, args: string[]) => string;
export type PromptFn = (message: string) => Promise<string>;

export type IdentityDeps = {
  run: RunCommand;
  prompt: PromptFn;
  configRoot: string;
};

export type IdentityOptions = {
  cliOverride?: string;
  deps?: Partial<IdentityDeps>;
};

const defaultRun: RunCommand = (cmd, args) =>
  execFileSync(cmd, args, { stdio: 'pipe' }).toString();

const defaultPrompt: PromptFn = async () => {
  // Minimal stub. Real prompt provided by commands/share.ts via @clack/prompts.
  return '';
};

function defaultConfigRoot(): string {
  return os.homedir();
}

function configFilePath(configRoot: string): string {
  return path.join(configRoot, '.prototo', 'config.json');
}

function readCached(configRoot: string): string | null {
  try {
    const raw = fs.readFileSync(configFilePath(configRoot), 'utf8');
    const obj = JSON.parse(raw) as { designerName?: unknown };
    return typeof obj.designerName === 'string' ? obj.designerName.trim() : null;
  } catch {
    return null;
  }
}

function persistCached(configRoot: string, designerName: string): void {
  const dir = path.dirname(configFilePath(configRoot));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configFilePath(configRoot), JSON.stringify({ designerName }, null, 2));
}

function tryGit(run: RunCommand): string | null {
  try {
    const out = run('git', ['config', 'user.name']);
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function clamp(name: string): string {
  return name.length > MAX_LEN ? name.slice(0, MAX_LEN) : name;
}

export async function getDesignerName(opts: IdentityOptions = {}): Promise<string> {
  const deps: IdentityDeps = {
    run: opts.deps?.run ?? defaultRun,
    prompt: opts.deps?.prompt ?? defaultPrompt,
    configRoot: opts.deps?.configRoot ?? defaultConfigRoot(),
  };

  if (opts.cliOverride && opts.cliOverride.trim().length > 0) {
    return clamp(opts.cliOverride.trim());
  }

  const cached = readCached(deps.configRoot);
  if (cached) return clamp(cached);

  const fromGit = tryGit(deps.run);
  if (fromGit) {
    const value = clamp(fromGit);
    persistCached(deps.configRoot, value);
    return value;
  }

  // Prompt loop; reject empty
  for (;;) {
    const ans = (await deps.prompt('What should we call you when sharing prototypes? ')).trim();
    if (ans.length > 0) {
      const value = clamp(ans);
      persistCached(deps.configRoot, value);
      return value;
    }
  }
}
