# proto-cli `start` — Design Spec

> Date: 2026-05-20
> Unit: Phase 1, deliverable 3 (`packages/proto-cli`, scope limited to the `start` command)
> Source spec: `docs/proto-master.md` §6, §12, §15 Prompt 4
> Depends on: `packages/create-proto` (scaffolded projects include `proto-cli` as a devDep), `packages/proto-components` (already shipped)

## Goal

Ship the first command in the `proto` CLI: `proto start`. Designer runs `pnpm proto start` (or `npx proto start`) inside a scaffolded project and gets:
- a Metro server running (hidden)
- a QR rendered in the terminal for the `exp://` URL
- a prompt server on :3001 ready for Phase 2 `proto add`
- friendly messages, no Metro noise, no engineering jargon
- clean Ctrl-C teardown

`proto-cli` is also the home for future commands (`new-screen`, `add`, `edit`, `reset`). This unit only ships `start`; the `commands/` dir is structured so adding the rest is straightforward.

## Decisions

| Decision | Choice |
|---|---|
| Install vector | Bundled as devDep in scaffolded `package.json` (added in this unit by extending the `create-proto` template). Designer runs `pnpm proto start`. |
| Prompt server framework | `node:http` built-in. Drop the Express requirement from master doc §15 Prompt 4. |
| Server lifecycle | In-process — `proto-cli` runs the server inside its own process. The orphaned `.proto/server/index.js` from the create-proto template gets removed in this unit. |
| proto-cli's awareness of RN | None. proto-cli orchestrates Metro and the server; it never imports from `proto-components`. |
| Ctrl-C | Trap SIGINT, send SIGTERM to Metro, close the server, exit 0. Print "Proto stopped." |
| Expo invocation | `npx expo start --config .proto/expo-config/app.json` from the project CWD. Avoids assuming `expo` is in PATH. |
| Metro stdout policy | Suppress all unless `--verbose` flag is set. The only thing the user sees is the QR + friendly status updates. |
| Metro stderr policy | Pattern-match against the error-translation table; surface the translated message; never the raw stderr. |
| Config discovery | CWD only. If `proto.config.js` not found in CWD, friendly error: "Run this inside a Proto project." |
| Port 3001 collision | Friendly: "Proto is already running in another window. Close it first, then try again." |
| Tests | TDD per CLAUDE.md for every logic module (server, filter, translation, find-config, messages). The `start` orchestrator itself has no unit test — integration is verified manually on first device run. |
| Render QR | Copy the small `render-qr.ts` from create-proto. Not worth extracting yet. |

## Package shape

```
packages/proto-cli/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── .gitignore
├── src/
│   ├── index.ts                  (entry — #!/usr/bin/env node — routes to commands/)
│   ├── cli.ts                    (argv parser; dispatches subcommand)
│   ├── messages.ts               (designer-facing copy)
│   ├── messages.test.ts          (jargon audit)
│   ├── find-config.ts            (locate proto.config.js in CWD)
│   ├── find-config.test.ts
│   ├── prompt-server.ts          (node:http server on :3001 with GET /health)
│   ├── prompt-server.test.ts
│   ├── metro-filter.ts           (line-by-line stdout filter; detect exp:// URL)
│   ├── metro-filter.test.ts
│   ├── error-translation.ts      (Metro stderr → friendly message)
│   ├── error-translation.test.ts
│   ├── expo-spawn.ts             (spawn wrapper, injectable for tests)
│   ├── expo-spawn.test.ts
│   ├── render-qr.ts              (qrcode-terminal wrapper — copied from create-proto)
│   ├── render-qr.test.ts
│   └── commands/
│       └── start.ts              (orchestrator — no unit test)
```

## Module contracts

### `messages.ts`

```ts
export const messages = {
  startingHeader: 'Proto',
  noConfig: 'Run this inside a Proto project.',
  starting: 'Starting',
  ready: 'Scan the QR to preview on your device',
  stopped: 'Proto stopped.',
  portInUse: 'Proto is already running in another window. Close it first, then try again.',
  componentNotFound: 'A component couldn\'t be found. Run: proto reset',
  screenSyntax: 'A screen has an error. Run: proto edit <screen-name> "fix any errors"',
  noDeviceConnection: 'Can\'t reach your device. Check you\'re on the same WiFi.',
  generic: 'Something went wrong. Run: proto reset',
};
```

