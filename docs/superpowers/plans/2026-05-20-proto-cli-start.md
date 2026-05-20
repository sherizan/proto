# proto-cli `start` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `proto start` — the first command in `proto-cli`. Inside a scaffolded Proto project, it brings up a Metro server (hidden), prints a QR for the `exp://` URL, runs an in-process prompt server on :3001, and surfaces only friendly messages — never Metro chrome or engineering jargon.

**Architecture:** TypeScript ESM CLI compiled to `dist/index.js` via `tsc` with `NodeNext` resolution (lesson learned from create-proto). All logic lives in small single-responsibility modules under `src/`, tested with Vitest. The orchestrator in `src/commands/start.ts` composes a `node:http` prompt server, a Metro-output filter, a stderr-to-friendly-message translator, and an injectable `spawnExpo` wrapper (uses `spawn` from `node:child_process` — never `exec`/`execFile` with user input, no shell). proto-cli never imports from proto-components — it's RN-blind.

**Tech Stack:** TypeScript (ESM, NodeNext), Node 18+. Dependencies: `@clack/prompts`, `qrcode-terminal`. No Express, no fs-extra. Tests via Vitest.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-20-proto-cli-start-design.md`
- Master doc §6, §12, §15 Prompt 4
- CLAUDE.md — TDD for CLI logic; no engineering jargon in designer-facing output

**pnpm note:** pnpm at `~/.local/bin/pnpm` — prepend `export PATH="$HOME/.local/bin:$PATH"` to every command that calls pnpm.

---

## File Structure

```
packages/proto-cli/
├── package.json                       (Task 1)
├── tsconfig.json                      (Task 1) — NodeNext, lesson from create-proto
├── vitest.config.ts                   (Task 1)
├── README.md                          (Task 1)
├── .gitignore                         (Task 1)
└── src/
    ├── messages.ts                    (Task 2)
    ├── messages.test.ts               (Task 2)
    ├── find-config.ts                 (Task 3)
    ├── find-config.test.ts            (Task 3)
    ├── prompt-server.ts               (Task 4)
    ├── prompt-server.test.ts          (Task 4)
    ├── metro-filter.ts                (Task 5)
    ├── metro-filter.test.ts           (Task 5)
    ├── error-translation.ts           (Task 6)
    ├── error-translation.test.ts      (Task 6)
    ├── expo-spawn.ts                  (Task 7)
    ├── expo-spawn.test.ts             (Task 7)
    ├── render-qr.ts                   (Task 8) — copied verbatim from create-proto
    ├── render-qr.test.ts              (Task 8)
    ├── commands/
    │   └── start.ts                   (Task 9)
    ├── cli.ts                         (Task 9)
    └── index.ts                       (Task 10) — bin entry with shebang
```

Plus, in Task 11: update `packages/create-proto/template/package.json` to include `proto-cli` as a devDep, and remove `packages/create-proto/template/.proto/server/index.js` (server is now in-process).

---

## Task 1: Workspace deps, tsconfig, vitest, gitignore, README

**Files:**
- Modify: `packages/proto-cli/package.json`
- Create: `packages/proto-cli/tsconfig.json`
- Create: `packages/proto-cli/vitest.config.ts`
- Create: `packages/proto-cli/README.md`
- Create: `packages/proto-cli/.gitignore`

- [ ] **Step 1: Replace `packages/proto-cli/package.json`**

```json
{
  "name": "proto-cli",
  "version": "0.0.0",
  "description": "Proto CLI — start, add, edit, new-screen, reset (Phase 1 ships only `start`)",
  "type": "module",
  "bin": {
    "proto": "./dist/index.js"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "qrcode-terminal": "^0.12.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/qrcode-terminal": "^0.12.2"
  }
}
```

- [ ] **Step 2: Create `packages/proto-cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "noEmit": false
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

`NodeNext` is load-bearing — the compiled CLI is executed directly by Node. Every relative import in `src/*.ts` must end with `.js` (e.g. `from './cli.js'`). Test files use Vitest's resolver and don't need the extension.

- [ ] **Step 3: Create `packages/proto-cli/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create `packages/proto-cli/README.md`**

```md
# proto-cli

The Proto CLI — `proto start`, and more in future phases.

```bash
pnpm proto start
```

