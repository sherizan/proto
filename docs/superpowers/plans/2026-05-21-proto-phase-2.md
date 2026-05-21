# Proto Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every new Proto project ship with `DESIGN.md` and `CLAUDE.md` at its root so Claude Code becomes the prompt interface for the design system, and add a `proto design` CLI command that (re)generates `DESIGN.md` interactively.

**Architecture:** Two templated docs are added to `packages/create-proto/template/` and copied into new projects with `{{APP_NAME}}` / `{{DATE}}` substituted. `copy-template.ts` is extended to support a placeholder map (not just `{{name}}`) and to stop skipping `.gitkeep`. A new `proto design` command — built in two pure modules (`design-template.ts` for markdown assembly, `design-libraries.ts` for the library catalog) plus an interactive `design.ts` orchestrator — collects theme / accent / library / app name via `@clack/prompts`, optionally `pnpm add`s the library, and writes `DESIGN.md` to project root. Phase 1 component runtime is **not** touched; "Base" exists only in `DESIGN.md`.

**Tech Stack:** TypeScript ESM, pnpm workspaces, `@clack/prompts`, `vitest`, Node `child_process.spawn`. No new dependencies.

---

## Spec-derived design decisions (locked before tasks)

1. **`proto design` does not modify `proto.config.js`.** Phase 2 prompt Deliverable 3 says only "Write DESIGN.md to project root." Runtime theme/accent stay where they are; `DESIGN.md` is for the designer + Claude Code. (Phase 1 runtime is frozen per CLAUDE.md §6.)
2. **"Base" theme is docs-only.** `proto-components` exposes `liquidGlass` and `materialYou` runtime themes; no `base.ts` exists. Phase 2 prompt §"What does not change" mentions a `base.ts` that doesn't actually exist — we treat that as docs-only and do not create a runtime theme. The Base preset lives entirely inside `design-template.ts`.
3. **Substitution stays backward-compatible.** `copy-template.ts` already substitutes `{{name}}` (template `package.json`, `proto.config.js`). New `{{APP_NAME}}` and `{{DATE}}` placeholders are added via a generic substitutions map; existing `{{name}}` behaviour is preserved by the same map.
4. **`.gitkeep` is now preserved on copy.** Required so `components/shared/.gitkeep` lands at project root. The existing skip is removed; the related test is updated.
5. **`proto design` requires being inside a Proto project** (uses `findConfig`, consistent with `new-screen`/`reset`). **`proto design update` does not** — it is a print-only one-liner.
6. **Unknown / "Custom" libraries do not auto-install.** We print the install command for the designer to forward to Claude Code; only the four known libraries are auto-installed.

---

## File structure

**Create (Phase 2 net-new):**

| File | Responsibility |
|---|---|
| `packages/create-proto/template/DESIGN.md` | Design-system source-of-truth template. Liquid Glass defaults verbatim from spec; `{{APP_NAME}}` / `{{DATE}}` substituted at scaffold. |
| `packages/create-proto/template/CLAUDE.md` | Proto-awareness instructions for Claude Code. Verbatim from spec, no substitutions. |
| `packages/create-proto/template/components/shared/.gitkeep` | Empty marker so the empty folder lands in scaffolded projects. |
| `packages/proto-cli/src/commands/design-template.ts` | Pure: turns inputs (`theme`, `accent`, `appName`, `library`) into the final DESIGN.md markdown string. |
| `packages/proto-cli/src/commands/design-template.test.ts` | Unit tests for the three theme presets, accent override, and library section. |
| `packages/proto-cli/src/commands/design-libraries.ts` | Pure: known-library catalog + `installCommandFor(library)` resolver. |
| `packages/proto-cli/src/commands/design-libraries.test.ts` | Unit tests for catalog lookup and install command resolution. |
| `packages/proto-cli/src/commands/design.ts` | Interactive orchestrator (clack prompts → optional `pnpm add` → write file). |

**Modify:**

| File | Change |
|---|---|
| `packages/create-proto/src/copy-template.ts` | Accept `substitutions: Record<string, string>`; replace all `{{KEY}}` matches; stop skipping `.gitkeep`. Keep `projectName` field — it is folded into the substitutions map for back-compat. |
| `packages/create-proto/src/copy-template.test.ts` | Update tests: `.gitkeep` is now copied; new substitutions pass through; `{{name}}` still works. |
| `packages/create-proto/src/cli.ts` | Pass `{ '{{name}}': name, '{{APP_NAME}}': name, '{{DATE}}': YYYY-MM-DD }` into `copyTemplate`. |
| `packages/proto-cli/src/cli.ts` | Add `design` and `design update` command branches. |
| `packages/proto-cli/src/messages.ts` | Add design-related designer-facing strings. |

---

## Task 1: Add the two template docs and the components/shared folder

**Files:**
- Create: `packages/create-proto/template/DESIGN.md`
- Create: `packages/create-proto/template/CLAUDE.md`
- Create: `packages/create-proto/template/components/shared/.gitkeep`

- [ ] **Step 1: Create `DESIGN.md` in the template**

Write exactly this content to `packages/create-proto/template/DESIGN.md`:

```markdown
# DESIGN.md
> Source of truth for {{APP_NAME}}'s design system.
> Update by prompting Claude Code: "update DESIGN.md, [what to change]"
> Last updated: {{DATE}}

## App
- Name: {{APP_NAME}}
- Theme: liquidGlass
- Platform: iOS

## Component Library
- Package: proto (built-in)
- Import from: ../components/proto
- Fallback: proto

## Colour
- Accent: #007AFF
- Surface primary: rgba(255,255,255,0.72)
- Surface secondary: rgba(255,255,255,0.48)
- Surface card: rgba(255,255,255,0.60)
- Surface nav: rgba(255,255,255,0.82)
- Text primary: #000000
- Text secondary: rgba(0,0,0,0.5)
- Text tertiary: rgba(0,0,0,0.3)
- Destructive: #FF3B30

## Typography
- Title: 34px / bold / tracking -0.4
- Headline: 22px / semibold / tracking -0.4
- Body: 17px / regular
- Caption: 12px / regular / text-secondary
- Label: 13px / medium

## Spacing
- xs: 4 / sm: 8 / md: 16 / lg: 24 / xl: 32

## Shape
- Card radius: 22
- Button radius: 14
- Modal radius: 44
- Input radius: 12

## Effects
- Card blur: 20
- Nav blur: 40
- Modal blur: 60
- Border: rgba(255,255,255,0.4)

## Components in use
- Screen, Stack, Row, Text, Card, Button, Toggle, Nav, Modal, Divider

## Screens
- Home (initial) — starter screen
```

- [ ] **Step 2: Create `CLAUDE.md` in the template**

Write exactly this content to `packages/create-proto/template/CLAUDE.md`:

```markdown
# Proto Project — Claude Code Instructions

You are working inside a Proto project. Proto is a prompt-native design environment for building native iOS prototypes. Follow these rules exactly.

## Your role
You are the design tool. The iOS Simulator is the canvas. Your job is to generate native screens and components that the designer describes in plain language, using the design system defined in DESIGN.md.

## Before every task
1. Read DESIGN.md — this is the design system. All tokens come from here.
2. Read the Component Library section of DESIGN.md — this tells you which library to import from and what the import path is.
3. Check /screens/ to understand what screens already exist.
4. Check /components/proto/index.ts to see what Proto fallback components are available.

## Component library
- Read the Component Library section of DESIGN.md before generating any screen
- If a library is specified (e.g. Tamagui, Gluestack): import from that library using its correct package name and import paths
- Use that library's component names, props, and patterns exactly as documented
- If a specific component doesn't exist in the specified library, fall back to Proto primitives from '../components/proto' — never use raw React Native
- If Package is "proto" or no library is specified: use Proto primitives only
- Never import directly from 'react-native' regardless of library choice

## Writing screens
- All new screens go in /screens/<ScreenName>.tsx
- Screen names are always PascalCase (e.g. Settings, UserProfile, OrderDetail)
- Always export a default function matching the screen name exactly
- Never add TypeScript interfaces, types, or type annotations in screen files
- Never add comments to generated screen files
- Never hardcode colour, spacing, radius, or typography values — always use token values from DESIGN.md

## Available Proto fallback components
Import from '../components/proto' when the specified library doesn't cover a need:

Screen       — base wrapper. Props: title (string), scrollable (bool)
Stack        — vertical layout. Props: gap (number), padding (number)
Row          — horizontal layout. Props: gap (number), align ('start'|'center'|'end')
Text         — typography. Props: size ('title'|'headline'|'body'|'caption'|'label'), color ('primary'|'secondary'|'accent'|'destructive')
Card         — surface container. Props: glass (bool), padding (number)
Button       — action. Props: label (string), variant ('primary'|'secondary'|'ghost'|'destructive'), onPress
Toggle       — switch. Props: label (string), value (bool), onChange
Divider      — separator. No props.
Nav          — bottom nav. Props: tabs ([{ icon, label, screen }])
Modal        — bottom sheet. Props: title (string), visible (bool)

## Writing shared components
- Shared components go in /components/shared/<ComponentName>.tsx
- Same library rules apply — use specified library, fall back to Proto
- When a shared component is created, update all screens that use it

## Modifying existing screens
- Always rewrite the full file — never partial edits or diffs
- Read the current file first, then rewrite with the change applied

## After adding a new screen
- Add the screen name and a one-line description to the Screens section of DESIGN.md

## Updating the design system
- When the designer asks to update colour, spacing, typography, or shape: update DESIGN.md with the new values
- When the designer asks to change the component library: update the Component Library section of DESIGN.md with the new package and import path
- If asked to regenerate screens after a design system or library update: rewrite the affected screen files using the updated DESIGN.md values

## Never do these things
- Never import directly from 'react-native' — always use the specified library or Proto fallback
- Never create new components outside /screens/ or /components/shared/
- Never edit files in /components/proto/ — this is the Proto component library
- Never edit files in .proto/ — this is managed by the Proto CLI
- Never add a build step, a config change, or a dependency
- Never suggest the designer open a file or edit code manually
- Never add a point-and-click or visual editing interface
- All interaction is prompts only
```

- [ ] **Step 3: Create the empty `components/shared/` folder marker**

Create `packages/create-proto/template/components/shared/.gitkeep` (empty file).

- [ ] **Step 4: Verify the three files exist**

Run: `ls packages/create-proto/template/DESIGN.md packages/create-proto/template/CLAUDE.md packages/create-proto/template/components/shared/.gitkeep`
Expected: all three paths listed without error.

- [ ] **Step 5: Commit**