Test (`messages.test.ts`) — same jargon-audit pattern as create-proto: no `npm`, `pnpm`, `node`, `expo`, `metro`, `error code`, `stack`, no version numbers.

### `find-config.ts`

```ts
export type ConfigLookup =
  | { ok: true; root: string; configPath: string }
  | { ok: false; reason: string };

export function findConfig(cwd: string): ConfigLookup;
```

Checks for `proto.config.js` (or `.mjs`, `.cjs`, `.ts`) in `cwd`. Returns the resolved path. Friendly reason if missing.

### `prompt-server.ts`

```ts
import type { Server } from 'node:http';

export type StartServerOptions = { port?: number };
export type ServerHandle = { close: () => Promise<void>; port: number };

export async function startPromptServer(options?: StartServerOptions): Promise<ServerHandle>;
```

Routes:
- `GET /health` → 200 `{ status: 'ok' }`
- anything else → 404

The `close` method gracefully stops the server. Phase 2 will add `POST /generate`, `POST /modify`, `GET /screens`, `DELETE /screens/:name` to this module.

Tests:
- starts on a random ephemeral port when 0 is passed
- `/health` returns `{ status: 'ok' }`
- unknown path returns 404
- `EADDRINUSE` on the bound port surfaces as a rejected promise the caller can map to `messages.portInUse`

### `metro-filter.ts`

```ts
export type MetroLineResult =
  | { type: 'qr-url'; url: string }
  | { type: 'noise' }
  | { type: 'passthrough'; line: string };

export function filterMetroLine(line: string): MetroLineResult;
```

Pure function over a single line of Metro stdout.

Rules:
- Line containing `exp://` → extract URL via regex, return `qr-url`
- Lines matching known Metro chrome (`›`, `Logs for your project`, `Press`, port banners, Babel warnings, etc.) → `noise`
- Anything else → `passthrough` so verbose mode (or future debug tooling) can see it

Tests cover each branch with realistic Metro sample lines (fixtures inlined in the test file).

### `error-translation.ts`

```ts
export function translateMetroError(stderr: string): string;
```

Pure function. Returns the friendly message. Maps:

| Pattern (case-sensitive regex) | Returns |
|---|---|
| `/Unable to resolve module/` | `messages.componentNotFound` |
| `/SyntaxError/` | `messages.screenSyntax` |
| `/Network request failed/` | `messages.noDeviceConnection` |
| `/EADDRINUSE/` | `messages.portInUse` (but in practice the prompt-server path is the more likely surface) |
| anything else | `messages.generic` |

### `expo-spawn.ts`

```ts
export type SpawnExpoOptions = {
  cwd: string;
  configPath: string;          // relative to cwd, e.g. '.proto/expo-config/app.json'
  onStdoutLine: (line: string) => void;
  onStderrLine: (line: string) => void;
  spawnFn?: SpawnFn;           // injectable for tests
};

export type ExpoHandle = {
  kill: () => Promise<void>;
  waitUntilExit: Promise<number | null>;
};

export type SpawnFn = (cmd: string, args: string[], opts: { cwd: string }) => {
  stdout: AsyncIterable<string>;
  stderr: AsyncIterable<string>;
  kill: (signal?: NodeJS.Signals) => void;
  exit: Promise<number | null>;
};

export function spawnExpo(options: SpawnExpoOptions): ExpoHandle;
```

Spawns `npx expo start --config <configPath>` in `cwd`. Each complete stdout/stderr line is delivered to the callbacks. `kill()` sends SIGTERM and awaits exit (with a short timeout, then SIGKILL).

Tests inject a fake `spawnFn` that emits scripted lines and verifies the callbacks fire.

### `render-qr.ts`

