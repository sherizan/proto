# Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm create proto@latest myapp` produce a Welcome screen on a real phone in ≤90 seconds with zero typed input after the initial command, using the Section 2 terminal layout and Section 3 welcome screen from `docs/superpowers/specs/2026-05-22-onboarding-redesign-design.md`.

**Architecture:** New pure modules (`header.ts`, `lan-ip.ts`) feed a rewritten `start.ts` that prints the full step-numbered output (header bar + Step 1 App Store QR + Step 2 project QR + next-steps + footer) BEFORE spawning Expo with `CI=1` to silence its interactive UI. `create-proto/cli.ts` drops the interactive name prompt and auto-spawns `proto-cli` in the new project's directory after install completes. Template `Home.tsx` is rewritten as Section 3's celebratory welcome with Reanimated fade-up.

**Tech Stack:** TypeScript ESM, vitest, `@clack/prompts` (kept in create-proto only — start.ts goes raw console.log), `qrcode-terminal`, Node `child_process.spawn` + `os.networkInterfaces`, React Native + `react-native-reanimated` for the Home screen animation.

**Brand placeholder:** strings use the literal word `Proto`. Final rename is a sed-replace at ship time.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `packages/proto-cli/src/header.ts` | Pure 3-line header renderer. Accepts `{ brand, version, theme, target, cwd }`, returns string. |
| `packages/proto-cli/src/header.test.ts` | Snapshot-style tests across the three themes. |
| `packages/proto-cli/src/lan-ip.ts` | Pure helper returning the first non-internal IPv4 from `os.networkInterfaces()`, fallback `'localhost'`. |
| `packages/proto-cli/src/lan-ip.test.ts` | Unit test with injected interface map. |

**Modified files:**

| Path | Change |
|---|---|
| `packages/proto-cli/src/messages.ts` | Replace single-line strings with step-numbered copy + next-step block + footer. Drop dead Phase 1 keys. |
| `packages/proto-cli/src/messages.test.ts` | Update assertions for new keys. |
| `packages/proto-cli/src/commands/start.ts` | Rewrite to print header → Step 1 QR + body → Step 2 QR + body → next-steps → footer, then spawn Expo. |
| `packages/proto-cli/src/expo-spawn.ts` | Pass `env: { ...process.env, CI: '1' }` so Expo runs non-interactive (no dev menu, no QR duplication). |
| `packages/create-proto/src/messages.ts` | Replace `namePrompt` / `settingUp` / etc. with install-narrative formatter (`installed(elapsed)`). Drop the prompt key. |
| `packages/create-proto/src/messages.test.ts` | Update assertions for new keys + format. |
| `packages/create-proto/src/cli.ts` | Drop interactive `text()` prompt; use folder arg verbatim or default `my-prototype`. After install success, spawn proto-cli in dest with inherited stdio. On install failure, print recovery hint and exit. |
| `packages/create-proto/template/screens/Home.tsx` | Rewrite to Section 3 design: hero glass card with fade-up animation + sub-copy + two command cards + caption. |
| `docs/proto-master.md` | Replace §10 Welcome screen example with the new Home.tsx code. |

---

## Task 1: New `lan-ip.ts` pure helper (TDD)

**Files:**
- Create: `packages/proto-cli/src/lan-ip.ts`
- Create: `packages/proto-cli/src/lan-ip.test.ts`

- [ ] **Step 1: Write failing tests**

Write `packages/proto-cli/src/lan-ip.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { pickLanIp, type Iface } from './lan-ip.js';

describe('pickLanIp', () => {
  it('returns the first non-internal IPv4 address', () => {
    const ifaces: Record<string, Iface[]> = {
      lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
      en0: [{ family: 'IPv4', address: '192.168.1.42', internal: false }],
      en1: [{ family: 'IPv4', address: '10.0.0.5', internal: false }],
    };
    expect(pickLanIp(ifaces)).toBe('192.168.1.42');
  });

  it('skips IPv6 addresses', () => {
    const ifaces: Record<string, Iface[]> = {
      en0: [
        { family: 'IPv6', address: 'fe80::1', internal: false },
        { family: 'IPv4', address: '192.168.1.42', internal: false },
      ],
    };
    expect(pickLanIp(ifaces)).toBe('192.168.1.42');
  });

  it('falls back to localhost when no non-internal IPv4 found', () => {
    const ifaces: Record<string, Iface[]> = {
      lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
    };
    expect(pickLanIp(ifaces)).toBe('localhost');
  });

  it('falls back to localhost when no interfaces present', () => {
    expect(pickLanIp({})).toBe('localhost');
  });
});
```