See `docs/proto-master.md`.
```

- [ ] **Step 5: Create `packages/proto-cli/.gitignore`**

```
dist/
node_modules/
```

- [ ] **Step 6: Install deps**

```bash
export PATH="$HOME/.local/bin:$PATH"
pnpm install
```

Expected: deps resolve, lockfile updates.

- [ ] **Step 7: Verify toolchain runs**

```bash
export PATH="$HOME/.local/bin:$PATH"
pnpm --filter proto-cli test
pnpm --filter proto-cli typecheck
```

Both should run. Vitest will report "No test files found" (non-zero exit but expected — this is bootstrap). Tsc will report "No inputs were found" — also expected bootstrap state. Either passes are fine; if you see something other than "no input" / "no test" complaints, STOP.

- [ ] **Step 8: Commit**

```bash
git add packages/proto-cli/package.json packages/proto-cli/tsconfig.json packages/proto-cli/vitest.config.ts packages/proto-cli/README.md packages/proto-cli/.gitignore pnpm-lock.yaml
git commit -m "chore(proto-cli): wire workspace deps, tsconfig, vitest"
```

---

## Task 2: messages.ts (designer copy) with jargon audit

**Files:**
- Create: `packages/proto-cli/src/messages.test.ts`
- Create: `packages/proto-cli/src/messages.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/messages.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { messages } from './messages';

const bannedFragments = [
  'npm',
  'pnpm',
  'yarn',
  'node',
  'expo',
  'metro',
  'error code',
  'stack',
];