Identical to `packages/create-proto/src/render-qr.ts`. Copy verbatim. (One reasonable future refactor: extract to a shared `packages/proto-shared/` package. Deferred — premature with two callers.)

### `commands/start.ts`

Orchestrator:

```ts
import { messages } from '../messages.js';
import { findConfig } from '../find-config.js';
import { startPromptServer } from '../prompt-server.js';
import { spawnExpo } from '../expo-spawn.js';
import { filterMetroLine } from '../metro-filter.js';
import { translateMetroError } from '../error-translation.js';
import { renderQr } from '../render-qr.js';
import { intro, outro, log, spinner } from '@clack/prompts';

export type StartOptions = { verbose: boolean };

export async function runStart(options: StartOptions): Promise<void> {
  intro(messages.startingHeader);

  const config = findConfig(process.cwd());
  if (!config.ok) {
    log.error(config.reason);
    process.exit(1);
  }

  let server: Awaited<ReturnType<typeof startPromptServer>> | null = null;
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

  const shutdown = async () => {
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

No unit test — it's pure orchestration of tested parts. Manual integration validation on first device run.

### `cli.ts`

```ts
import { runStart } from './commands/start.js';

export async function dispatch(argv: string[]): Promise<void> {
  const command = argv[2];
  const flags = new Set(argv.slice(3));

  if (command === 'start' || command === undefined) {
    await runStart({ verbose: flags.has('--verbose') });
    return;
  }

  // Future commands will register here.
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
```

### `index.ts`

```ts
#!/usr/bin/env node
import { dispatch } from './cli.js';

dispatch(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

## Changes to other packages

1. **`packages/create-proto/template/package.json`** — add `proto-cli` to `devDependencies` and add a `proto` script:

```json
"scripts": {
  "start": "expo start --config .proto/expo-config/app.json",
  "proto": "proto",
  ...
},
"devDependencies": {
  "proto-cli": "*",     ← workspace dep at scaffold time; pinned at publish time
  ...
}
```

Designer runs `pnpm proto start` which resolves to the `proto` binary from `proto-cli`'s `bin` field. Or `npx proto start`.

Caveat: at workspace dev time, `*` resolves to the local package (pnpm workspace). At publish time we'll pin to the published version. A small `create-proto` post-build step will be required to flip `*` → a real version when we publish; not yet in scope.

2. **`packages/create-proto/template/.proto/server/index.js`** — remove. The prompt server now lives in proto-cli's process.

Update the create-proto plan accordingly.

## Acceptance

1. `pnpm --filter proto-cli test` passes.
2. `pnpm --filter proto-cli typecheck` passes.
3. `pnpm --filter proto-cli build` produces `dist/index.js` with shebang.
4. Running `node packages/proto-cli/dist/index.js start` outside a Proto project prints the friendly "Run this inside a Proto project." error.
5. Running it inside a scaffolded project: prompt server binds to 3001 (verify by `curl localhost:3001/health` from another shell → `{ status: 'ok' }`). Metro starts. The exp:// URL appears, gets converted to a QR, gets printed. No raw Metro chrome leaks.
6. SIGINT (Ctrl-C) cleanly stops both processes; final message is "Proto stopped."; exit code 0.
7. `messages.ts` passes the jargon audit.

## Out of scope

- Other `proto-cli` commands (`new-screen`, `add`, `edit`, `reset`) — separate units.
- Telemetry.
- Multiple Proto projects open simultaneously (assumes one Metro at a time).
- Windows-specific shell handling — flagged as Phase 1 risk in master doc §16.
- Publishing `proto-cli` to npm — release task, not implementation.
- Refactoring `render-qr` into a shared package.

## Open follow-ups

- The `proto-cli: *` placeholder in the template's package.json works under pnpm workspaces but won't resolve when a published `create-proto` scaffolds a project on a designer's machine. Before launch, `create-proto`'s build step will need to substitute `*` with a real published version. Track this as a release blocker.
- `expo start` startup time is the dominant factor in the 90-second north-star metric. Measure on a clean Mac as part of Phase 1 acceptance for the whole north-star.