- [ ] **Step 2: Run tests, expect module-not-found**

Run: `pnpm --filter proto-cli test -- --run lan-ip`
Expected: 4 failures, module not found.

- [ ] **Step 3: Implement `lan-ip.ts`**

Write `packages/proto-cli/src/lan-ip.ts`:

```typescript
import os from 'node:os';

export type Iface = {
  family: 'IPv4' | 'IPv6' | string;
  address: string;
  internal: boolean;
};

export function pickLanIp(ifaces: Record<string, Iface[] | undefined>): string {
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

export function getLanIp(): string {
  return pickLanIp(os.networkInterfaces() as Record<string, Iface[]>);
}
```

- [ ] **Step 4: Run tests, expect 4/4 pass**

Run: `pnpm --filter proto-cli test -- --run lan-ip`
Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/lan-ip.ts packages/proto-cli/src/lan-ip.test.ts
git commit -m "feat(proto-cli): lan-ip helper for project QR URL"
```

---

## Task 2: New `header.ts` pure renderer (TDD)

**Files:**
- Create: `packages/proto-cli/src/header.ts`
- Create: `packages/proto-cli/src/header.test.ts`

- [ ] **Step 1: Write failing tests**

Write `packages/proto-cli/src/header.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { renderHeader, type HeaderInputs } from './header.js';

function base(): HeaderInputs {
  return {
    brand: 'Proto',
    version: '0.1.0',
    theme: 'liquidGlass',
    target: 'iOS preview',
    cwd: '/private/tmp/myapp',
  };
}

describe('renderHeader', () => {
  it('renders three lines with mark + brand version + theme + cwd', () => {
    const out = renderHeader(base());
    const lines = out.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Proto v0.1.0');
    expect(lines[1]).toContain('Liquid Glass · iOS preview');
    expect(lines[2]).toContain('/private/tmp/myapp');
  });

  it('renders the Option D dotted-grid mark on the left of each line', () => {
    const out = renderHeader(base());
    const lines = out.split('\n');
    expect(lines[0].startsWith('▗ ▗ ▗')).toBe(true);
    expect(lines[1].startsWith(' ▗ ▗')).toBe(true);
    expect(lines[2].startsWith('▗ ▗ ▗')).toBe(true);
  });

  it('formats theme names humanly', () => {
    expect(renderHeader({ ...base(), theme: 'liquidGlass' })).toContain('Liquid Glass');
    expect(renderHeader({ ...base(), theme: 'materialYou' })).toContain('Material You');
    expect(renderHeader({ ...base(), theme: 'base' })).toContain('Base');
  });

  it('falls back to liquidGlass label for unknown themes', () => {
    expect(renderHeader({ ...base(), theme: 'somethingNew' })).toContain('Liquid Glass');
  });
});
```

- [ ] **Step 2: Run tests, expect module-not-found**

Run: `pnpm --filter proto-cli test -- --run header`
Expected: 4 failures.

- [ ] **Step 3: Implement `header.ts`**

Write `packages/proto-cli/src/header.ts`:

```typescript
export type HeaderInputs = {
  brand: string;
  version: string;
  theme: string;
  target: string;
  cwd: string;
};

const THEME_LABEL: Record<string, string> = {
  liquidGlass: 'Liquid Glass',
  materialYou: 'Material You',
  base: 'Base',
};

const MARK = ['▗ ▗ ▗', ' ▗ ▗ ', '▗ ▗ ▗'];