```bash
git add packages/create-proto/template/DESIGN.md packages/create-proto/template/CLAUDE.md packages/create-proto/template/components/shared/.gitkeep
git commit -m "feat(create-proto): add DESIGN.md and CLAUDE.md templates"
```

---

## Task 2: Extend `copy-template.ts` for multi-placeholder substitution and `.gitkeep` preservation

**Files:**
- Modify: `packages/create-proto/src/copy-template.ts`
- Modify: `packages/create-proto/src/copy-template.test.ts`

- [ ] **Step 1: Write failing tests for the new behaviour**

Replace the contents of `packages/create-proto/src/copy-template.test.ts` with:

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { copyTemplate } from './copy-template';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpRoot: string;
let templateRoot: string;
let destRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-copy-test-'));
  templateRoot = path.join(tmpRoot, 'template');
  destRoot = path.join(tmpRoot, 'dest');
  fs.mkdirSync(path.join(templateRoot, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, 'config.js'), `export default { name: '{{name}}' };`);
  fs.writeFileSync(
    path.join(templateRoot, 'DESIGN.md'),
    `# {{APP_NAME}}\nLast updated: {{DATE}}`,
  );
  fs.writeFileSync(path.join(templateRoot, 'plain.txt'), `Hello {{name}}, line one.\nLine 2.`);
  fs.writeFileSync(path.join(templateRoot, 'sub', '.gitkeep'), '');
  fs.writeFileSync(path.join(templateRoot, 'binary.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('copyTemplate', () => {
  it('copies the template tree into dest', async () => {
    await copyTemplate({ templateRoot, destRoot, projectName: 'demo' });
    expect(fs.existsSync(path.join(destRoot, 'config.js'))).toBe(true);
    expect(fs.existsSync(path.join(destRoot, 'plain.txt'))).toBe(true);
    expect(fs.existsSync(path.join(destRoot, 'binary.png'))).toBe(true);
  });

  it('substitutes {{name}} from projectName for back-compat', async () => {
    await copyTemplate({ templateRoot, destRoot, projectName: 'demo' });
    const config = fs.readFileSync(path.join(destRoot, 'config.js'), 'utf8');
    expect(config).toContain("'demo'");
    expect(config).not.toContain('{{name}}');
  });

  it('substitutes extra placeholders from substitutions map', async () => {
    await copyTemplate({
      templateRoot,
      destRoot,
      projectName: 'demo',
      substitutions: { '{{APP_NAME}}': 'Demo', '{{DATE}}': '2026-05-21' },
    });
    const design = fs.readFileSync(path.join(destRoot, 'DESIGN.md'), 'utf8');
    expect(design).toContain('# Demo');
    expect(design).toContain('Last updated: 2026-05-21');
    expect(design).not.toContain('{{APP_NAME}}');
    expect(design).not.toContain('{{DATE}}');
  });

  it('preserves .gitkeep files (no longer skipped)', async () => {
    await copyTemplate({ templateRoot, destRoot, projectName: 'demo' });
    expect(fs.existsSync(path.join(destRoot, 'sub', '.gitkeep'))).toBe(true);
  });

  it('preserves binary files byte-for-byte', async () => {
    await copyTemplate({ templateRoot, destRoot, projectName: 'demo' });
    const original = fs.readFileSync(path.join(templateRoot, 'binary.png'));
    const copied = fs.readFileSync(path.join(destRoot, 'binary.png'));
    expect(copied.equals(original)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter create-proto test`
Expected: failures in the substitutions, `.gitkeep`, and (depending on test order) the existing tests should still pass except `substitutes extra placeholders` and `preserves .gitkeep` fail.

- [ ] **Step 3: Update `copy-template.ts`**

Replace the contents of `packages/create-proto/src/copy-template.ts` with:

```typescript
import fs from 'node:fs';
import path from 'node:path';

export type CopyOptions = {
  templateRoot: string;
  destRoot: string;
  projectName: string;
  substitutions?: Record<string, string>;
};

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.txt',
  '.html',
]);

export async function copyTemplate(options: CopyOptions): Promise<void> {
  const { templateRoot, destRoot, projectName, substitutions } = options;
  const map = { '{{name}}': projectName, ...(substitutions ?? {}) };
  await walk(templateRoot, destRoot, map);
}

async function walk(
  srcDir: string,
  destDir: string,
  substitutions: Record<string, string>,
): Promise<void> {
  await fs.promises.mkdir(destDir, { recursive: true });
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await walk(srcPath, destPath, substitutions);
      continue;
    }
    const ext = path.extname(entry.name);
    if (TEXT_EXTENSIONS.has(ext)) {
      const text = await fs.promises.readFile(srcPath, 'utf8');
      const replaced = applySubstitutions(text, substitutions);
      await fs.promises.writeFile(destPath, replaced, 'utf8');
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

function applySubstitutions(text: string, substitutions: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(substitutions)) {
    out = out.split(key).join(value);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter create-proto test`
Expected: all `copyTemplate` tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/create-proto/src/copy-template.ts packages/create-proto/src/copy-template.test.ts
git commit -m "feat(create-proto): support extra placeholders, preserve .gitkeep"
```

---

## Task 3: Pass `{{APP_NAME}}` and `{{DATE}}` substitutions from `create-proto` CLI

**Files:**
- Modify: `packages/create-proto/src/cli.ts:43-46`

- [ ] **Step 1: Update the `copyTemplate` invocation**

In `packages/create-proto/src/cli.ts`, replace the existing `copyTemplate` call (after `s.start(messages.settingUp);`) with:

```typescript
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
```

- [ ] **Step 2: Build create-proto to confirm types still check**

Run: `pnpm --filter create-proto build`
Expected: clean build, no TS errors.

- [ ] **Step 3: Smoke-scaffold into a tmp directory**

Run:
```bash
cd /tmp && rm -rf phase2-smoke && node /Users/sherizan/Public/proto/packages/create-proto/dist/index.js phase2-smoke <<< 'phase2-smoke' || true
```
Then:
```bash
ls /tmp/phase2-smoke
cat /tmp/phase2-smoke/DESIGN.md | head -6
ls /tmp/phase2-smoke/components/shared
```
Expected: `DESIGN.md` and `CLAUDE.md` at root; `DESIGN.md` shows `Source of truth for phase2-smoke's design system.` and a real `Last updated: 2026-MM-DD`; `components/shared/.gitkeep` present.

> If the interactive prompt blocks the smoke run, skip the run-time smoke here; Task 8 covers full end-to-end verification via `npm create proto@latest`.

- [ ] **Step 4: Commit**

```bash
git add packages/create-proto/src/cli.ts
git commit -m "feat(create-proto): substitute APP_NAME and DATE at scaffold"
```

---

## Task 4: Pure module — `design-libraries.ts`

**Files:**
- Create: `packages/proto-cli/src/commands/design-libraries.ts`
- Create: `packages/proto-cli/src/commands/design-libraries.test.ts`

- [ ] **Step 1: Write failing tests**

Write `packages/proto-cli/src/commands/design-libraries.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  LIBRARY_IDS,
  getLibrary,
  resolveCustomLibrary,
  type LibraryDescriptor,
} from './design-libraries.js';

describe('design-libraries', () => {
  it('exposes all known library ids in declaration order', () => {
    expect(LIBRARY_IDS).toEqual([
      'proto',
      'tamagui',
      'gluestack',
      'react-native-paper',
      'nativewind',
      'custom',
    ]);
  });

  it('returns descriptor for built-in proto', () => {
    const lib = getLibrary('proto') as LibraryDescriptor;
    expect(lib.kind).toBe('builtin');
    expect(lib.designPackage).toBe('proto (built-in)');
    expect(lib.importFrom).toBe('../components/proto');
    expect(lib.installPackage).toBeNull();
  });

  it('returns descriptor for tamagui with install package', () => {
    const lib = getLibrary('tamagui') as LibraryDescriptor;
    expect(lib.kind).toBe('known');
    expect(lib.installPackage).toBe('@tamagui/core');
    expect(lib.importFrom).toBe('@tamagui/core');
    expect(lib.docs).toBe('https://tamagui.dev/docs/components');
    expect(lib.fallback).toBe('proto');
  });

  it('returns descriptor for gluestack', () => {
    const lib = getLibrary('gluestack') as LibraryDescriptor;
    expect(lib.installPackage).toBe('@gluestack-ui/themed');
    expect(lib.docs).toBe('https://ui.gluestack.io/docs');
  });

  it('returns descriptor for react-native-paper', () => {
    const lib = getLibrary('react-native-paper') as LibraryDescriptor;
    expect(lib.installPackage).toBe('react-native-paper');
    expect(lib.docs).toBe('https://callstack.github.io/react-native-paper');
  });

  it('returns descriptor for nativewind', () => {
    const lib = getLibrary('nativewind') as LibraryDescriptor;
    expect(lib.installPackage).toBe('nativewind');
    expect(lib.docs).toBe('https://www.nativewind.dev/docs');
  });

  it('resolves custom library from a package name', () => {
    const lib = resolveCustomLibrary({ packageName: '@acme/ui', docs: 'https://acme.dev' });
    expect(lib.kind).toBe('custom');
    expect(lib.installPackage).toBe('@acme/ui');
    expect(lib.importFrom).toBe('@acme/ui');
    expect(lib.designPackage).toBe('@acme/ui');
    expect(lib.docs).toBe('https://acme.dev');
    expect(lib.fallback).toBe('proto');
  });

  it('omits docs line when not provided for custom', () => {
    const lib = resolveCustomLibrary({ packageName: '@acme/ui' });
    expect(lib.docs).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `pnpm --filter proto-cli test -- --run design-libraries`
Expected: module-not-found error.

- [ ] **Step 3: Implement `design-libraries.ts`**

Write `packages/proto-cli/src/commands/design-libraries.ts`:

```typescript
export type LibraryId =
  | 'proto'
  | 'tamagui'
  | 'gluestack'
  | 'react-native-paper'
  | 'nativewind'
  | 'custom';

export const LIBRARY_IDS: LibraryId[] = [
  'proto',
  'tamagui',
  'gluestack',
  'react-native-paper',
  'nativewind',
  'custom',
];

export type LibraryDescriptor = {
  kind: 'builtin' | 'known' | 'custom';
  label: string;
  designPackage: string;
  importFrom: string;
  installPackage: string | null;
  docs?: string;
  fallback: 'proto';
};

const KNOWN: Record<Exclude<LibraryId, 'custom'>, LibraryDescriptor> = {
  proto: {
    kind: 'builtin',
    label: 'Proto (built-in)',
    designPackage: 'proto (built-in)',
    importFrom: '../components/proto',
    installPackage: null,
    fallback: 'proto',
  },
  tamagui: {
    kind: 'known',
    label: 'Tamagui',
    designPackage: '@tamagui/core',
    importFrom: '@tamagui/core',
    installPackage: '@tamagui/core',
    docs: 'https://tamagui.dev/docs/components',
    fallback: 'proto',
  },
  gluestack: {
    kind: 'known',
    label: 'Gluestack UI',
    designPackage: '@gluestack-ui/themed',
    importFrom: '@gluestack-ui/themed',
    installPackage: '@gluestack-ui/themed',
    docs: 'https://ui.gluestack.io/docs',
    fallback: 'proto',
  },
  'react-native-paper': {
    kind: 'known',
    label: 'React Native Paper',
    designPackage: 'react-native-paper',
    importFrom: 'react-native-paper',
    installPackage: 'react-native-paper',
    docs: 'https://callstack.github.io/react-native-paper',
    fallback: 'proto',
  },
  nativewind: {
    kind: 'known',
    label: 'NativeWind',
    designPackage: 'nativewind',
    importFrom: 'nativewind',
    installPackage: 'nativewind',
    docs: 'https://www.nativewind.dev/docs',
    fallback: 'proto',
  },
};

export function getLibrary(id: Exclude<LibraryId, 'custom'>): LibraryDescriptor {
  return KNOWN[id];
}

export type CustomLibraryInput = {
  packageName: string;
  docs?: string;
};

export function resolveCustomLibrary(input: CustomLibraryInput): LibraryDescriptor {
  return {
    kind: 'custom',
    label: input.packageName,
    designPackage: input.packageName,
    importFrom: input.packageName,
    installPackage: input.packageName,
    docs: input.docs,
    fallback: 'proto',
  };
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `pnpm --filter proto-cli test -- --run design-libraries`
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/commands/design-libraries.ts packages/proto-cli/src/commands/design-libraries.test.ts
git commit -m "feat(proto-cli): library catalog for design command"
```

---

## Task 5: Pure module — `design-template.ts`

**Files:**
- Create: `packages/proto-cli/src/commands/design-template.ts`
- Create: `packages/proto-cli/src/commands/design-template.test.ts`

- [ ] **Step 1: Write failing tests**

Write `packages/proto-cli/src/commands/design-template.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { renderDesignDoc, type DesignInputs } from './design-template.js';
import { getLibrary, resolveCustomLibrary } from './design-libraries.js';

function baseInputs(): DesignInputs {
  return {
    appName: 'Acme',
    theme: 'liquidGlass',
    accent: '#007AFF',
    library: getLibrary('proto'),
    date: '2026-05-21',
  };
}

describe('renderDesignDoc — liquidGlass', () => {
  it('renders the app header, theme, and date', () => {
    const md = renderDesignDoc(baseInputs());
    expect(md).toContain(`Source of truth for Acme's design system.`);
    expect(md).toContain('Last updated: 2026-05-21');
    expect(md).toContain('- Name: Acme');
    expect(md).toContain('- Theme: liquidGlass');
    expect(md).toContain('- Platform: iOS');
  });

  it('uses the liquid-glass colour and effect defaults', () => {
    const md = renderDesignDoc(baseInputs());
    expect(md).toContain('- Accent: #007AFF');
    expect(md).toContain('- Surface primary: rgba(255,255,255,0.72)');
    expect(md).toContain('- Card blur: 20');
    expect(md).toContain('- Nav blur: 40');
    expect(md).toContain('- Modal blur: 60');
  });

  it('honours an accent override', () => {
    const md = renderDesignDoc({ ...baseInputs(), accent: '#FF2D55' });
    expect(md).toContain('- Accent: #FF2D55');
    expect(md).not.toContain('- Accent: #007AFF');
  });
});

describe('renderDesignDoc — materialYou', () => {
  it('renders Material You surface, text, and shape defaults', () => {
    const md = renderDesignDoc({
      ...baseInputs(),
      theme: 'materialYou',
      accent: '#6750A4',
    });
    expect(md).toContain('- Theme: materialYou');
    expect(md).toContain('- Accent: #6750A4');
    expect(md).toContain('- Surface primary: #FFFBFE');
    expect(md).toContain('- Text primary: #1C1B1F');
    expect(md).toContain('- Card radius: 12');
    expect(md).toContain('- Button radius: 20');
    expect(md).toContain('- Card blur: 0');
  });
});

describe('renderDesignDoc — base', () => {
  it('renders flat surfaces and no blur', () => {
    const md = renderDesignDoc({
      ...baseInputs(),
      theme: 'base',
      accent: '#000000',
    });
    expect(md).toContain('- Theme: base');
    expect(md).toContain('- Accent: #000000');
    expect(md).toContain('- Surface primary: #FFFFFF');
    expect(md).toContain('- Card blur: 0');
    expect(md).toContain('- Nav blur: 0');
  });
});

describe('renderDesignDoc — component library section', () => {
  it('writes the built-in Proto library section', () => {
    const md = renderDesignDoc(baseInputs());
    expect(md).toContain('## Component Library');
    expect(md).toContain('- Package: proto (built-in)');
    expect(md).toContain('- Import from: ../components/proto');
    expect(md).toContain('- Fallback: proto');
    expect(md).not.toMatch(/^- Docs:/m);
  });

  it('writes Tamagui docs and import path', () => {
    const md = renderDesignDoc({ ...baseInputs(), library: getLibrary('tamagui') });
    expect(md).toContain('- Package: @tamagui/core');
    expect(md).toContain('- Import from: @tamagui/core');
    expect(md).toContain('- Docs: https://tamagui.dev/docs/components');
    expect(md).toContain('- Fallback: proto');
  });

  it('writes a custom library with optional docs', () => {
    const md = renderDesignDoc({
      ...baseInputs(),
      library: resolveCustomLibrary({ packageName: '@acme/ui', docs: 'https://acme.dev' }),
    });
    expect(md).toContain('- Package: @acme/ui');
    expect(md).toContain('- Import from: @acme/ui');
    expect(md).toContain('- Docs: https://acme.dev');
  });

  it('omits the docs line when a custom library has no docs', () => {
    const md = renderDesignDoc({
      ...baseInputs(),
      library: resolveCustomLibrary({ packageName: '@acme/ui' }),
    });
    expect(md).toContain('- Package: @acme/ui');
    expect(md).not.toMatch(/^- Docs:/m);
  });
});

describe('renderDesignDoc — invariant sections', () => {
  it('always includes typography, spacing, shape, components and screens sections', () => {
    const md = renderDesignDoc(baseInputs());
    expect(md).toContain('## Typography');
    expect(md).toContain('- Title: 34px / bold / tracking -0.4');
    expect(md).toContain('## Spacing');
    expect(md).toContain('- xs: 4 / sm: 8 / md: 16 / lg: 24 / xl: 32');
    expect(md).toContain('## Shape');
    expect(md).toContain('## Effects');
    expect(md).toContain('## Components in use');
    expect(md).toContain('- Screen, Stack, Row, Text, Card, Button, Toggle, Nav, Modal, Divider');
    expect(md).toContain('## Screens');
    expect(md).toContain('- Home (initial) — starter screen');
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `pnpm --filter proto-cli test -- --run design-template`
Expected: module-not-found.

- [ ] **Step 3: Implement `design-template.ts`**

Write `packages/proto-cli/src/commands/design-template.ts`:

```typescript
import type { LibraryDescriptor } from './design-libraries.js';

export type ThemeName = 'liquidGlass' | 'materialYou' | 'base';

export type DesignInputs = {
  appName: string;
  theme: ThemeName;
  accent: string;
  library: LibraryDescriptor;
  date: string;
};

type ThemePreset = {
  surface: { primary: string; secondary: string; card: string; nav: string };
  text: { primary: string; secondary: string; tertiary: string; destructive: string };
  shape: { card: number; button: number; modal: number; input: number };
  effects: { cardBlur: number; navBlur: number; modalBlur: number; border: string };
};

const PRESETS: Record<ThemeName, ThemePreset> = {
  liquidGlass: {
    surface: {
      primary: 'rgba(255,255,255,0.72)',
      secondary: 'rgba(255,255,255,0.48)',
      card: 'rgba(255,255,255,0.60)',
      nav: 'rgba(255,255,255,0.82)',
    },
    text: {
      primary: '#000000',
      secondary: 'rgba(0,0,0,0.5)',
      tertiary: 'rgba(0,0,0,0.3)',
      destructive: '#FF3B30',
    },
    shape: { card: 22, button: 14, modal: 44, input: 12 },
    effects: { cardBlur: 20, navBlur: 40, modalBlur: 60, border: 'rgba(255,255,255,0.4)' },
  },
  materialYou: {
    surface: {
      primary: '#FFFBFE',
      secondary: '#E6E1E5',
      card: '#F4EFF4',
      nav: '#FFFBFE',
    },
    text: {
      primary: '#1C1B1F',
      secondary: '#49454F',
      tertiary: '#79747E',
      destructive: '#B3261E',
    },
    shape: { card: 12, button: 20, modal: 28, input: 8 },
    effects: { cardBlur: 0, navBlur: 0, modalBlur: 0, border: '#CAC4D0' },
  },
  base: {
    surface: {
      primary: '#FFFFFF',
      secondary: '#F2F2F7',
      card: '#FFFFFF',
      nav: '#FFFFFF',
    },
    text: {
      primary: '#000000',
      secondary: 'rgba(0,0,0,0.6)',
      tertiary: 'rgba(0,0,0,0.4)',
      destructive: '#D70015',
    },
    shape: { card: 12, button: 10, modal: 24, input: 8 },
    effects: { cardBlur: 0, navBlur: 0, modalBlur: 0, border: 'rgba(0,0,0,0.1)' },
  },
};

export function renderDesignDoc(inputs: DesignInputs): string {
  const p = PRESETS[inputs.theme];
  const lib = inputs.library;
  const libLines = [
    `- Package: ${lib.designPackage}`,
    `- Import from: ${lib.importFrom}`,
    ...(lib.docs ? [`- Docs: ${lib.docs}`] : []),
    `- Fallback: ${lib.fallback}`,
  ].join('\n');

  return `# DESIGN.md
> Source of truth for ${inputs.appName}'s design system.
> Update by prompting Claude Code: "update DESIGN.md, [what to change]"
> Last updated: ${inputs.date}

## App
- Name: ${inputs.appName}
- Theme: ${inputs.theme}
- Platform: iOS

## Component Library
${libLines}

## Colour
- Accent: ${inputs.accent}
- Surface primary: ${p.surface.primary}
- Surface secondary: ${p.surface.secondary}
- Surface card: ${p.surface.card}
- Surface nav: ${p.surface.nav}
- Text primary: ${p.text.primary}
- Text secondary: ${p.text.secondary}
- Text tertiary: ${p.text.tertiary}
- Destructive: ${p.text.destructive}

## Typography
- Title: 34px / bold / tracking -0.4
- Headline: 22px / semibold / tracking -0.4
- Body: 17px / regular
- Caption: 12px / regular / text-secondary
- Label: 13px / medium

## Spacing
- xs: 4 / sm: 8 / md: 16 / lg: 24 / xl: 32

## Shape
- Card radius: ${p.shape.card}
- Button radius: ${p.shape.button}
- Modal radius: ${p.shape.modal}
- Input radius: ${p.shape.input}

## Effects
- Card blur: ${p.effects.cardBlur}
- Nav blur: ${p.effects.navBlur}
- Modal blur: ${p.effects.modalBlur}
- Border: ${p.effects.border}

## Components in use
- Screen, Stack, Row, Text, Card, Button, Toggle, Nav, Modal, Divider

## Screens
- Home (initial) — starter screen
`;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `pnpm --filter proto-cli test -- --run design-template`
Expected: all 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/commands/design-template.ts packages/proto-cli/src/commands/design-template.test.ts
git commit -m "feat(proto-cli): pure DESIGN.md renderer per theme/library"
```

---

## Task 6: Interactive orchestrator — `design.ts`

**Files:**
- Create: `packages/proto-cli/src/commands/design.ts`
- Modify: `packages/proto-cli/src/messages.ts`

> No unit test for the interactive orchestrator — matches the `new-screen.ts` / `start.ts` pattern in Phase 1 (orchestrators are exercised via manual smoke). Pure logic already tested in Tasks 4–5.

- [ ] **Step 1: Add designer-facing strings**

In `packages/proto-cli/src/messages.ts`, add to the existing `messages` object (keep alphabetical-ish ordering with existing keys; the literal additions are):

```typescript
  designIntro: 'Proto',
  designThemePrompt: 'Which theme?',
  designAccentPrompt: 'Accent colour?',
  designLibraryPrompt: 'Component library?',
  designCustomPackagePrompt: 'Custom library package name?',
  designCustomDocsPrompt: 'Docs URL (optional, press enter to skip)',
  designAppNamePrompt: 'App name?',
  designOverwritePrompt: 'Update existing design system? (y/n)',
  designInstalling: 'Installing component library',
  designInstallFailed: "Couldn't install the component library. Try again, or pick Proto.",
  designCustomInstallHint: (cmd: string) =>
    `When you're ready, tell Claude Code: "install the component library with ${cmd}"`,
  designReadyTitle: 'Design system ready',
  designReadyHint:
    'Open Claude Code and start designing. Try: "add a settings screen with a dark mode toggle"',
  designUpdateHint:
    "Tell Claude Code what to change, e.g. 'update DESIGN.md, change accent to indigo'",
  designCancelled: 'Cancelled.',
```

(`messages.noConfig` already exists and is reused.)

- [ ] **Step 2: Implement `design.ts`**

Write `packages/proto-cli/src/commands/design.ts`:

```typescript
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

// Re-export for dispatch convenience; keeps the public API of this command in one place.
export { LIBRARY_IDS };
```

- [ ] **Step 3: Type-check the package**

Run: `pnpm --filter proto-cli typecheck`
Expected: clean, no TS errors.

- [ ] **Step 4: Run the full test suite to confirm nothing regressed**

Run: `pnpm --filter proto-cli test`
Expected: all tests (including Tasks 4–5) pass.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/commands/design.ts packages/proto-cli/src/messages.ts
git commit -m "feat(proto-cli): proto design interactive orchestrator"
```

---

## Task 7: Wire `proto design` and `proto design update` into the dispatcher

**Files:**
- Modify: `packages/proto-cli/src/cli.ts`

- [ ] **Step 1: Add the dispatch branches**

In `packages/proto-cli/src/cli.ts`, after the existing `reset` branch and before the unknown-command fallthrough, add:

```typescript
  if (command === 'design') {
    const sub = argv[3];
    if (sub === 'update') {
      const { runDesignUpdate } = await import('./commands/design.js');
      runDesignUpdate();
      return;
    }
    const { runDesign } = await import('./commands/design.js');
    await runDesign();
    return;
  }
```

Also add the import alongside the existing top-of-file imports (or rely on dynamic import as shown — pick whichever matches the existing style of `cli.ts`; the file currently imports commands eagerly, so prefer eager imports for consistency):

Eager-import version (preferred — matches existing file style). Change the top of `cli.ts` to add:
```typescript
import { runDesign, runDesignUpdate } from './commands/design.js';
```
…and the branch becomes:
```typescript
  if (command === 'design') {
    const sub = argv[3];
    if (sub === 'update') {
      runDesignUpdate();
      return;
    }
    await runDesign();
    return;
  }
```

- [ ] **Step 2: Build the CLI**

Run: `pnpm --filter proto-cli build`
Expected: clean build.

- [ ] **Step 3: Sanity-check unknown-command path is preserved**

Run: `node packages/proto-cli/dist/index.js bogus 2>&1 | head -3`
Expected: `Unknown command: bogus`

- [ ] **Step 4: Sanity-check `proto design update` prints the one-liner**

Run from any directory containing a `proto.config.js` *(skip this if no project handy — Task 8 covers it)*:
```bash
node packages/proto-cli/dist/index.js design update
```
Expected: prints the `designUpdateHint` text and exits cleanly. (`runDesignUpdate` does not require a project, so this also works in an empty directory.)

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/cli.ts
git commit -m "feat(proto-cli): dispatch proto design and proto design update"
```

---

## Task 8: End-to-end verification

**Files:** none modified.

- [ ] **Step 1: Build all packages**

Run: `pnpm -r build`
Expected: clean across `create-proto`, `proto-cli`, and `proto-components`.

- [ ] **Step 2: Run the full test suite**

Run: `pnpm -r test`
Expected: every package's tests pass.

- [ ] **Step 3: Scaffold a fresh project via the local build**

Run:
```bash
cd /tmp && rm -rf proto-phase2-e2e
node /Users/sherizan/Public/proto/packages/create-proto/dist/index.js proto-phase2-e2e
```
Walk through the prompts (accept defaults). When it finishes, run:
```bash
ls /tmp/proto-phase2-e2e
ls /tmp/proto-phase2-e2e/components/shared
head -10 /tmp/proto-phase2-e2e/DESIGN.md
head -5 /tmp/proto-phase2-e2e/CLAUDE.md
```
Expected:
- `DESIGN.md` and `CLAUDE.md` present at root.
- `DESIGN.md` first lines show `Source of truth for proto-phase2-e2e's design system.` and a current ISO date.
- `CLAUDE.md` starts with `# Proto Project — Claude Code Instructions`.
- `components/shared/.gitkeep` exists.

- [ ] **Step 4: Run `proto design` inside that project, pick Liquid Glass + Proto**

Run:
```bash
cd /tmp/proto-phase2-e2e
node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js design
```
Answer: Update existing → yes; theme → Liquid Glass; accent → default; library → Proto (built-in); app name → default.

Expected: terminates with `Design system ready` outro; `DESIGN.md` updated; no install happened.

- [ ] **Step 5: Run `proto design` again, pick Material You + Tamagui**

Run the same command, answer: theme → Material You; accent → default `#6750A4`; library → Tamagui; app name → default.

Expected: a spinner shows "Installing component library", `@tamagui/core` lands in `node_modules`, `DESIGN.md` rewrites with Material You presets, `Theme: materialYou`, and Tamagui section.

Verify:
```bash
grep -F 'Theme: materialYou' DESIGN.md
grep -F '@tamagui/core' DESIGN.md
ls node_modules/@tamagui/core >/dev/null && echo INSTALLED
```
Expected: matches found; `INSTALLED` printed.

- [ ] **Step 6: Run `proto design update`**

Run:
```bash
node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js design update
```
Expected: prints `designUpdateHint` once and exits — does not open any editor and does not modify any file.

- [ ] **Step 7: Run `proto design` with Base + Custom**

Re-run `proto design` and answer: theme → Base; accent → `#000000`; library → Custom; package → `@my-org/ui`; docs → blank; app name → default.

Expected: no auto-install (custom is opt-in); a hint line printed about telling Claude Code to install; `DESIGN.md` rewritten with `Theme: base`, `Package: @my-org/ui`, no `Docs:` line; surfaces are flat colours, blurs `0`.

- [ ] **Step 8: Confirm Phase 1 surface still works**

Run from `/tmp/proto-phase2-e2e`:
```bash
node /Users/sherizan/Public/proto/packages/proto-cli/dist/index.js new-screen Settings --template form
ls screens
```
Expected: `Settings.tsx` exists in `screens/`. (Confirms Phase 1 commands weren't broken.)

- [ ] **Step 9: Final commit (no source changes; sanity tag only)**

If steps 1–8 all pass, no commit needed — this task is verification only.

If anything failed, return to the relevant task before declaring Phase 2 complete.

---

## Self-review notes

- **Spec coverage check:** Deliverable 1 → Task 1 step 1. Deliverable 2 → Task 1 step 2. Deliverable 3 → Tasks 4–7 (catalog, renderer, orchestrator, dispatch, update subcommand). Deliverable 4 → Tasks 1–3 (template files + extended copy + CLI substitutions + components/shared marker). Build-order tests 5–8 from the Phase 2 prompt → Task 8.
- **No placeholders:** every step has the actual code or command.
- **Type consistency:** `LibraryDescriptor`, `LibraryId`, `DesignInputs`, `ThemeName`, `RunDesignOptions`, `SpawnFn` defined once and referenced consistently. `getLibrary` excludes `'custom'`; `resolveCustomLibrary` handles that branch. `renderDesignDoc` accepts a fully-resolved `LibraryDescriptor` rather than a discriminated input — keeps the renderer pure and untyped by `LibraryId`.
- **One known divergence from Phase 2 prompt to flag:** the prompt says `proto design` installs "silently" with no output. Implementation uses `@clack/prompts` spinner with the `designInstalling` label — closest "silent-with-feedback" available; raw `pnpm` output is suppressed via `stdio: ['ignore', 'ignore', 'pipe']`. Designer never sees raw pnpm logs.
