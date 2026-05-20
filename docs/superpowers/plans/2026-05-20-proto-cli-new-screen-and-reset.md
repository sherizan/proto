# proto-cli `new-screen` + `reset` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two more commands to `proto-cli` — `proto new-screen <name> [--template <kind>]` for screen scaffolding, and `proto reset` for the designer's escape hatch (kill orphan processes + clear caches).

**Architecture:** Both commands plug into the existing `cli.ts` dispatcher. `new-screen` reuses `find-config`, adds a `toPascalCase` helper, renders one of 5 inline string templates (`empty`, `home`, `list`, `detail`, `form`, `modal`), and writes the file. `reset` reuses `find-config`, then calls two injectable helpers — `kill-port` (wraps `lsof` + `kill` for ports 8081 and 3001 via `spawn` with explicit args, no shell) and `clear-caches` (drops `.expo/` and `node_modules/.cache/`). All logic modules have Vitest tests; orchestrators don't.

**Tech Stack:** TypeScript ESM, NodeNext resolution. Built-in `node:fs` and `spawn` from `node:child_process` only — never `exec` or `execFile` with concatenated input. Vitest.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-20-proto-cli-new-screen-and-reset-design.md`
- Master doc §15 Prompts 6 + 7
- CLAUDE.md — TDD for CLI logic; no engineering jargon

**Project state (relative paths from repo root):**
- Existing proto-cli modules: `packages/proto-cli/src/{messages,find-config,prompt-server,metro-filter,error-translation,expo-spawn,render-qr,cli}.ts` + `commands/start.ts` + `index.ts`.
- All relative imports in `src/*.ts` end with `.js` (NodeNext). Test files don't need `.js`.
- `noUncheckedIndexedAccess` is on — narrow array accesses (`if (m && m[1])`) rather than non-null asserting.
- `pnpm` at `~/.local/bin/pnpm` — prepend `export PATH="$HOME/.local/bin:$PATH"` to every shell command that calls pnpm.

---

## File Structure

Two existing files modified, eight new files created:

```
packages/proto-cli/src/
├── messages.ts                          (Task 1) — modify
├── messages.test.ts                     (no change — audit auto-covers new strings)
├── pascal-case.ts                       (Task 2) — new
├── pascal-case.test.ts                  (Task 2) — new
├── kill-port.ts                         (Task 3) — new
├── kill-port.test.ts                    (Task 3) — new
├── clear-caches.ts                      (Task 4) — new
├── clear-caches.test.ts                 (Task 4) — new
├── cli.ts                               (Task 7) — modify
└── commands/
    ├── new-screen.ts                    (Task 6) — new
    ├── new-screen-templates.ts          (Task 5) — new
    ├── new-screen-templates.test.ts     (Task 5) — new
    └── reset.ts                         (Task 6) — new
```

---

## Task 1: Extend `messages.ts` with new-screen + reset strings

**Files:**
- Modify: `packages/proto-cli/src/messages.ts`

The existing `messages.test.ts` iterates `Object.values(messages)` for the jargon audit, so it will automatically cover the new strings. No test file edits needed.

- [ ] **Step 1: Replace `packages/proto-cli/src/messages.ts` with:**

```ts
export const messages = {
  startingHeader: 'Proto',
  noConfig: 'Run this inside a Proto project.',
  starting: 'Starting',
  ready: 'Scan the QR to preview on your device',
  stopped: 'Proto stopped.',
  portInUse:
    'Proto is already running in another window. Close it first, then try again.',
  componentNotFound:
    "A component couldn't be found. Run: proto reset",
  screenSyntax:
    'A screen has an error. Run: proto edit <screen-name> "fix any errors"',
  noDeviceConnection:
    "Can't reach your device. Check you're on the same WiFi.",
  generic: 'Something went wrong. Run: proto reset',
  noScreenName: 'Give your screen a name. Like: proto new-screen Profile',
  invalidScreenName:
    'That name has characters that cause trouble. Use letters and hyphens.',
  screenExists: (name: string) =>
    `A screen named "${name}" already exists. Pick a different name or delete it first.`,
  screenCreated: (name: string) => `${name} screen created → it's live on your device`,
  resetting: 'Resetting Proto',
  resetDone: 'Proto reset. Run: proto start',
};

export type Messages = typeof messages;
```

- [ ] **Step 2: Run the existing jargon-audit test**

```bash
export PATH="$HOME/.local/bin:$PATH"
pnpm --filter proto-cli test
```

Expected: all 31 tests still pass. The jargon audit iterates the new strings — if any contains banned fragments (`npm`, `pnpm`, `node`, `expo`, `metro`, `error code`, `stack`) or a version-like substring, it fails. The strings above were drafted to avoid all of those.

- [ ] **Step 3: Typecheck**

```bash
export PATH="$HOME/.local/bin:$PATH"
pnpm --filter proto-cli typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/proto-cli/src/messages.ts
git commit -m "feat(proto-cli): add messages for new-screen and reset"
```

---

## Task 2: pascal-case.ts (name normalisation)

**Files:**
- Create: `packages/proto-cli/src/pascal-case.test.ts`
- Create: `packages/proto-cli/src/pascal-case.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/pascal-case.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { toPascalCase } from './pascal-case';

describe('toPascalCase', () => {
  it('PascalCases a multi-word lowercase name', () => {
    expect(toPascalCase('my profile')).toEqual({ ok: true, name: 'MyProfile' });
  });

  it('handles hyphens', () => {
    expect(toPascalCase('todo-list')).toEqual({ ok: true, name: 'TodoList' });
  });

  it('handles underscores', () => {
    expect(toPascalCase('user_settings')).toEqual({ ok: true, name: 'UserSettings' });
  });

  it('keeps an already-PascalCased single word', () => {
    expect(toPascalCase('Settings')).toEqual({ ok: true, name: 'Settings' });
  });

  it('lowercases then PascalCases mixed case input', () => {
    expect(toPascalCase('MyProfile')).toEqual({ ok: true, name: 'Myprofile' });
  });

  it('trims surrounding whitespace', () => {
    expect(toPascalCase('  hello world  ')).toEqual({ ok: true, name: 'HelloWorld' });
  });

  it('rejects empty input', () => {
    expect(toPascalCase('')).toEqual({ ok: false });
    expect(toPascalCase('   ')).toEqual({ ok: false });
  });

  it('rejects names that start with a digit after normalisation', () => {
    expect(toPascalCase('1app')).toEqual({ ok: false });
    expect(toPascalCase('123')).toEqual({ ok: false });
  });

  it('rejects names that contain only non-alphanumeric characters', () => {
    expect(toPascalCase('---')).toEqual({ ok: false });
    expect(toPascalCase('!@#')).toEqual({ ok: false });
  });
});
```

Note: the "mixed case input" case (`MyProfile` → `Myprofile`) is a deliberate design choice. The algorithm splits on non-alphanum, lowercases each chunk, then capitalises the first letter. So `MyProfile` is treated as a single chunk `myprofile` → `Myprofile`. This is fine for screen names because we accept the lowercase + hyphen convention as input.

- [ ] **Step 2: Run — expect failure**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 3: Create `packages/proto-cli/src/pascal-case.ts`**

```ts
export type PascalCaseResult =
  | { ok: true; name: string }
  | { ok: false };

export function toPascalCase(input: string): PascalCaseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false };
  const parts = trimmed.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return { ok: false };
  const name = parts
    .map((part) => {
      const lower = part.toLowerCase();
      const first = lower.charAt(0);
      return first.toUpperCase() + lower.slice(1);
    })
    .join('');
  if (!/^[A-Za-z]/.test(name)) return { ok: false };
  return { ok: true, name };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/pascal-case.ts packages/proto-cli/src/pascal-case.test.ts
git commit -m "feat(proto-cli): pascalCase helper for screen names"
```

---

## Task 3: kill-port.ts (injectable lsof + kill via `spawn`)

`kill-port` calls `lsof -ti :<port>` to enumerate PIDs, then `kill <pid>` for each. The implementation uses `spawn` from `node:child_process` with explicit string args (no shell). The helper that runs each invocation is named `runCmd` (not `exec`) to make it obvious there's no shell-eval pathway.

**Files:**
- Create: `packages/proto-cli/src/kill-port.test.ts`
- Create: `packages/proto-cli/src/kill-port.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/kill-port.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeKillPort, type RunCmdFn } from './kill-port';

function makeRunCmd(initial: {
  [argv: string]: { stdout: string; code: number | null };
}): { fn: RunCmdFn; calls: Array<{ cmd: string; args: string[] }> } {
  const calls: Array<{ cmd: string; args: string[] }> = [];
  const fn: RunCmdFn = async (cmd, args) => {
    calls.push({ cmd, args });
    const key = [cmd, ...args].join(' ');
    return initial[key] ?? { stdout: '', code: 0 };
  };
  return { fn, calls };
}

describe('makeKillPort', () => {
  it('runs lsof for the given port and kills each PID', async () => {
    const { fn, calls } = makeRunCmd({
      'lsof -ti :8081': { stdout: '1234\n5678\n', code: 0 },
    });
    const killPort = makeKillPort({ runCmd: fn });
    const result = await killPort(8081);

    expect(result.killed).toBe(2);
    expect(calls).toEqual([
      { cmd: 'lsof', args: ['-ti', ':8081'] },
      { cmd: 'kill', args: ['1234'] },
      { cmd: 'kill', args: ['5678'] },
    ]);
  });

  it('returns killed: 0 when no PIDs are found', async () => {
    const { fn, calls } = makeRunCmd({
      'lsof -ti :3001': { stdout: '', code: 1 },
    });
    const killPort = makeKillPort({ runCmd: fn });
    const result = await killPort(3001);

    expect(result.killed).toBe(0);
    expect(calls).toEqual([{ cmd: 'lsof', args: ['-ti', ':3001'] }]);
  });

  it('ignores empty lines and whitespace in lsof output', async () => {
    const { fn, calls } = makeRunCmd({
      'lsof -ti :8081': { stdout: '\n1111\n\n  2222\n', code: 0 },
    });
    const killPort = makeKillPort({ runCmd: fn });
    const result = await killPort(8081);

    expect(result.killed).toBe(2);
    expect(calls.slice(1)).toEqual([
      { cmd: 'kill', args: ['1111'] },
      { cmd: 'kill', args: ['2222'] },
    ]);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 3: Create `packages/proto-cli/src/kill-port.ts`**

```ts
import { spawn } from 'node:child_process';

export type RunCmdResult = { stdout: string; code: number | null };
export type RunCmdFn = (cmd: string, args: string[]) => Promise<RunCmdResult>;
export type KillPortFn = (port: number) => Promise<{ killed: number }>;
export type KillPortDeps = { runCmd?: RunCmdFn };

export function makeKillPort(deps: KillPortDeps = {}): KillPortFn {
  const runCmd = deps.runCmd ?? defaultRunCmd;
  return async (port) => {
    const lsof = await runCmd('lsof', ['-ti', `:${port}`]);
    const pids = lsof.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const pid of pids) {
      await runCmd('kill', [pid]);
    }
    return { killed: pids.length };
  };
}

function defaultRunCmd(cmd: string, args: string[]): Promise<RunCmdResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let stdout = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.on('exit', (code) => resolve({ stdout, code }));
    child.on('error', () => resolve({ stdout, code: 1 }));
  });
}
```

The `spawn` call is fed an explicit command and an array of args — no shell, no string concatenation.

- [ ] **Step 4: Run — expect pass**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/kill-port.ts packages/proto-cli/src/kill-port.test.ts
git commit -m "feat(proto-cli): kill processes bound to a port via lsof"
```

---

## Task 4: clear-caches.ts (drop .expo/ and node_modules/.cache/)

**Files:**
- Create: `packages/proto-cli/src/clear-caches.test.ts`
- Create: `packages/proto-cli/src/clear-caches.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/clear-caches.test.ts`**

```ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { clearCaches } from './clear-caches';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-clear-test-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('clearCaches', () => {
  it('removes .expo/ when it exists', async () => {
    const expoDir = path.join(tmpRoot, '.expo');
    fs.mkdirSync(expoDir);
    fs.writeFileSync(path.join(expoDir, 'a.json'), '{}');

    const result = await clearCaches(tmpRoot);

    expect(fs.existsSync(expoDir)).toBe(false);
    expect(result.cleared).toContain('.expo');
  });

  it('removes node_modules/.cache/ when it exists', async () => {
    const cacheDir = path.join(tmpRoot, 'node_modules', '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'b.bin'), 'x');

    const result = await clearCaches(tmpRoot);

    expect(fs.existsSync(cacheDir)).toBe(false);
    expect(result.cleared).toContain('node_modules/.cache');
  });

  it('returns an empty cleared list when nothing exists', async () => {
    const result = await clearCaches(tmpRoot);
    expect(result.cleared).toEqual([]);
  });

  it('leaves node_modules/ in place when only .cache is present', async () => {
    const nodeModules = path.join(tmpRoot, 'node_modules');
    const cacheDir = path.join(nodeModules, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(nodeModules, 'package.json'), '{}');

    await clearCaches(tmpRoot);

    expect(fs.existsSync(cacheDir)).toBe(false);
    expect(fs.existsSync(nodeModules)).toBe(true);
    expect(fs.existsSync(path.join(nodeModules, 'package.json'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 3: Create `packages/proto-cli/src/clear-caches.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';

export type ClearCachesResult = { cleared: string[] };

const TARGETS = [
  '.expo',
  path.join('node_modules', '.cache'),
];

export async function clearCaches(projectRoot: string): Promise<ClearCachesResult> {
  const cleared: string[] = [];
  for (const target of TARGETS) {
    const full = path.join(projectRoot, target);
    if (fs.existsSync(full)) {
      await fs.promises.rm(full, { recursive: true, force: true });
      cleared.push(target.split(path.sep).join('/'));
    }
  }
  return { cleared };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/clear-caches.ts packages/proto-cli/src/clear-caches.test.ts
git commit -m "feat(proto-cli): clear .expo and node_modules/.cache"
```

---

## Task 5: new-screen-templates.ts (5 inline templates)

**Files:**
- Create: `packages/proto-cli/src/commands/new-screen-templates.test.ts`
- Create: `packages/proto-cli/src/commands/new-screen-templates.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/commands/new-screen-templates.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { renderTemplate, type TemplateName } from './new-screen-templates';

const TEMPLATES: TemplateName[] = ['empty', 'home', 'list', 'detail', 'form', 'modal'];

describe('renderTemplate', () => {
  for (const tpl of TEMPLATES) {
    it(`${tpl} template renders non-empty TSX with the screen name substituted`, () => {
      const out = renderTemplate(tpl, 'Profile');
      expect(out.length).toBeGreaterThan(20);
      expect(out).toContain('export default function Profile');
      expect(out).not.toContain('{{name}}');
    });

    it(`${tpl} template references only Proto components`, () => {
      const out = renderTemplate(tpl, 'Profile');
      expect(out).toContain("from '../components/proto'");
      expect(out).not.toContain("from 'react-native'");
      expect(out).not.toContain("from 'react-native/'");
    });
  }

  it('substitutes the name into Screen title as well', () => {
    const out = renderTemplate('empty', 'Settings');
    expect(out).toContain('title="Settings"');
  });

  it('throws for an unknown template name', () => {
    expect(() => renderTemplate('does-not-exist' as TemplateName, 'X')).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 3: Create `packages/proto-cli/src/commands/new-screen-templates.ts`**

```ts
export type TemplateName = 'empty' | 'home' | 'list' | 'detail' | 'form' | 'modal';

const EMPTY = `import { Screen, Stack, Text } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
      <Stack gap={16}>
        <Text size="headline">{{name}}</Text>
      </Stack>
    </Screen>
  );
}
`;

const HOME = `import { Screen, Stack, Text, Card } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
      <Stack gap={16}>
        <Text size="title">{{name}}</Text>
        <Card>
          <Text size="body">First card</Text>
        </Card>
        <Card>
          <Text size="body">Second card</Text>
        </Card>
      </Stack>
    </Screen>
  );
}
`;

const LIST = `import { Screen, Stack, Toggle, Divider } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
      <Stack gap={0}>
        <Toggle label="Option one" value={false} />
        <Divider />
        <Toggle label="Option two" value={false} />
        <Divider />
        <Toggle label="Option three" value={true} />
        <Divider />
        <Toggle label="Option four" value={false} />
        <Divider />
        <Toggle label="Option five" value={false} />
      </Stack>
    </Screen>
  );
}
`;

const DETAIL = `import { Screen, Stack, Text, Card } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
      <Stack gap={16}>
        <Card glass>
          <Text size="headline">{{name}}</Text>
          <Text size="caption" color="secondary">A glass card at the top</Text>
        </Card>
        <Text size="body">Body content goes here.</Text>
        <Text size="body" color="secondary">More secondary text below.</Text>
      </Stack>
    </Screen>
  );
}
`;

const FORM = `import { Screen, Stack, Card, Text, Button } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
      <Stack gap={12}>
        <Card>
          <Text size="caption" color="secondary">Name</Text>
        </Card>
        <Card>
          <Text size="caption" color="secondary">Email</Text>
        </Card>
        <Card>
          <Text size="caption" color="secondary">Message</Text>
        </Card>
        <Button label="Submit" variant="primary" />
      </Stack>
    </Screen>
  );
}
`;

const MODAL = `import { Screen, Stack, Modal, Text, Button } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
      <Modal title="{{name}}" visible={true}>
        <Stack gap={12}>
          <Text size="body">Modal content goes here.</Text>
          <Button label="Confirm" variant="primary" />
          <Button label="Cancel" variant="ghost" />
        </Stack>
      </Modal>
    </Screen>
  );
}
`;

const TEMPLATES: Record<TemplateName, string> = {
  empty: EMPTY,
  home: HOME,
  list: LIST,
  detail: DETAIL,
  form: FORM,
  modal: MODAL,
};

export function renderTemplate(template: TemplateName, screenName: string): string {
  const src = TEMPLATES[template];
  if (!src) throw new Error(`Unknown template: ${template}`);
  return src.replaceAll('{{name}}', screenName);
}
```

- [ ] **Step 4: Run — expect pass**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/commands/new-screen-templates.ts packages/proto-cli/src/commands/new-screen-templates.test.ts
git commit -m "feat(proto-cli): 5 inline screen templates with name substitution"
```

---

## Task 6: new-screen.ts + reset.ts (orchestrators, no unit tests)

**Files:**
- Create: `packages/proto-cli/src/commands/new-screen.ts`
- Create: `packages/proto-cli/src/commands/reset.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/commands/new-screen.ts`**

```ts
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
```

- [ ] **Step 2: Create `packages/proto-cli/src/commands/reset.ts`**

```ts
import { intro, log, outro, spinner } from '@clack/prompts';
import { messages } from '../messages.js';
import { findConfig } from '../find-config.js';
import { makeKillPort } from '../kill-port.js';
import { clearCaches } from '../clear-caches.js';

export async function runReset(): Promise<void> {
  intro(messages.startingHeader);

  const config = findConfig(process.cwd());
  if (!config.ok) {
    log.error(config.reason);
    process.exit(1);
  }

  const s = spinner();
  s.start(messages.resetting);

  const killPort = makeKillPort();
  await killPort(8081);
  await killPort(3001);
  await clearCaches(config.root);

  s.stop(messages.resetDone);
  outro(messages.resetDone);
}
```

- [ ] **Step 3: Typecheck + tests**

```bash
export PATH="$HOME/.local/bin:$PATH"
pnpm --filter proto-cli typecheck
pnpm --filter proto-cli test
```

Both exit 0. Test count stays at whatever it reached after Task 5.

- [ ] **Step 4: Commit**

```bash
git add packages/proto-cli/src/commands/new-screen.ts packages/proto-cli/src/commands/reset.ts
git commit -m "feat(proto-cli): new-screen and reset orchestrators"
```

---

## Task 7: Wire `new-screen` and `reset` into the dispatcher

**Files:**
- Modify: `packages/proto-cli/src/cli.ts`

- [ ] **Step 1: Replace `packages/proto-cli/src/cli.ts` with:**

```ts
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
```

- [ ] **Step 2: Typecheck + tests**

```bash
export PATH="$HOME/.local/bin:$PATH"
pnpm --filter proto-cli typecheck
pnpm --filter proto-cli test
```

Both exit 0.

- [ ] **Step 3: Build**

```bash
export PATH="$HOME/.local/bin:$PATH"
pnpm --filter proto-cli build
```

Expected: exit 0. `dist/index.js` exists with shebang preserved.

```bash
head -1 packages/proto-cli/dist/index.js
```

Expected: `#!/usr/bin/env node`.

- [ ] **Step 4: Commit**

```bash
git add packages/proto-cli/src/cli.ts
git commit -m "feat(proto-cli): dispatch new-screen and reset commands"
```

---

## Task 8: End-to-end smoke (scaffolded project, no install)

Verification only — no source files.

- [ ] **Step 1: Scaffold a fresh project in /tmp (skip install)**

```bash
rm -rf /tmp/proto-cmd-smoke && mkdir -p /tmp/proto-cmd-smoke
node -e "
import('/Users/sherizan/Public/proto/packages/create-proto/dist/copy-template.js').then(async ({ copyTemplate }) => {
  await copyTemplate({
    templateRoot: '/Users/sherizan/Public/proto/packages/create-proto/template',
    destRoot: '/tmp/proto-cmd-smoke/cmd-smoke',
    projectName: 'cmd-smoke',
  });
  console.log('Scaffold complete');
});
"
```

Expected: "Scaffold complete" printed. Project tree present at `/tmp/proto-cmd-smoke/cmd-smoke/`.

- [ ] **Step 2: Run `proto new-screen Profile`**

```bash
cd /tmp/proto-cmd-smoke/cmd-smoke && node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js new-screen Profile 2>&1 | tail -10
cd /Users/sherizan/Public/proto
```

Expected: output contains `Profile screen created` line.

Verify the file:

```bash
cat /tmp/proto-cmd-smoke/cmd-smoke/screens/Profile.tsx
```

Expected: source matches the empty template with `Profile` substituted for `{{name}}`.

- [ ] **Step 3: Run `proto new-screen Settings --template list`**

```bash
cd /tmp/proto-cmd-smoke/cmd-smoke && node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js new-screen Settings --template list 2>&1 | tail -10
cd /Users/sherizan/Public/proto
```

Expected: `Settings screen created` printed.

Verify:

```bash
cat /tmp/proto-cmd-smoke/cmd-smoke/screens/Settings.tsx
```

Expected: source uses the list template — contains `Toggle` and `Divider` imports + 5 `Toggle` rows.

- [ ] **Step 4: Collision check — run new-screen Profile again**

```bash
cd /tmp/proto-cmd-smoke/cmd-smoke && node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js new-screen Profile 2>&1 | tail -10
cd /Users/sherizan/Public/proto
```

Expected: output contains `A screen named "Profile" already exists.`

- [ ] **Step 5: PascalCase normalisation — `proto new-screen "my profile"`**

```bash
cd /tmp/proto-cmd-smoke/cmd-smoke && node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js new-screen "my profile" 2>&1 | tail -10
ls /tmp/proto-cmd-smoke/cmd-smoke/screens/
cd /Users/sherizan/Public/proto
```

Expected: success line says `MyProfile screen created`. File listing now shows `MyProfile.tsx`.

- [ ] **Step 6: Reset smoke**

Create cache directories so reset has something to delete:

```bash
mkdir -p /tmp/proto-cmd-smoke/cmd-smoke/.expo
echo "{}" > /tmp/proto-cmd-smoke/cmd-smoke/.expo/state.json
mkdir -p /tmp/proto-cmd-smoke/cmd-smoke/node_modules/.cache
echo "x" > /tmp/proto-cmd-smoke/cmd-smoke/node_modules/.cache/x.bin
```

Run reset:

```bash
cd /tmp/proto-cmd-smoke/cmd-smoke && node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js reset 2>&1 | tail -10
cd /Users/sherizan/Public/proto
```

Expected: output contains `Proto reset. Run: proto start`.

Verify the caches are gone:

```bash
test ! -d /tmp/proto-cmd-smoke/cmd-smoke/.expo && echo ".expo removed"
test ! -d /tmp/proto-cmd-smoke/cmd-smoke/node_modules/.cache && echo "node_modules/.cache removed"
```

Expected: both echo lines fire.

- [ ] **Step 7: Reset outside a Proto project surfaces friendly error**

```bash
cd /tmp && node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js reset 2>&1 | tail -5
cd /Users/sherizan/Public/proto
```

Expected: output contains `Run this inside a Proto project.`

- [ ] **Step 8: Clean up the smoke directory**

```bash
rm -rf /tmp/proto-cmd-smoke
```

- [ ] **Step 9: Final package-level checks**

```bash
cd /Users/sherizan/Public/proto
export PATH="$HOME/.local/bin:$PATH"
pnpm --filter proto-cli typecheck
pnpm --filter proto-cli test
pnpm --filter proto-cli build
```

All three exit 0.

- [ ] **Step 10: Commit verification marker**

```bash
git commit --allow-empty -m "test(proto-cli): new-screen and reset commands verified locally"
```

---

## Self-review notes

**Spec coverage:**
- `new-screen` flow (find-config → pascal-case → render template → write file) — Tasks 2, 5, 6 ✓
- 5 inline templates (empty/home/list/detail/form/modal) — Task 5 ✓
- Name PascalCasing with friendly rejection — Task 2 ✓
- Collision error message — Task 6 ✓ (uses `messages.screenExists`)
- `reset` flow (find-config → kill ports → clear caches) — Tasks 3, 4, 6 ✓
- Port killing via lsof + injectable `runCmd` — Task 3 ✓
- Cache clearing for `.expo/` and `node_modules/.cache/` — Task 4 ✓
- Wire both into the dispatcher — Task 7 ✓
- New messages added — Task 1 ✓
- Jargon audit auto-covers — confirmed via Task 1 Step 2 ✓

**Placeholder scan:** no TBD/TODO patterns. The "out of scope" notes are intentional and from the spec.

**Type consistency:**
- `PascalCaseResult` defined in Task 2, used in Task 6 ✓
- `TemplateName` defined in Task 5, used in Tasks 6 + 7 ✓
- `KillPortFn`, `RunCmdFn`, `KillPortDeps` defined in Task 3 — `runReset` in Task 6 uses `makeKillPort()` with no args (defaults are fine) ✓
- `ClearCachesResult` defined in Task 4 — `runReset` in Task 6 ignores the return value (acceptable; spinner text doesn't depend on it) ✓
- `NewScreenOptions` defined in Task 6, used in Task 7 dispatcher ✓
- `messages.screenExists`, `messages.screenCreated` defined as functions in Task 1, called as functions in Task 6 ✓

**Known sharp edges:**
- `clear-caches.ts` uses real `fs` directly (not injected). The tests use real tmp directories rather than mocks. Pragmatic and matches the prior `copy-template.test.ts` pattern in create-proto.
- `kill-port.ts`'s default `defaultRunCmd` is integration-tested only via the smoke (Task 8 Step 6); unit tests cover the injected path. Same trade-off as `expo-spawn.ts`.
- The smoke uses `copyTemplate` directly to skip the slow install step. The scaffolded project's `node_modules/` doesn't exist, so Task 8 Step 6 creates the cache dirs by hand to give `reset` something to delete.