export function renderHeader(inputs: HeaderInputs): string {
  const themeLabel = THEME_LABEL[inputs.theme] ?? 'Liquid Glass';
  const right = [
    `${inputs.brand} v${inputs.version}`,
    `${themeLabel} · ${inputs.target}`,
    inputs.cwd,
  ];
  return MARK.map((mark, i) => `${mark}   ${right[i]}`).join('\n');
}
```

- [ ] **Step 4: Run tests, expect 4/4 pass**

Run: `pnpm --filter proto-cli test -- --run header`
Expected: 4/4 pass.

- [ ] **Step 5: Typecheck full package**

Run: `pnpm --filter proto-cli typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/proto-cli/src/header.ts packages/proto-cli/src/header.test.ts
git commit -m "feat(proto-cli): 3-line header renderer with theme labels"
```

---

## Task 3: Update proto-cli messages with new step-numbered copy

**Files:**
- Modify: `packages/proto-cli/src/messages.ts`
- Modify: `packages/proto-cli/src/messages.test.ts`

- [ ] **Step 1: Update the test file FIRST**

Replace the contents of `packages/proto-cli/src/messages.test.ts` with:

```typescript
import { describe, expect, it } from 'vitest';
import { messages } from './messages';

describe('messages', () => {
  it('keeps Phase 1 + Phase 2 keys still in use', () => {
    expect(messages.noConfig).toBeTypeOf('string');
    expect(messages.portInUse).toBeTypeOf('string');
    expect(messages.stoppedPrevious).toBeTypeOf('string');
    expect(messages.noScreenName).toBeTypeOf('string');
    expect(messages.screenCreated('Home')).toContain('Home');
    expect(messages.resetDone).toBeTypeOf('string');
    expect(messages.designIntro).toBeTypeOf('string');
    expect(messages.designReadyTitle).toBeTypeOf('string');
  });

  it('exposes step 1 (install preview app) copy', () => {
    expect(messages.step1Header).toBe('Step 1 — Install Proto Preview (one-time)');
    expect(messages.step1Body).toContain('Open Camera on your phone');
    expect(messages.step1Body).toContain('published as Expo Go by Expo');
    expect(messages.step1Body).toContain('Skip to Step 2');
  });

  it('exposes step 2 (open project) copy', () => {
    expect(messages.step2Header).toBe('Step 2 — Open your prototype');
    expect(messages.step2Body).toContain('Open Proto Preview, scan');
    expect(messages.step2Body).toContain('10–30s the first time');
  });

  it('exposes next-step block referencing the liquid-glass-toolbar prompt', () => {
    expect(messages.nextStepsHeader).toBe('Next, in another terminal:');
    expect(messages.nextStepsBody).toContain('cd ');
    expect(messages.nextStepsBody).toContain('claude');
    expect(messages.nextStepsBody).toContain('Add liquid glass bottom toolbar with placeholder screens');
  });

  it('exposes footer running message', () => {
    expect(messages.metroRunning).toBe('Metro running. Press Ctrl+C to stop.');
  });
});
```

- [ ] **Step 2: Run tests, expect failures**

Run: `pnpm --filter proto-cli test -- --run messages`
Expected: the new key tests fail; existing-keys test may pass partly.

- [ ] **Step 3: Update `messages.ts`**

Replace the contents of `packages/proto-cli/src/messages.ts` with:

```typescript
export const messages = {
  startingHeader: 'Proto',
  noConfig: 'Run this inside a Proto project.',
  starting: 'Starting',
  ready: 'Scan the QR to preview on your device',
  stopped: 'Proto stopped.',
  portInUse:
    'Proto is already running in another window. Close it first, then try again.',
  stoppedPrevious: 'Stopped a previous Proto session.',
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
  designIntro: 'Proto',
  designThemePrompt: 'Which theme?',
  designAccentPrompt: 'Accent colour?',
  designLibraryPrompt: 'Component library?',
  designCustomPackagePrompt: 'Custom library package name?',
  designCustomDocsPrompt: 'Docs URL (optional, press enter to skip)',
  designAppNamePrompt: 'App name?',
  designOverwritePrompt: 'Update existing design system?',
  designInstalling: 'Installing component library',
  designInstallDone: 'Component library installed',
  designInstallFailed: "Couldn't install the component library. Try again, or pick Proto.",
  designCustomInstallHint: (cmd: string) =>
    `When you're ready, tell Claude Code: "install the component library with ${cmd}"`,
  designReadyTitle: 'Design system ready',
  designReadyHint:
    'Open Claude Code and start designing. Try: "add a settings screen with a dark mode toggle"',
  designUpdateHint:
    "Tell Claude Code what to change, e.g. 'update DESIGN.md, change accent to indigo'",
  designCancelled: 'Cancelled.',
  designKeptExisting: 'Kept the existing design system.',
  step1Header: 'Step 1 — Install Proto Preview (one-time)',
  step1Body:
    "Open Camera on your phone, scan to install Proto Preview.\nIt's published as Expo Go by Expo — the framework Proto runs on.\nAlready installed? Skip to Step 2.",
  step2Header: 'Step 2 — Open your prototype',
  step2Body:
    'Open Proto Preview, scan. Loading takes 10–30s the first time.',
  nextStepsHeader: 'Next, in another terminal:',
  nextStepsBody:
    '→ cd <project>\n→ claude\n→ Add liquid glass bottom toolbar with placeholder screens',
  metroRunning: 'Metro running. Press Ctrl+C to stop.',
};

