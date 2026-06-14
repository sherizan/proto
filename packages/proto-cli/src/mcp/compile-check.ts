import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { messages } from '../messages.js';
import { translateTscError } from './tsc-error-translation.js';

type RunCommand = (cmd: string, args: string[], opts: { cwd: string }) => string;

export type CompileDeps = {
  run: RunCommand;
  existsSync: (p: string) => boolean;
  writeFile: (p: string, content: string) => void;
  mkdir: (dir: string) => void;
};

const CONFIG_REL = '.proto/tsconfig.mcp.json';

// A Proto-managed TS config so scaffolds (which ship `typescript` but no
// tsconfig) type-check with the right JSX + Expo/RN types. Lives in .proto/
// (gitignored, "managed by Proto") so it never touches the designer surface.
const MANAGED_TSCONFIG = `${JSON.stringify(
  {
    extends: '../node_modules/expo/tsconfig.base',
    compilerOptions: { noEmit: true, skipLibCheck: true },
    include: ['../screens/**/*', '../components/**/*', '../app/**/*'],
  },
  null,
  2,
)}\n`;

// tsc reports diagnostics on a non-zero exit; capture stdout regardless. Only a
// genuine spawn failure (tsc unresolvable) should bubble up as a throw.
const defaultRun: RunCommand = (cmd, args, opts) => {
  try {
    return execFileSync(cmd, args, { cwd: opts.cwd, encoding: 'utf8' });
  } catch (err) {
    const e = err as { stdout?: Buffer | string; code?: string };
    if (e.stdout !== undefined) return e.stdout.toString();
    throw err;
  }
};

const defaultDeps: CompileDeps = {
  run: defaultRun,
  existsSync: (p) => fs.existsSync(p),
  writeFile: (p, content) => fs.writeFileSync(p, content),
  mkdir: (dir) => fs.mkdirSync(dir, { recursive: true }),
};

function filterToScreen(output: string, screenName: string): string {
  const base = screenName.replace(/\.tsx?$/, '');
  const needle = `${base}.tsx`;
  return output
    .split('\n')
    .filter((line) => line.includes(needle))
    .join('\n');
}

export async function runCompileCheck(opts: {
  cwd: string;
  screenName?: string;
  deps?: Partial<CompileDeps>;
}): Promise<string> {
  const deps = { ...defaultDeps, ...opts.deps };
  const configPath = path.join(opts.cwd, CONFIG_REL);

  if (!deps.existsSync(configPath)) {
    deps.mkdir(path.dirname(configPath));
    deps.writeFile(configPath, MANAGED_TSCONFIG);
  }

  let output: string;
  try {
    output = deps.run('npx', ['tsc', '--noEmit', '-p', CONFIG_REL], { cwd: opts.cwd });
  } catch {
    return messages.compileUnavailable;
  }

  if (opts.screenName) output = filterToScreen(output, opts.screenName);
  return translateTscError(output);
}