describe('messages', () => {
  it('exposes the keys the start command uses', () => {
    expect(messages.startingHeader).toBe('Proto');
    expect(messages.noConfig).toBeTruthy();
    expect(messages.starting).toBeTruthy();
    expect(messages.ready).toBeTruthy();
    expect(messages.stopped).toBeTruthy();
    expect(messages.portInUse).toBeTruthy();
    expect(messages.componentNotFound).toBeTruthy();
    expect(messages.screenSyntax).toBeTruthy();
    expect(messages.noDeviceConnection).toBeTruthy();
    expect(messages.generic).toBeTruthy();
  });

  it('contains no engineering jargon (case-insensitive)', () => {
    for (const value of Object.values(messages)) {
      const text = typeof value === 'string' ? value : '';
      for (const banned of bannedFragments) {
        expect(text.toLowerCase()).not.toContain(banned);
      }
    }
  });

  it('contains no version-like substrings', () => {
    const versionPattern = /\d+\.\d+\.\d+/;
    for (const value of Object.values(messages)) {
      if (typeof value === 'string') {
        expect(value).not.toMatch(versionPattern);
      }
    }
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

Expected: FAIL — module missing.

- [ ] **Step 3: Create `packages/proto-cli/src/messages.ts`**

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
};

export type Messages = typeof messages;
```

- [ ] **Step 4: Run — expect pass**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/messages.ts packages/proto-cli/src/messages.test.ts
git commit -m "feat(proto-cli): designer-facing message strings with jargon audit"
```

---

## Task 3: find-config.ts (locate proto.config.js)

**Files:**
- Create: `packages/proto-cli/src/find-config.test.ts`
- Create: `packages/proto-cli/src/find-config.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/find-config.test.ts`**

```ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { findConfig } from './find-config';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-find-test-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('findConfig', () => {
  it('returns ok with resolved path when proto.config.js exists', () => {
    const configPath = path.join(tmpRoot, 'proto.config.js');
    fs.writeFileSync(configPath, 'export default {};');
    const result = findConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.root).toBe(tmpRoot);
      expect(result.configPath).toBe(configPath);
    }
  });

  it('also accepts proto.config.mjs', () => {
    const configPath = path.join(tmpRoot, 'proto.config.mjs');
    fs.writeFileSync(configPath, 'export default {};');
    const result = findConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configPath).toBe(configPath);
  });

  it('also accepts proto.config.cjs', () => {
    const configPath = path.join(tmpRoot, 'proto.config.cjs');
    fs.writeFileSync(configPath, 'module.exports = {};');
    const result = findConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configPath).toBe(configPath);
  });

  it('also accepts proto.config.ts', () => {
    const configPath = path.join(tmpRoot, 'proto.config.ts');
    fs.writeFileSync(configPath, 'export default {};');
    const result = findConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configPath).toBe(configPath);
  });

  it('returns the friendly reason when no config is found', () => {
    const result = findConfig(tmpRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/proto project/i);
  });

  it('does not walk up directories', () => {
    const child = path.join(tmpRoot, 'child');
    fs.mkdirSync(child);
    fs.writeFileSync(path.join(tmpRoot, 'proto.config.js'), 'export default {};');
    const result = findConfig(child);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 3: Create `packages/proto-cli/src/find-config.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { messages } from './messages.js';

export type ConfigLookup =
  | { ok: true; root: string; configPath: string }
  | { ok: false; reason: string };

const CANDIDATES = ['proto.config.js', 'proto.config.mjs', 'proto.config.cjs', 'proto.config.ts'];

export function findConfig(cwd: string): ConfigLookup {
  for (const name of CANDIDATES) {
    const candidate = path.join(cwd, name);
    if (fs.existsSync(candidate)) {
      return { ok: true, root: cwd, configPath: candidate };
    }
  }
  return { ok: false, reason: messages.noConfig };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/find-config.ts packages/proto-cli/src/find-config.test.ts
git commit -m "feat(proto-cli): locate proto.config.js in current directory"
```

---

## Task 4: prompt-server.ts (node:http on :3001 with /health)

**Files:**
- Create: `packages/proto-cli/src/prompt-server.test.ts`
- Create: `packages/proto-cli/src/prompt-server.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/prompt-server.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { startPromptServer } from './prompt-server';

async function fetchJson(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url);
  return { status: res.status, body: await res.text() };
}

describe('prompt-server', () => {
  it('responds to GET /health with { status: "ok" }', async () => {
    const server = await startPromptServer({ port: 0 });
    try {
      const { status, body } = await fetchJson(`http://127.0.0.1:${server.port}/health`);
      expect(status).toBe(200);
      expect(JSON.parse(body)).toEqual({ status: 'ok' });
    } finally {
      await server.close();
    }
  });

  it('returns 404 for unknown paths', async () => {
    const server = await startPromptServer({ port: 0 });
    try {
      const { status } = await fetchJson(`http://127.0.0.1:${server.port}/nope`);
      expect(status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it('rejects when the port is already in use', async () => {
    const first = await startPromptServer({ port: 0 });
    try {
      await expect(startPromptServer({ port: first.port })).rejects.toThrow(/EADDRINUSE/);
    } finally {
      await first.close();
    }
  });

  it('close() resolves and the server stops accepting connections', async () => {
    const server = await startPromptServer({ port: 0 });
    const port = server.port;
    await server.close();
    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 3: Create `packages/proto-cli/src/prompt-server.ts`**

```ts
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export type StartServerOptions = { port?: number };
export type ServerHandle = {
  port: number;
  close: () => Promise<void>;
};

export function startPromptServer(options: StartServerOptions = {}): Promise<ServerHandle> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    server.once('error', (err) => {
      reject(err);
    });

    server.listen(options.port ?? 3001, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({
        port: addr.port,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => {
              if (err) rejectClose(err);
              else resolveClose();
            });
          }),
      });
    });
  });
}
```

- [ ] **Step 4: Run — expect pass**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/prompt-server.ts packages/proto-cli/src/prompt-server.test.ts
git commit -m "feat(proto-cli): in-process prompt server with /health"
```

---

## Task 5: metro-filter.ts (line classification)

**Files:**
- Create: `packages/proto-cli/src/metro-filter.test.ts`
- Create: `packages/proto-cli/src/metro-filter.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/metro-filter.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { filterMetroLine } from './metro-filter';

describe('filterMetroLine', () => {
  it('extracts the exp:// URL from a Metro line', () => {
    const line = '› Metro waiting on exp://192.168.1.42:8081';
    const result = filterMetroLine(line);
    expect(result.type).toBe('qr-url');
    if (result.type === 'qr-url') {
      expect(result.url).toBe('exp://192.168.1.42:8081');
    }
  });

  it('extracts the exp:// URL when prefixed differently', () => {
    const result = filterMetroLine('Started Metro at exp://10.0.0.5:19000');
    expect(result.type).toBe('qr-url');
    if (result.type === 'qr-url') expect(result.url).toBe('exp://10.0.0.5:19000');
  });

  it('classifies leading-arrow chrome as noise', () => {
    expect(filterMetroLine('› Logs for your project will appear below.').type).toBe('noise');
    expect(filterMetroLine('› Press ? │ show all commands').type).toBe('noise');
  });

  it('classifies "Logs for your project" banner as noise', () => {
    expect(filterMetroLine('Logs for your project will appear below.').type).toBe('noise');
  });

  it('classifies port banners as noise', () => {
    expect(filterMetroLine('› Metro running on port 8081').type).toBe('noise');
  });

  it('passes through unrecognised lines', () => {
    const result = filterMetroLine('Some unfamiliar string from a tool');
    expect(result.type).toBe('passthrough');
    if (result.type === 'passthrough') expect(result.line).toBe('Some unfamiliar string from a tool');
  });

  it('classifies empty lines as noise', () => {
    expect(filterMetroLine('').type).toBe('noise');
    expect(filterMetroLine('   ').type).toBe('noise');
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 3: Create `packages/proto-cli/src/metro-filter.ts`**

```ts
export type MetroLineResult =
  | { type: 'qr-url'; url: string }
  | { type: 'noise' }
  | { type: 'passthrough'; line: string };

const EXP_URL_RE = /(exp:\/\/[^\s]+)/;
const NOISE_PATTERNS: RegExp[] = [
  /^\s*$/,
  /^›/,
  /^Logs for your project/,
  /Metro running on port/,
  /Press \?/,
  /^Started Metro/,
];

export function filterMetroLine(line: string): MetroLineResult {
  const m = line.match(EXP_URL_RE);
  if (m) {
    return { type: 'qr-url', url: m[1] };
  }
  for (const re of NOISE_PATTERNS) {
    if (re.test(line)) return { type: 'noise' };
  }
  return { type: 'passthrough', line };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/metro-filter.ts packages/proto-cli/src/metro-filter.test.ts
git commit -m "feat(proto-cli): classify Metro stdout lines for QR detection"
```

---

## Task 6: error-translation.ts (stderr to friendly message)

**Files:**
- Create: `packages/proto-cli/src/error-translation.test.ts`
- Create: `packages/proto-cli/src/error-translation.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/error-translation.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { translateMetroError } from './error-translation';

describe('translateMetroError', () => {
  it('maps "Unable to resolve module" to component-not-found', () => {
    expect(translateMetroError('Unable to resolve module ./Foo')).toMatch(/component/i);
  });

  it('maps SyntaxError to screen-syntax', () => {
    expect(translateMetroError('SyntaxError: Unexpected token')).toMatch(/screen has an error/i);
  });

  it('maps "Network request failed" to no-device-connection', () => {
    expect(translateMetroError('Network request failed at ...')).toMatch(/wifi/i);
  });

  it('maps EADDRINUSE to port-in-use', () => {
    expect(translateMetroError('Error: listen EADDRINUSE')).toMatch(/already running/i);
  });

  it('returns the generic message for unrecognised input', () => {
    expect(translateMetroError('Wat')).toMatch(/something went wrong/i);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 3: Create `packages/proto-cli/src/error-translation.ts`**

```ts
import { messages } from './messages.js';

export function translateMetroError(stderr: string): string {
  if (/Unable to resolve module/.test(stderr)) return messages.componentNotFound;
  if (/SyntaxError/.test(stderr)) return messages.screenSyntax;
  if (/Network request failed/.test(stderr)) return messages.noDeviceConnection;
  if (/EADDRINUSE/.test(stderr)) return messages.portInUse;
  return messages.generic;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/error-translation.ts packages/proto-cli/src/error-translation.test.ts
git commit -m "feat(proto-cli): translate Metro stderr into friendly messages"
```

---

## Task 7: expo-spawn.ts (injectable child-process wrapper)

The implementation uses `spawn` from `node:child_process` with explicit args (no shell). Never `exec` or `execFile` with concatenated input.

**Files:**
- Create: `packages/proto-cli/src/expo-spawn.test.ts`
- Create: `packages/proto-cli/src/expo-spawn.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/expo-spawn.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { spawnExpo, type SpawnFn } from './expo-spawn';

function asyncIterableFrom<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

describe('spawnExpo', () => {
  it('invokes the spawn function with npx expo start --config and the configured cwd', async () => {
    const calls: Array<{ cmd: string; args: string[]; cwd: string }> = [];
    const spawnFn: SpawnFn = (cmd, args, opts) => {
      calls.push({ cmd, args, cwd: opts.cwd });
      return {
        stdout: asyncIterableFrom<string>([]),
        stderr: asyncIterableFrom<string>([]),
        kill: () => {},
        exit: Promise.resolve(0),
      };
    };

    const handle = spawnExpo({
      cwd: '/tmp/x',
      configPath: '.proto/expo-config/app.json',
      onStdoutLine: () => {},
      onStderrLine: () => {},
      spawnFn,
    });
    await handle.waitUntilExit;

    expect(calls).toEqual([
      {
        cmd: 'npx',
        args: ['expo', 'start', '--config', '.proto/expo-config/app.json'],
        cwd: '/tmp/x',
      },
    ]);
  });

  it('delivers each stdout line to onStdoutLine', async () => {
    const lines: string[] = [];
    const spawnFn: SpawnFn = () => ({
      stdout: asyncIterableFrom<string>(['hello', '› noise', 'exp://x:1']),
      stderr: asyncIterableFrom<string>([]),
      kill: () => {},
      exit: Promise.resolve(0),
    });

    const handle = spawnExpo({
      cwd: '/tmp/x',
      configPath: '.proto/expo-config/app.json',
      onStdoutLine: (l) => lines.push(l),
      onStderrLine: () => {},
      spawnFn,
    });
    await handle.waitUntilExit;

    expect(lines).toEqual(['hello', '› noise', 'exp://x:1']);
  });

  it('delivers each stderr line to onStderrLine', async () => {
    const lines: string[] = [];
    const spawnFn: SpawnFn = () => ({
      stdout: asyncIterableFrom<string>([]),
      stderr: asyncIterableFrom<string>(['Unable to resolve module ./Foo']),
      kill: () => {},
      exit: Promise.resolve(0),
    });

    const handle = spawnExpo({
      cwd: '/tmp/x',
      configPath: '.proto/expo-config/app.json',
      onStdoutLine: () => {},
      onStderrLine: (l) => lines.push(l),
      spawnFn,
    });
    await handle.waitUntilExit;

    expect(lines).toEqual(['Unable to resolve module ./Foo']);
  });

  it('kill() forwards to the spawned process and resolves waitUntilExit', async () => {
    let killed = false;
    const spawnFn: SpawnFn = () => ({
      stdout: asyncIterableFrom<string>([]),
      stderr: asyncIterableFrom<string>([]),
      kill: () => {
        killed = true;
      },
      exit: Promise.resolve(0),
    });

    const handle = spawnExpo({
      cwd: '/tmp/x',
      configPath: '.proto/expo-config/app.json',
      onStdoutLine: () => {},
      onStderrLine: () => {},
      spawnFn,
    });
    await handle.kill();
    expect(killed).toBe(true);
    await expect(handle.waitUntilExit).resolves.toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 3: Create `packages/proto-cli/src/expo-spawn.ts`**

```ts
import { spawn as nodeSpawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';

export type SpawnedProcess = {
  stdout: AsyncIterable<string>;
  stderr: AsyncIterable<string>;
  kill: (signal?: NodeJS.Signals) => void;
  exit: Promise<number | null>;
};

export type SpawnFn = (cmd: string, args: string[], opts: { cwd: string }) => SpawnedProcess;

export type SpawnExpoOptions = {
  cwd: string;
  configPath: string;
  onStdoutLine: (line: string) => void;
  onStderrLine: (line: string) => void;
  spawnFn?: SpawnFn;
};

export type ExpoHandle = {
  kill: () => Promise<void>;
  waitUntilExit: Promise<number | null>;
};

export function spawnExpo(options: SpawnExpoOptions): ExpoHandle {
  const fn = options.spawnFn ?? defaultSpawn;
  const child = fn('npx', ['expo', 'start', '--config', options.configPath], {
    cwd: options.cwd,
  });

  (async () => {
    for await (const line of child.stdout) options.onStdoutLine(line);
  })();
  (async () => {
    for await (const line of child.stderr) options.onStderrLine(line);
  })();

  return {
    kill: async () => {
      child.kill('SIGTERM');
      await child.exit.catch(() => null);
    },
    waitUntilExit: child.exit,
  };
}

function defaultSpawn(cmd: string, args: string[], opts: { cwd: string }): SpawnedProcess {
  const child = nodeSpawn(cmd, args, { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] });

  return {
    stdout: readLines(child.stdout),
    stderr: readLines(child.stderr),
    kill: (signal) => child.kill(signal ?? 'SIGTERM'),
    exit: new Promise<number | null>((resolve) => {
      child.on('exit', (code) => resolve(code));
    }),
  };
}

function readLines(stream: Readable | null): AsyncIterable<string> {
  if (!stream) {
    return { async *[Symbol.asyncIterator]() {} };
  }
  return createInterface({ input: stream, crlfDelay: Infinity });
}
```

`spawn` is used with an array of arguments and a fixed command (`npx`), with no shell — safe by construction.

- [ ] **Step 4: Run — expect pass**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/expo-spawn.ts packages/proto-cli/src/expo-spawn.test.ts
git commit -m "feat(proto-cli): spawn expo start with injectable wrapper and per-line streams"
```

---

## Task 8: render-qr.ts (copied verbatim from create-proto)

**Files:**
- Create: `packages/proto-cli/src/render-qr.test.ts`
- Create: `packages/proto-cli/src/render-qr.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/render-qr.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { renderQr } from './render-qr';

describe('renderQr', () => {
  it('returns a non-empty string for a URL', () => {
    const out = renderQr('exp://192.168.1.42:8081');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(20);
  });

  it('produces different output for different URLs', () => {
    const a = renderQr('exp://192.168.1.42:8081');
    const b = renderQr('exp://10.0.0.5:19000');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 3: Create `packages/proto-cli/src/render-qr.ts`**

```ts
import qrcode from 'qrcode-terminal';

export function renderQr(url: string): string {
  let output = '';
  qrcode.generate(url, { small: true }, (rendered) => {
    output = rendered;
  });
  return output;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
export PATH="$HOME/.local/bin:$PATH" && pnpm --filter proto-cli test
```

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/render-qr.ts packages/proto-cli/src/render-qr.test.ts
git commit -m "feat(proto-cli): render QR as a returnable string"
```

---

## Task 9: commands/start.ts + cli.ts (orchestrator + dispatcher)

**Files:**
- Create: `packages/proto-cli/src/commands/start.ts`
- Create: `packages/proto-cli/src/cli.ts`

No unit tests — these are orchestrators of tested parts. Verification via typecheck + manual smoke in Task 12.

- [ ] **Step 1: Create `packages/proto-cli/src/commands/start.ts`**

```ts
import { intro, log, outro, spinner } from '@clack/prompts';
import { messages } from '../messages.js';
import { findConfig } from '../find-config.js';
import { startPromptServer, type ServerHandle } from '../prompt-server.js';
import { spawnExpo } from '../expo-spawn.js';
import { filterMetroLine } from '../metro-filter.js';
import { translateMetroError } from '../error-translation.js';
import { renderQr } from '../render-qr.js';

export type StartOptions = { verbose: boolean };

export async function runStart(options: StartOptions): Promise<void> {
  intro(messages.startingHeader);

  const config = findConfig(process.cwd());
  if (!config.ok) {
    log.error(config.reason);
    process.exit(1);
  }

  let server: ServerHandle | null = null;
  try {
    server = await startPromptServer({ port: 3001 });
  } catch (err) {
    if (err instanceof Error && /EADDRINUSE/.test(err.message)) {
      log.error(messages.portInUse);
      process.exit(1);
    }
    throw err;
  }

  const s = spinner();
  s.start(messages.starting);

  let qrShown = false;
  const expo = spawnExpo({
    cwd: config.root,
    configPath: '.proto/expo-config/app.json',
    onStdoutLine: (line) => {
      if (options.verbose) console.log(line);
      const r = filterMetroLine(line);
      if (r.type === 'qr-url' && !qrShown) {
        qrShown = true;
        s.stop(messages.ready);
        console.log('\n' + renderQr(r.url) + '\n');
      }
    },
    onStderrLine: (line) => {
      if (options.verbose) console.error(line);
      log.error(translateMetroError(line));
    },
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    s.stop(messages.stopped);
    await Promise.all([expo.kill(), server?.close()]);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await expo.waitUntilExit;
  await server?.close();
  outro(messages.stopped);
}
```

- [ ] **Step 2: Create `packages/proto-cli/src/cli.ts`**

```ts
import { runStart } from './commands/start.js';

export async function dispatch(argv: string[]): Promise<void> {
  const command = argv[2];
  const flags = new Set(argv.slice(3));

  if (command === 'start' || command === undefined) {
    await runStart({ verbose: flags.has('--verbose') });
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
```

- [ ] **Step 3: Typecheck + tests**

```bash
export PATH="$HOME/.local/bin:$PATH"
pnpm --filter proto-cli typecheck
pnpm --filter proto-cli test
```

Both exit 0. Test count should match prior batches (tests added in Tasks 2–8 still pass).

- [ ] **Step 4: Commit**

```bash
git add packages/proto-cli/src/commands/start.ts packages/proto-cli/src/cli.ts
git commit -m "feat(proto-cli): start orchestrator and command dispatcher"
```

---

## Task 10: index.ts (bin entry with shebang)

**Files:**
- Create: `packages/proto-cli/src/index.ts`

- [ ] **Step 1: Create `packages/proto-cli/src/index.ts`**

```ts
#!/usr/bin/env node
import { dispatch } from './cli.js';

dispatch(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 2: Build**

```bash
export PATH="$HOME/.local/bin:$PATH"
pnpm --filter proto-cli build
```

Expected: exit 0. `packages/proto-cli/dist/index.js` exists.

- [ ] **Step 3: Verify shebang**

```bash
head -1 packages/proto-cli/dist/index.js
```

Expected: `#!/usr/bin/env node`.

If missing, prepend manually:

```bash
node -e "
const fs = require('fs');
const f = 'packages/proto-cli/dist/index.js';
const c = fs.readFileSync(f, 'utf8');
if (!c.startsWith('#!/usr/bin/env node')) {
  fs.writeFileSync(f, '#!/usr/bin/env node\n' + c);
}
"
```

Then `chmod +x packages/proto-cli/dist/index.js`.

- [ ] **Step 4: Quick runtime smoke (no Proto project — should error friendly)**

```bash
cd /tmp && node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js start 2>&1 | head -5
cd /Users/sherizan/Public/proto
```

Expected output contains "Proto" header and "Run this inside a Proto project."

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/index.ts
git commit -m "feat(proto-cli): bin entry with shebang"
```

---

## Task 11: Wire proto-cli into the create-proto template and drop the obsolete server file

**Files:**
- Modify: `packages/create-proto/template/package.json`
- Delete: `packages/create-proto/template/.proto/server/index.js`
- Also delete: the now-empty `packages/create-proto/template/.proto/server/` directory

- [ ] **Step 1: Modify `packages/create-proto/template/package.json` — add the `proto` script and the proto-cli devDep**

Replace the whole file with:

```json
{
  "name": "{{name}}",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --config .proto/expo-config/app.json",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "proto": "proto"
  },
  "dependencies": {
    "expo": "~53.0.0",
    "expo-router": "~3.5.0",
    "expo-haptics": "~13.0.0",
    "expo-status-bar": "~1.12.0",
    "react": "18.3.1",
    "react-native": "0.74.0",
    "react-native-safe-area-context": "4.10.0",
    "react-native-screens": "3.31.0",
    "react-native-reanimated": "3.10.0",
    "react-native-gesture-handler": "~2.16.0",
    "@react-native-community/blur": "4.4.1"
  },
  "devDependencies": {
    "proto-cli": "*",
    "@babel/core": "^7.24.0",
    "typescript": "^5.5.0",
    "@types/react": "^18.3.0"
  }
}
```

Notable changes:
- Added `"proto": "proto"` to scripts so `pnpm proto start` resolves to the proto-cli binary
- Added `"proto-cli": "*"` to devDependencies — flagged as a release blocker (needs a real pinned version before publish to npm)

- [ ] **Step 2: Remove the obsolete prompt server stub**

```bash
rm packages/create-proto/template/.proto/server/index.js
rmdir packages/create-proto/template/.proto/server
```

- [ ] **Step 3: Verify the template still scaffolds correctly**

```bash
rm -rf /tmp/proto-smoke && mkdir -p /tmp/proto-smoke
node -e "
import('/Users/sherizan/Public/proto/packages/create-proto/dist/copy-template.js').then(async ({ copyTemplate }) => {
  await copyTemplate({
    templateRoot: '/Users/sherizan/Public/proto/packages/create-proto/template',
    destRoot: '/tmp/proto-smoke/smoke-app',
    projectName: 'smoke-app',
  });
  console.log('Scaffold complete');
});
"
ls /tmp/proto-smoke/smoke-app/.proto/
grep '"proto"' /tmp/proto-smoke/smoke-app/package.json
grep '"proto-cli"' /tmp/proto-smoke/smoke-app/package.json
rm -rf /tmp/proto-smoke
```

Expected:
- `.proto/` listing shows `app/`, `expo-config/`, `.gitignore` — no `server/`.
- The two `grep` calls each return a single matching line.

- [ ] **Step 4: Rebuild create-proto (its template just changed, so the published artefact would too — verify it still builds)**

```bash
export PATH="$HOME/.local/bin:$PATH"
pnpm --filter create-proto build
pnpm --filter create-proto test
```

Both exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/create-proto/template/package.json packages/create-proto/template/.proto/server
git commit -m "feat(create-proto): bundle proto-cli devDep and drop obsolete server stub"
```

(Git will record `.proto/server/index.js` as deleted; the empty directory just disappears.)

---

## Task 12: End-to-end light smoke for proto-cli

This task is verification only — no new source files.

- [ ] **Step 1: Confirm the `start` command surfaces the no-config error outside a Proto project**

```bash
cd /tmp && node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js start 2>&1 | tail -5
echo "Exit: $?"
cd /Users/sherizan/Public/proto
```

Expected: output contains "Run this inside a Proto project." Exit is non-zero (the trailing `echo` shows it after the pipe).

- [ ] **Step 2: Confirm the prompt server actually binds when invoked**

We can't drive the full `proto start` flow in a non-TTY shell (clack and Metro need stdin). Instead, exercise the prompt server module directly:

```bash
node -e "
(async () => {
  const mod = await import('/Users/sherizan/Public/proto/packages/proto-cli/dist/prompt-server.js');
  const server = await mod.startPromptServer({ port: 3001 });
  const res = await fetch('http://127.0.0.1:3001/health');
  console.log('status:', res.status);
  console.log('body:', await res.text());
  await server.close();
})();
"
```

Expected:
```
status: 200
body: {"status":"ok"}
```

- [ ] **Step 3: Confirm all package-level checks**

```bash
cd /Users/sherizan/Public/proto
export PATH="$HOME/.local/bin:$PATH"
pnpm --filter proto-cli typecheck
pnpm --filter proto-cli test
pnpm --filter proto-cli build
```

All three exit 0.

- [ ] **Step 4: Acceptance vs spec (`docs/superpowers/specs/2026-05-20-proto-cli-start-design.md`)**

Mark each:
1. `pnpm --filter proto-cli test` passes — ✓ Step 3
2. `pnpm --filter proto-cli typecheck` passes — ✓ Step 3
3. Build produces `dist/index.js` with shebang — ✓ Task 10 Step 3
4. Running outside a Proto project surfaces friendly error — ✓ Step 1
5. Running inside a scaffolded project (Metro + QR + prompt server) — DEFERRED to first device run (proves out the orchestrator end-to-end; not blocking)
6. Ctrl-C teardown — DEFERRED to first device run
7. `messages.ts` jargon audit — ✓ Task 2

- [ ] **Step 5: Commit verification marker**

```bash
cd /Users/sherizan/Public/proto
git commit --allow-empty -m "test(proto-cli): start command modules verified; full e2e deferred to device run"
```

---

## Self-review notes

**Spec coverage:**
- Install vector (proto-cli as devDep) — Task 11 ✓
- Prompt server on :3001 with `/health` — Task 4 ✓
- node:http (no Express) — Task 4 ✓
- proto-cli RN-blind — confirmed: no module imports from proto-components in any Task
- Ctrl-C cleanup — Task 9 (shutdown handler) ✓
- Config discovery in CWD only — Task 3 ✓
- Port 3001 collision message — Task 9 catches EADDRINUSE; Task 6 also has the mapping
- Metro stdout suppression + QR extraction — Tasks 5 + 9 ✓
- Metro stderr translation — Tasks 6 + 9 ✓
- `--verbose` flag — Task 9 (cli.ts dispatcher passes it through) ✓
- Removal of `.proto/server/index.js` — Task 11 Step 2 ✓
- Template's `proto-cli: *` placeholder — Task 11 Step 1 with release-blocker note ✓

**Placeholder scan:** no TBD/TODO patterns. Open follow-ups in spec are intentional and called out.

**Type consistency:**
- `ConfigLookup` defined in Task 3, used in Task 9 ✓
- `ServerHandle` defined in Task 4, used in Task 9 ✓
- `MetroLineResult` defined in Task 5, used in Task 9 ✓
- `SpawnFn`, `ExpoHandle`, `SpawnExpoOptions` defined in Task 7, used in Task 9 ✓
- `messages` shape defined in Task 2, consumed unchanged in Tasks 3, 6, 9 ✓
- `StartOptions` in Task 9 (commands/start.ts) consumed by Task 9 (cli.ts dispatcher) ✓

**Known sharp edges:**
- The end-to-end run inside a real scaffolded project (Step 5+6 of acceptance) is deferred. Reason: `npm install` of the scaffolded project's Expo dep tree + `expo start` startup is multi-minute, network-dependent work that adds little value in CI but matters on a real device. Captured in Task 12 acceptance.
- The `proto-cli: *` workspace placeholder in the template is flagged as a release blocker in both spec and Task 11.
- `expo-spawn.ts`'s real `defaultSpawn` is not unit-tested (only the injected `spawnFn` path is). Real spawn is exercised by the deferred device run.