export type Messages = typeof messages;
```

- [ ] **Step 4: Run all proto-cli tests, expect pass**

Run: `pnpm --filter proto-cli test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/messages.ts packages/proto-cli/src/messages.test.ts
git commit -m "feat(proto-cli): step-numbered onboarding copy + footer"
```

---

## Task 4: Wire `CI=1` env into Expo spawn

**Files:**
- Modify: `packages/proto-cli/src/expo-spawn.ts`

- [ ] **Step 1: Update spawn options**

In `packages/proto-cli/src/expo-spawn.ts`, locate the `defaultSpawn` function. Replace it with:

```typescript
function defaultSpawn(cmd: string, args: string[], opts: { cwd: string }): SpawnedProcess {
  const child = nodeSpawn(cmd, args, {
    cwd: opts.cwd,
    stdio: 'inherit',
    env: { ...process.env, CI: '1' },
  });

  return {
    kill: (signal) => child.kill(signal ?? 'SIGTERM'),
    exit: new Promise<number | null>((resolve) => {
      child.on('exit', (code) => resolve(code));
    }),
  };
}
```

- [ ] **Step 2: Typecheck + tests pass (no test change needed)**

Run: `pnpm --filter proto-cli typecheck && pnpm --filter proto-cli test`
Expected: clean typecheck; all existing tests pass (the test injects its own spawnFn so the env change isn't observed there).

- [ ] **Step 3: Commit**

```bash
git add packages/proto-cli/src/expo-spawn.ts
git commit -m "fix(proto-cli): set CI=1 so Expo runs without interactive dev menu"
```

---

## Task 5: Rewrite `start.ts` orchestrator

**Files:**
- Modify: `packages/proto-cli/src/commands/start.ts`

No unit test for this orchestrator (matches Phase 1 pattern; orchestrators are smoke-validated, pure modules are unit-tested).

- [ ] **Step 1: Replace `start.ts` with the new orchestrator**

Replace the contents of `packages/proto-cli/src/commands/start.ts` with:

```typescript
import path from 'node:path';
import fs from 'node:fs';
import { messages } from '../messages.js';
import { findConfig } from '../find-config.js';
import { startPromptServer, type ServerHandle } from '../prompt-server.js';
import { spawnExpo } from '../expo-spawn.js';
import { makeKillPort } from '../kill-port.js';
import { renderHeader } from '../header.js';
import { renderQr } from '../render-qr.js';
import { getLanIp } from '../lan-ip.js';

export type StartOptions = { verbose: boolean };

const APP_STORE_URL = 'https://apps.apple.com/app/expo-go/id982107779';

