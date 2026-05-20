# proto-cli `new-screen` and `reset` — Design Spec

> Date: 2026-05-20
> Unit: Phase 1, deliverables 4 + 5 (`proto-cli` additions only)
> Source spec: `docs/proto-master.md` §6, §15 Prompts 6 + 7
> Depends on: `packages/proto-cli` `start` command (already shipped)

## Goal

Add the remaining Phase 1 `proto-cli` commands:
- `proto new-screen <name>` — generates a new screen file, optionally from a built-in template
- `proto reset` — designer's escape hatch: kills orphaned processes, clears caches, tells designer to rerun start

Both reuse existing infrastructure (find-config, messages, clack) and slot into the existing `cli.ts` dispatcher. Master doc §15 Prompts 6 + 7 cover the surface; this spec pins the open decisions.

## Decisions

| Decision | Choice |
|---|---|
| `reset` behaviour | One-shot cleanup. Kills :8081 + :3001, deletes `.expo/` and `node_modules/.cache`, prints success message. Designer runs `proto start` again. Cleaner than auto-restart per master doc. |
| `new-screen` templates | Inline TS string functions in `packages/proto-cli/src/commands/new-screen-templates.ts`. Hardcoded, no fs reads. Matches master doc §15 Prompt 6's "templates to support (hardcoded, not files)". |
| Name normalisation | `proto new-screen "my profile"` → PascalCase to `MyProfile`. Strip non-alpha-num. If result is empty, friendly error. |
| Existing screen collision | If `screens/<Name>.tsx` already exists, abort with: "A screen named '<Name>' already exists. Pick a different name or delete it first." No overwrite prompt. |
| Reset in non-Proto dir | If `proto.config.js` missing, same friendly error as `start`: "Run this inside a Proto project." |
| Process killing | Use `lsof -ti:<port>` to find PIDs, then `kill <pid>`. macOS and Linux compatible. Windows deferred (master doc §16 risk). |
| Cache clearing | Delete `.expo/` and `node_modules/.cache/` if they exist. Other caches (Metro's `.metro-cache/`, Babel's transform cache) added only if a real bug needs them. |
| Tests | TDD per CLAUDE.md for: pascal-case helper, template renderer, kill-port wrapper (injectable), cache-clear wrapper (injectable), messages jargon audit additions. Orchestrators are not unit-tested. |

## Module additions

```
packages/proto-cli/src/
├── messages.ts                          (modify — add new strings)
├── messages.test.ts                     (modify — existing audit covers the new strings)
├── pascal-case.ts                       (NEW)
├── pascal-case.test.ts                  (NEW)
├── kill-port.ts                         (NEW — injectable spawn)
├── kill-port.test.ts                    (NEW)
├── clear-caches.ts                      (NEW — injectable fs)
├── clear-caches.test.ts                 (NEW)
├── cli.ts                               (modify — add new-screen + reset to dispatcher)
└── commands/
    ├── new-screen.ts                    (NEW)
    ├── new-screen-templates.ts          (NEW — 5 inline templates)
    ├── new-screen-templates.test.ts     (NEW — template renderer + name substitution)
    └── reset.ts                         (NEW)
```

## Module contracts

### `pascal-case.ts`

```ts
export function toPascalCase(input: string): { ok: true; name: string } | { ok: false };
```

Rules:
- Trim, split on non-alphanum, capitalise each part, concat.
- Must start with a letter after normalisation. Reject if the first character is a digit.
- Empty result → `{ ok: false }`.
- Examples: `"my profile"` → `MyProfile`. `"settings"` → `Settings`. `"todo-list"` → `TodoList`. `"123"` → `{ ok: false }`. `"1app"` → `{ ok: false }`.

### `new-screen-templates.ts`

```ts
export type TemplateName = 'empty' | 'home' | 'list' | 'detail' | 'form' | 'modal';

export function renderTemplate(template: TemplateName, screenName: string): string;
```

Each branch returns a self-contained `.tsx` source string. The `screenName` token is substituted into:
- the `default function` name
- the `<Screen title="...">` prop

Templates (designer-facing copy in template content kept friendly, no jargon):

**empty:**

```tsx
import { Screen, Stack, Text } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
      <Stack gap={16}>
        <Text size="headline">{{name}}</Text>
      </Stack>
    </Screen>
  );
}
```

**home:** large title + two `Card` components stacked.

**list:** 5 `Toggle` rows with `Divider` between each.

**detail:** glass `Card` at top + Text blocks below.

**form:** Stack of placeholder Card "inputs" (no real text input wiring yet — Phase 2 work) + a primary `Button`.

