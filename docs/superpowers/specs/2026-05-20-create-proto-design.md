# create-proto — Design Spec

> Date: 2026-05-20
> Unit: Phase 1, deliverable 1 (`packages/create-proto`)
> Source spec: `docs/proto-master.md` §6, §5, §15 Prompt 2
> Depends on: `packages/proto-components` (built and committed at `bb8c276`)

## Goal

Ship `create-proto` — the `npm create proto@latest <name>` CLI that scaffolds a working Proto prototype project in under 90 seconds (master doc north-star). One question. One terminal output. One QR. Designer never sees pnpm/npm noise, file paths, or version numbers.

## Decisions

| Decision | Choice |
|---|---|
| Template source of truth | Build-time copy: `proto-components/src/` → `create-proto/template/components/proto/` via prebuild script. Single source of truth in `proto-components`. |
| Template `components/proto/` location | Gitignored inside `create-proto/`; populated by `pnpm --filter create-proto sync-template`. |
| QR behaviour | Placeholder QR for `http://localhost:8081` (per master doc §15 Prompt 2). Real QR comes via `proto start` in unit 3. |
| Folder collision | Abort with friendly message. No overwrite prompt, no merge. |
| Install vectors verified | `npm create proto@latest`, `pnpm create proto`, `yarn create proto`. |
| Package manager for scaffolded project install | Detect from `process.env.npm_config_user_agent`; fall back to `npm`. Use the same manager the designer used to invoke `create-proto`. |
| Project name validation | Must be valid npm package name (lowercase, hyphens/underscores OK, no spaces, no leading digit). If invalid, prompt for a better name. |
| Default name | Folder name (if user ran `npm create proto@latest my-app`, default is `my-app`). |
| Asset placeholders | Bundled stub PNGs for `assets/icon.png` and `assets/splash.png`. |
| Expo SDK | Pinned to SDK 53 in scaffolded `package.json`. |
| Terminal UX | `clack` for prompts/spinners/output. Never show stdout from package install, even on failure — translate to friendly message. |
| Tests | TDD per CLAUDE.md — scaffold logic, project name validation, template copying, package manager detection all get tests via Vitest. |

## Package shape

```
packages/create-proto/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md                          (designer-facing one-liner)
├── scripts/
│   └── sync-template.ts               (copies proto-components/src → template/components/proto)
├── src/
│   ├── index.ts                       (entry — `#!/usr/bin/env node`)
│   ├── cli.ts                         (orchestrator — clack flow)
│   ├── validate-name.ts               (npm-package-name + folder-name validation)
│   ├── detect-pm.ts                   (parse npm_config_user_agent → 'npm'|'pnpm'|'yarn')
│   ├── copy-template.ts               (recursive copy with name interpolation)
│   ├── install-deps.ts                (spawn pm install silently)
│   ├── render-qr.ts                   (qrcode-terminal wrapper)
│   ├── messages.ts                    (designer-facing strings)
│   └── *.test.ts                      (one beside each module)
└── template/
    ├── proto.config.js
    ├── package.json                   (Expo deps pinned, see below)
    ├── .gitignore
    ├── README.md                      (designer-facing — what they can do)
    ├── screens/
    │   ├── Home.tsx
    │   └── .gitkeep
    ├── assets/
    │   ├── icon.png                   (placeholder PNG)
    │   ├── splash.png                 (placeholder PNG)
    │   └── .gitkeep
    ├── components/
    │   └── proto/                     (gitignored — synced from proto-components)
    │       └── .gitkeep
    └── .proto/
        ├── app/
        │   ├── _layout.tsx
        │   └── (proto)/
        │       └── [...screen].tsx
        ├── server/
        │   └── index.js               (Phase 2 stub — health endpoint only)
        ├── expo-config/
        │   ├── app.json
        │   ├── babel.config.js
        │   └── metro.config.js
        └── .gitignore