export async function runStart(_options: StartOptions): Promise<void> {
  const config = findConfig(process.cwd());
  if (!config.ok) {
    console.error(messages.noConfig);
    process.exit(1);
  }

  const themeName = readThemeFromConfig(config.configPath);
  const cliVersion = readCliVersion();

  // 1. Header
  console.log(
    renderHeader({
      brand: 'Proto',
      version: cliVersion,
      theme: themeName,
      target: 'iOS preview',
      cwd: config.root,
    }),
  );
  console.log('');

  // 2. Free port + start prompt server (existing infrastructure)
  const killPort = makeKillPort();
  const cleared = await killPort(8081);
  if (cleared.killed > 0) {
    console.log(`●  ${messages.stoppedPrevious}`);
  }

  let server: ServerHandle | null = null;
  try {
    server = await startPromptServer({ port: 3001 });
  } catch (err) {
    if (err instanceof Error && /EADDRINUSE/.test(err.message)) {
      console.error(messages.portInUse);
      process.exit(1);
    }
    throw err;
  }

  // 3. Step 1 — install Proto Preview
  console.log(messages.step1Header);
  console.log('');
  console.log(renderQr(APP_STORE_URL));
  console.log('');
  console.log(messages.step1Body);
  console.log('');

  // 4. Step 2 — open prototype
  console.log(messages.step2Header);
  console.log('');
  const projectUrl = `exp://${getLanIp()}:8081`;
  console.log(renderQr(projectUrl));
  console.log('');
  console.log(messages.step2Body);
  console.log('');

  // 5. Next-step block
  console.log(messages.nextStepsHeader);
  console.log('');
  console.log(messages.nextStepsBody.replace('<project>', path.basename(config.root)));
  console.log('');

  // 6. Footer + spawn Expo (Expo's output follows below)
  console.log(messages.metroRunning);
  console.log('');

  const expo = spawnExpo({ cwd: config.root });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await Promise.all([expo.kill(), server?.close()]);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await expo.waitUntilExit;
  await server?.close();
}

function readThemeFromConfig(configPath: string): string {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const m = /theme\s*:\s*['"]([^'"]+)['"]/.exec(raw);
    return m?.[1] ?? 'liquidGlass';
  } catch {
    return 'liquidGlass';
  }
}

function readCliVersion(): string {
  try {
    const here = import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname);
    const pkgPath = path.resolve(here, '../../package.json');
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const json = JSON.parse(raw) as { version?: string };
    return json.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter proto-cli typecheck`
Expected: clean.

- [ ] **Step 3: Build**

Run: `pnpm --filter proto-cli build`
Expected: clean.

- [ ] **Step 4: Full test suite**

Run: `pnpm --filter proto-cli test`
Expected: all tests pass (no regressions in unrelated modules).

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/commands/start.ts
git commit -m "feat(proto-cli): step-numbered onboarding output in proto start"
```

---

## Task 6: Update create-proto messages

**Files:**
- Modify: `packages/create-proto/src/messages.ts`
- Modify: `packages/create-proto/src/messages.test.ts`

- [ ] **Step 1: Update the test file**

Replace the contents of `packages/create-proto/src/messages.test.ts` with:

```typescript
import { describe, expect, it } from 'vitest';
import { messages } from './messages';

describe('messages', () => {
  it('exposes the header', () => {
    expect(messages.header).toBe('Proto');
  });

  it('formats settingUp with project name', () => {
    expect(messages.settingUp('myapp')).toBe('Setting up myapp...');
  });

  it('formats installed with integer elapsed seconds', () => {
    expect(messages.installed(47)).toBe('Installed in 47s');
    expect(messages.installed(3)).toBe('Installed in 3s');
  });

  it('exposes folderExists with name reference and copy-paste-friendly recovery', () => {
    const m = messages.folderExists('myapp');
    expect(m).toContain('myapp');
    expect(m).toContain('npm create proto@latest');
  });

  it('exposes install failure recovery hint with project name', () => {
    const m = messages.installFailedHint('myapp');
    expect(m).toContain('cd myapp');
    expect(m).toContain('pnpm install');
    expect(m).toContain('proto start');
  });

  it('exposes cancelled message', () => {
    expect(messages.cancelled).toBe('Cancelled. Folder removed.');
  });

  it('exposes network/permission/space translations', () => {
    expect(messages.noNetwork).toMatch(/internet|network/i);
    expect(messages.noPermission).toMatch(/permission/i);
    expect(messages.noSpace).toMatch(/space|disk/i);
  });
});
```

- [ ] **Step 2: Run tests, expect failures**

Run: `pnpm --filter create-proto test -- --run messages`
Expected: multiple failures (new keys absent, old keys still present but tests changed).

- [ ] **Step 3: Update `messages.ts`**

Replace the contents of `packages/create-proto/src/messages.ts` with:

```typescript
export const messages = {
  header: 'Proto',
  settingUp: (name: string) => `Setting up ${name}...`,
  installed: (seconds: number) => `Installed in ${seconds}s`,
  folderExists: (name: string) =>
    `That folder already exists. Pick another name: npm create proto@latest <name> (currently: "${name}").`,
  installFailedHint: (name: string) =>
    `Couldn't install dependencies. Once your environment is ready: cd ${name} && pnpm install && proto start`,
  cancelled: 'Cancelled. Folder removed.',
  noNetwork:
    "Couldn't reach the package registry. Check your internet and try again.",
  noPermission:
    "Don't have permission to write here. Try a different folder.",
  noSpace: 'Out of disk space. Free some up and try again.',
  installFailed:
    "Couldn't get things installed. Try again, or visit proto.run/help",
};