**modal:** wraps a `Modal` with title + two Buttons.

Each is a literal string with `{{name}}` token, rendered via `replaceAll`. The test verifies:
- Each template type produces non-empty output
- `{{name}}` is substituted everywhere
- Output references only Proto components (no raw RN)

### `commands/new-screen.ts`

```ts
export type NewScreenOptions = {
  rawName: string;
  template: TemplateName;  // defaults to 'empty'
};
export async function runNewScreen(options: NewScreenOptions): Promise<void>;
```

Flow:
1. `findConfig(process.cwd())` — abort with friendly error if missing.
2. `toPascalCase(rawName)` — abort if invalid.
3. Compute target: `<configRoot>/screens/<Name>.tsx`.
4. If target exists → abort with collision message.
5. Render template via `renderTemplate(template, Name)`.
6. Write file. Print: `<Name> screen created → it's live on your device`.

### `kill-port.ts`

```ts
export type KillPortFn = (port: number) => Promise<{ killed: number }>;

export type KillPortDeps = {
  exec?: (cmd: string, args: string[]) => Promise<{ stdout: string; code: number | null }>;
};

export function makeKillPort(deps?: KillPortDeps): KillPortFn;
```

Uses `spawn('lsof', ['-ti', ':<port>'])` to list PIDs, then `spawn('kill', [pid])`. `exec` is injectable for testing. Returns count of processes killed. Silent on "no process" (kill 0 returned).

### `clear-caches.ts`

```ts
export type ClearCachesDeps = {
  fs?: { rm: (path: string, opts: { recursive: true; force: true }) => Promise<void>; exists: (path: string) => boolean };
};

export async function clearCaches(projectRoot: string, deps?: ClearCachesDeps): Promise<{ cleared: string[] }>;
```

Deletes (if present):
- `<projectRoot>/.expo/`
- `<projectRoot>/node_modules/.cache/`

Returns the list of directories that were actually present and cleared (for the spinner copy).

### `commands/reset.ts`

```ts
export async function runReset(): Promise<void>;
```

Flow:
1. `findConfig(process.cwd())` — abort if missing.
2. Spinner: "Resetting Proto…"
3. Call `makeKillPort()`(8081), then (3001). Silent on no-op.
4. Call `clearCaches(configRoot)`.
5. Spinner stops with: "Proto reset. Run: proto start"

### `cli.ts` dispatcher update

Add two branches:

```ts
if (command === 'new-screen') {
  const rawName = argv[3] ?? '';
  const flags = argv.slice(4);
  const templateFlagIdx = flags.indexOf('--template');
  const template = (templateFlagIdx >= 0 ? flags[templateFlagIdx + 1] : 'empty') as TemplateName;
  await runNewScreen({ rawName, template });
  return;
}

if (command === 'reset') {
  await runReset();
  return;
}
```

## New messages added to `messages.ts`

```ts
{
  // existing keys ...
  noScreenName: 'Give your screen a name. Like: proto new-screen Profile',
  invalidScreenName: 'That name has characters that cause trouble. Use letters and hyphens.',
  screenExists: (name: string) => `A screen named "${name}" already exists. Pick a different name or delete it first.`,
  screenCreated: (name: string) => `${name} screen created → it's live on your device`,
  resetting: 'Resetting Proto',
  resetDone: 'Proto reset. Run: proto start',
}
```

The existing jargon-audit test in `messages.test.ts` covers these automatically because it iterates `Object.values(messages)`.

## Acceptance

1. `pnpm --filter proto-cli test` passes (existing 31 + new tests).
2. `pnpm --filter proto-cli typecheck` passes.
3. `pnpm --filter proto-cli build` passes.
4. `node dist/index.js new-screen Profile` in a scaffolded project: creates `screens/Profile.tsx` with the empty template and the right name interpolated. Prints the success message.
5. `node dist/index.js new-screen Profile --template list`: same file location, but uses the list template.
6. Running `new-screen` outside a Proto project surfaces the friendly no-config error.
7. Running `new-screen` for an existing screen surfaces the friendly collision error.
8. `node dist/index.js reset` in a scaffolded project: spinner shows, cleanup happens, success message prints.
9. `messages.ts` continues to pass the jargon audit.

## Out of scope

- Other future commands (`add`, `edit`, `remove`, `snapshot`, `share`) — Phase 2+.
- Windows-compatible port killing (master doc §16 risk).
- Restoring screens deleted via `reset` (reset doesn't touch screens).
- Real text-input wiring inside the `form` template (Phase 2 — for now it renders `Card`-styled placeholders).
- End-to-end QR run (still deferred to first real device run).