```

Each `src/*.ts` is one responsibility with a small interface, easy to test in isolation.

## Module contracts

### `validate-name.ts`

```ts
export type NameValidation =
  | { ok: true; sanitized: string }
  | { ok: false; reason: string };

export function validateName(input: string): NameValidation;
```

Rules:
- Must be a valid npm package name (use `validate-npm-package-name`).
- No spaces (auto-suggest hyphenation in the reason).
- Not a reserved name (`node_modules`, `.proto`, `proto`).
- Length 1–214.

Returns `{ ok: true, sanitized }` where `sanitized` is the lowercased, trimmed input. Otherwise the friendly reason for the rejection (no jargon).

### `detect-pm.ts`

```ts
export type PackageManager = 'npm' | 'pnpm' | 'yarn';
export function detectPm(userAgent: string | undefined): PackageManager;
```

Parses `npm_config_user_agent` (set by all three managers when invoking a `create-*` package). Falls back to `'npm'` if undefined or unrecognised.

### `copy-template.ts`

```ts
export type CopyOptions = {
  templateRoot: string;
  destRoot: string;
  projectName: string;     // injected into proto.config.js + package.json + README
};
export async function copyTemplate(options: CopyOptions): Promise<void>;
```

Recursively copies the template tree to `destRoot`. For every file:
- `*.tsx`, `*.ts`, `*.js`, `*.json`, `*.md` — read, replace `{{name}}` tokens with `projectName`, write.
- Other files (PNGs etc.) — binary copy.
- Skip `.gitkeep` files.

### `install-deps.ts`

```ts
export type InstallOptions = {
  cwd: string;
  pm: PackageManager;
  onError: (friendlyMessage: string) => void;
};
export async function installDeps(options: InstallOptions): Promise<void>;
```

Spawns `${pm} install` in `cwd`. Captures stderr — does NOT print it. On non-zero exit, calls `onError` with a translated message (see Error layer below). On success, returns.

### `render-qr.ts`

```ts
export function renderQr(url: string): string;
```

Wraps `qrcode-terminal.generate(..., { small: true })` and returns the rendered string. Tested by snapshot (just verifies output is non-empty + correct shape).

### `messages.ts`

All designer-facing strings live here. Tested via unit tests that confirm no engineering jargon leaks (regex against `npm`, `pnpm`, `node`, `error`, `stack`).

### `cli.ts`

The orchestrator. Pseudocode:

```ts
import { intro, outro, text, spinner, isCancel, cancel, log } from '@clack/prompts';

export async function run(argv: string[]) {
  intro('Proto');

  const folderArg = argv[2];
  const defaultName = folderArg ?? 'my-prototype';

  const name = await text({
    message: 'What is your prototype called?',
    initialValue: defaultName,
    validate: (v) => {
      const r = validateName(v ?? '');
      return r.ok ? undefined : r.reason;
    },
  });
  if (isCancel(name) || typeof name !== 'string') {
    cancel('Cancelled.');
    process.exit(0);
  }

  const dest = path.resolve(process.cwd(), name);
  if (fs.existsSync(dest)) {
    log.error(`That folder already exists. Pick another name or delete "${name}" first.`);
    process.exit(1);
  }

  const s = spinner();
  s.start('Setting things up');
  await copyTemplate({ templateRoot, destRoot: dest, projectName: name });
  s.stop('Project files ready');

  const pm = detectPm(process.env.npm_config_user_agent);
  const s2 = spinner();
  s2.start('Installing');
  await installDeps({ cwd: dest, pm, onError: (msg) => { s2.stop(msg); process.exit(1); } });
  s2.stop('Ready');

  log.info(renderQr('http://localhost:8081'));
  outro('Proto is ready. Scan the QR to preview on your device, or run: proto start');
}
```

## Scaffolded project `package.json` (template)

```json
{
  "name": "{{name}}",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --config .proto/expo-config/app.json",
    "android": "expo start --android",
    "ios": "expo start --ios"
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
    "@babel/core": "^7.24.0",
    "typescript": "^5.5.0",
    "@types/react": "^18.3.0"
  }
}
```

(Versions match `proto-components` peer deps. Update both together when bumping.)

## Designer-facing strings (sample)

| Moment | Output |
|---|---|
| Header | `Proto` |
| Prompt | `What is your prototype called?` |
| Setting up | `Setting things up` |
| Done copying | `Project files ready` |
| Installing | `Installing` |
| Done installing | `Ready` |
| Folder collision | `That folder already exists. Pick another name or delete "<name>" first.` |
| Install failed | `Couldn't get things installed. Check your internet and try again, or visit proto.run/help` |
| Final | `Proto is ready. Scan the QR to preview on your device, or run: proto start` |

No package manager name, no version number, no path appears in any of these.

## Error translation

`install-deps.ts` captures `stderr`. Pattern matching:

| Pattern | Friendly message |
|---|---|
| `ENOTFOUND`, `ETIMEDOUT`, `ECONNREFUSED`, `EAI_AGAIN` | `Couldn't reach the package registry. Check your internet and try again.` |
| `EACCES` | `Don't have permission to write here. Try a different folder.` |
| `ENOSPC` | `Out of disk space. Free some up and try again.` |
| Anything else | `Couldn't get things installed. Try again, or visit proto.run/help` |

No raw error ever surfaces. Master doc §12 philosophy applies.

## Build-time template sync

`scripts/sync-template.ts`:
- Reads `packages/proto-components/src/` (relative to monorepo root).
- Copies into `packages/create-proto/template/components/proto/` (overwriting).
- Excludes `proto-config.d.ts` (dev-only ambient module shim — not needed in the scaffolded project where the real `proto.config.js` exists at the project root and TS auto-discovers it).
- Wired into `create-proto/package.json`:
  - `"prebuild": "tsx scripts/sync-template.ts"`
  - `"prepublishOnly": "tsx scripts/sync-template.ts && tsc -p tsconfig.json"`

Local dev: `pnpm --filter create-proto sync-template` runs it manually.

## Acceptance

1. `pnpm --filter create-proto test` passes (Vitest).
2. `pnpm --filter create-proto typecheck` passes.
3. `pnpm --filter create-proto build` produces `dist/index.js` with a `#!/usr/bin/env node` shebang.
4. `pnpm --filter create-proto sync-template` populates `template/components/proto/` with all 10 components + theme files (no `proto-config.d.ts`).
5. Local install vector test (manual): running `node ./packages/create-proto/dist/index.js test-proto` in a temp dir creates a valid scaffolded project where `pnpm install` succeeds.
6. Folder collision aborts cleanly with the spec message.
7. No string in `messages.ts` contains: `npm`, `pnpm`, `yarn`, `node`, `expo`, `Metro`, `stack`, `error code`, or a version number.
8. Hand-test `npm create`, `pnpm create`, `yarn create` paths (single dry-run each — full publish-and-pull-from-registry deferred until just before the actual launch).

## Out of scope

- Publishing to npm — separate release step, not part of this implementation.
- `proto start`, `proto add`, etc. — different units.
- Telemetry — none in v1.
- Windows-specific path handling — flagged in master doc §16 as a Phase 1 risk; default to forward-slash paths, deal with it if it breaks.
- Designer-side TypeScript configuration of the scaffolded project (no per-screen tsconfig adjustment guidance) — they shouldn't need it.
- Update flow — `proto update` is a different deliverable.

## Open follow-ups (to file as issues later)

- The asset PNG placeholders are intentional — a small but distinct Proto icon. Get a designed icon before the actual launch.
- The `.proto/app/(proto)/[...screen].tsx` expo-router catch-all needs to read `screens/` at runtime — design TBD in unit 3 (`proto start`).