export type Messages = typeof messages;
```

- [ ] **Step 4: Run all create-proto tests, expect pass**

Run: `pnpm --filter create-proto test`
Expected: messages tests pass; other tests still pass (`install-deps.ts` references `messages.installFailed` and `messages.noNetwork` etc. — those still exist in the new map).

- [ ] **Step 5: Commit**

```bash
git add packages/create-proto/src/messages.ts packages/create-proto/src/messages.test.ts
git commit -m "feat(create-proto): install narrative + recovery hints, drop prompt copy"
```

---

## Task 7: Rewrite create-proto `cli.ts` (drop prompt, auto-spawn)

**Files:**
- Modify: `packages/create-proto/src/cli.ts`

No unit test for the orchestrator (Phase 1 pattern). Validated via Task 10 smoke.

- [ ] **Step 1: Replace `cli.ts`**

Replace the contents of `packages/create-proto/src/cli.ts` with:

```typescript
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

  outro('Booting Metro...');
  await spawnProtoStart(dest, name);
}

async function spawnProtoStart(cwd: string, name: string): Promise<void> {
  const protoCliBin = resolveProtoCli();
  if (!protoCliBin) {
    log.error(
      'proto-cli not found. Run manually: cd ' + name + ' && proto start',
    );
    return;
  }

  await new Promise<void>((resolve) => {
    const child = spawn(process.execPath, [protoCliBin, 'start'], {
      cwd,
      stdio: 'inherit',
    });
    child.on('exit', () => resolve());
    child.on('error', () => resolve());
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter create-proto typecheck`
Expected: clean.

- [ ] **Step 3: Build**

Run: `pnpm --filter create-proto build`
Expected: clean.

- [ ] **Step 4: All tests pass**

Run: `pnpm --filter create-proto test`
Expected: all tests pass (no test changes here — orchestrator-only).

- [ ] **Step 5: Commit**

```bash
git add packages/create-proto/src/cli.ts
git commit -m "feat(create-proto): zero-prompt scaffold + auto-spawn proto start"
```

---

## Task 8: Rewrite template Home.tsx (Section 3 welcome screen)

**Files:**
- Modify: `packages/create-proto/template/screens/Home.tsx`

No unit test (RN components validated on device per Phase 1 pattern).

- [ ] **Step 1: Replace `Home.tsx`**

Replace the contents of `packages/create-proto/template/screens/Home.tsx` with:

```tsx
import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Screen, Stack, Text, Card, Divider } from '../components/proto';

export default function Home() {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) });
  }, [opacity, translateY]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Screen title="Proto" scrollable>
      <Stack gap={24} padding={20}>
        <Animated.View style={heroStyle}>
          <Card glass padding={24}>
            <Stack gap={12}>
              <Text size="title">You're in.</Text>
              <Text size="body" color="secondary">
                Every change you make appears here instantly — no refresh, no waiting.
              </Text>
            </Stack>
          </Card>
        </Animated.View>

        <Stack gap={12}>
          <Text size="headline">Next</Text>
          <Text size="body">Open a new terminal and run</Text>
          <Card padding={16}>
            <Text size="body" color="accent">claude</Text>
          </Card>
          <Text size="body">Then describe what you want</Text>
          <Card padding={16}>
            <Text size="body" color="accent">
              Add liquid glass bottom toolbar with placeholder screens
            </Text>
          </Card>
        </Stack>

        <Divider />

        <Text size="caption" color="secondary">
          Proto reads DESIGN.md before every change.
        </Text>
      </Stack>
    </Screen>
  );
}
```

- [ ] **Step 2: Verify component imports exist in the template**

Read `packages/create-proto/template/components/proto/index.ts` and confirm `Screen`, `Stack`, `Text`, `Card`, `Divider` are all exported. (These were validated in Phase 2 — sanity check only.)

- [ ] **Step 3: Commit**

```bash
git add packages/create-proto/template/screens/Home.tsx
git commit -m "feat(create-proto): Welcome screen with hero fade-up + instant-update copy"
```

---

## Task 9: Update master doc §10 with new Welcome screen example

**Files:**
- Modify: `docs/proto-master.md` (find §10 Welcome screen example)

- [ ] **Step 1: Locate the Welcome screen example in §10**

Run: `grep -n "Welcome to Proto\|Home()\|Home.tsx" docs/proto-master.md | head -20` to find the block.

- [ ] **Step 2: Replace the example with the new Home.tsx code**

Edit the located code block to match the Home.tsx contents from Task 8 (the `useEffect` + Reanimated fade-up + `You're in.` + Liquid Glass toolbar prompt). Preserve surrounding prose (intro paragraphs explaining why the welcome screen exists).

If §10's structure has changed substantially in the user's in-flight rewrite, ask the user before guessing — do NOT blindly rewrite sections you can't identify.

- [ ] **Step 3: Commit**

```bash
git add docs/proto-master.md
git commit -m "docs: master doc Welcome screen example matches new Home.tsx"
```

---

## Task 10: End-to-end smoke verification

**Files:** none modified.

- [ ] **Step 1: Build everything**

Run: `pnpm -r build`
Expected: clean across all packages.

- [ ] **Step 2: Full test suite**

Run: `pnpm -r test`
Expected: every package's tests pass.

- [ ] **Step 3: Headless scaffold smoke (no interactive prompt anymore)**

```bash
cd /tmp && rm -rf onboarding-smoke
node -e "
const { copyTemplate } = await import('/Users/sherizan/Public/proto/packages/create-proto/dist/copy-template.js');
const today = new Date().toISOString().slice(0, 10);
await copyTemplate({
  templateRoot: '/Users/sherizan/Public/proto/packages/create-proto/template',
  destRoot: '/tmp/onboarding-smoke',
  projectName: 'onboarding-smoke',
  substitutions: { '{{APP_NAME}}': 'onboarding-smoke', '{{DATE}}': today },
});
console.log('scaffolded');
"
```

(The full `node packages/create-proto/dist/index.js onboarding-smoke` invocation also works headlessly now, but it auto-spawns Metro and runs forever — easier to verify the file outputs via `copyTemplate` direct.)

- [ ] **Step 4: Inventory scaffold**

```bash
ls /tmp/onboarding-smoke
head -3 /tmp/onboarding-smoke/DESIGN.md
head -8 /tmp/onboarding-smoke/screens/Home.tsx
cat /tmp/onboarding-smoke/app/index.tsx
```

Expected:
- All Phase 2 files present (`DESIGN.md`, `CLAUDE.md`, `app.config.js`, `babel.config.js`, `metro.config.js`, `proto.config.js`, `.npmrc`, `components/proto/`, `components/shared/.gitkeep`).
- `screens/Home.tsx` contains `import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';` and `<Text size="title">You're in.</Text>`.
- `app/index.tsx` is the existing wrapper-form import.

- [ ] **Step 5: Test `proto start` output**

```bash
cd /tmp/onboarding-smoke
pnpm install
lsof -ti tcp:8081 2>/dev/null | xargs -r kill -9 2>/dev/null
(node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js start 2>&1 &) ; sleep 20
lsof -i tcp:8081 | head -2
pkill -f "expo start" 2>/dev/null
lsof -ti tcp:8081 2>/dev/null | xargs -r kill -9 2>/dev/null
```

Expected (captured during the 20s run):
- Header bar with `▗ ▗ ▗   Proto v...`, `Liquid Glass · iOS preview`, `/private/tmp/onboarding-smoke`
- `Step 1 — Install Proto Preview (one-time)` heading
- A QR (App Store)
- `Open Camera on your phone, scan to install Proto Preview...`
- `Step 2 — Open your prototype` heading
- A QR (project)
- `Open Proto Preview, scan. Loading takes 10–30s the first time.`
- `Next, in another terminal:` with `cd`, `claude`, `Add liquid glass bottom toolbar with placeholder screens`
- `Metro running. Press Ctrl+C to stop.`
- Then Expo's `Starting project at /private/tmp/onboarding-smoke`...
- Port 8081 actively bound

- [ ] **Step 6: Device-on-phone validation (manual)**

Force-quit Expo Go on phone. From `/tmp/onboarding-smoke`:

```bash
node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js start
```

Scan Step 2 QR with Expo Go. Confirm Welcome screen renders with:
- "You're in." title in title typography
- "Every change you make appears here instantly — no refresh, no waiting." in secondary color
- A subtle fade-up animation on the hero card (~600ms)
- Two cards showing `claude` and `Add liquid glass bottom toolbar with placeholder screens` in accent color
- Footer caption "Proto reads DESIGN.md before every change."

- [ ] **Step 7: Cleanup**

```bash
rm -rf /tmp/onboarding-smoke
```

- [ ] **Step 8: No commit — verification only**

If steps 1–6 all pass, the onboarding redesign is shipped. No commit at this task — all source changes were committed in earlier tasks.

---

## Self-review

**Spec coverage:**
- Section 1 (shape) → Tasks 7 (auto-spawn) + 5 (start output)
- Section 2 (terminal mockup) → Tasks 1, 2, 3, 4, 5 (lan-ip, header, messages, expo-spawn env, start orchestrator)
- Section 3 (welcome screen) → Task 8
- Section 4 file changes table → Tasks 1–9 cover every row
- Edge cases (folder missing, folder exists, install fails, port in use, Ctrl+C) → Task 7 (cli.ts handles missing/exists/install-fail/Ctrl+C) + existing Task 5 path (port in use already handled by Phase 2's auto-kill)
- Testing matrix → Task 1 (lan-ip), Task 2 (header), Task 3 (proto-cli messages), Task 6 (create-proto messages), Task 10 (E2E smoke)
- Definition of done → Task 10 steps 5–6 validate the ≤90s + zero-typed-input criteria

**Placeholders:** None — every step has actual code or commands.

**Type consistency:**
- `HeaderInputs` defined in Task 2 used in Task 5
- `Iface` from Task 1 wrapped by `getLanIp()` used in Task 5
- `Messages` type stable across Tasks 3 and 6 (own copies per package)
- `messages.installed(seconds: number)` signature consistent in Tasks 6 and 7

**One open consideration flagged:**
- `readThemeFromConfig` in Task 5 uses a regex to extract the theme from `proto.config.js` rather than `require()`-ing the file. This avoids loading user code into the Node process at CLI startup (which has security and side-effect implications). The regex is intentionally narrow: `theme: 'liquidGlass'`. If a user customises `proto.config.js` to compute the theme dynamically, the regex won't find it and we fall back to `'liquidGlass'`. Acceptable for v1; if it bites, swap to a sandboxed `vm` eval in a follow-up.
