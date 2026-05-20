# create-proto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `create-proto` — the `npm create proto@latest <name>` scaffolding CLI that lands a working Proto prototype project in under 90 seconds, with no engineering jargon ever shown to the designer.

**Architecture:** Small, single-responsibility TypeScript modules under `packages/create-proto/src/`. Tested in isolation via Vitest. `clack` drives terminal UX. A bundled `template/` tree is copied to the target directory, with `{{name}}` token substitution. The `components/proto/` slot inside the template is populated from `packages/proto-components/src/` at build time via a sync script. No raw engineering errors ever reach the designer — `install-deps.ts` translates package-manager stderr into friendly messages from `messages.ts`.

**Tech Stack:** TypeScript (ESM), Node 18+, pnpm workspace. Dependencies: `@clack/prompts`, `fs-extra`, `qrcode-terminal`, `validate-npm-package-name`, `tsx`. Test runner: Vitest. Build: `tsc`. PNG placeholders for `assets/icon.png` and `assets/splash.png` generated as 1×1 transparent PNGs (deferred to a designed icon before launch — see spec "Open follow-ups").

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-20-create-proto-design.md`
- Master doc §5, §6, §12, §15 Prompt 2
- CLAUDE.md — TDD for CLI logic, no engineering jargon in designer-facing output

**pnpm path note:** pnpm is at `~/.local/bin/pnpm` (corepack shim). Prepend `export PATH="$HOME/.local/bin:$PATH"` to every shell command that calls pnpm.

---

## File Structure

```
packages/create-proto/
├── package.json                       (Task 1)
├── tsconfig.json                      (Task 1)
├── vitest.config.ts                   (Task 1)
├── README.md                          (Task 1)
├── .gitignore                         (Task 1) — ignores template/components/proto/* (synced)
├── scripts/
│   └── sync-template.ts               (Task 11)
├── src/
│   ├── messages.ts                    (Task 2) — designer-facing copy
│   ├── messages.test.ts               (Task 2) — jargon audit
│   ├── validate-name.ts               (Task 3)
│   ├── validate-name.test.ts          (Task 3)
│   ├── detect-pm.ts                   (Task 4)
│   ├── detect-pm.test.ts              (Task 4)
│   ├── copy-template.ts               (Task 7)
│   ├── copy-template.test.ts          (Task 7)
│   ├── install-deps.ts                (Task 8)
│   ├── install-deps.test.ts           (Task 8)
│   ├── render-qr.ts                   (Task 9)
│   ├── render-qr.test.ts              (Task 9)
│   ├── cli.ts                         (Task 10)
│   └── index.ts                       (Task 12) — bin entry with shebang
└── template/
    ├── proto.config.js                (Task 5)
    ├── package.json                   (Task 5)
    ├── .gitignore                     (Task 5)
    ├── README.md                      (Task 5)
    ├── screens/
    │   ├── Home.tsx                   (Task 5)
    │   └── .gitkeep                   (Task 5)
    ├── assets/
    │   ├── icon.png                   (Task 5) — 1×1 PNG placeholder
    │   ├── splash.png                 (Task 5)
    │   └── .gitkeep                   (Task 5)
    ├── components/proto/
    │   └── .gitkeep                   (Task 5) — slot populated by Task 11
    └── .proto/
        ├── app/
        │   ├── _layout.tsx            (Task 6)
        │   └── (proto)/
        │       └── [...screen].tsx    (Task 6)
        ├── server/
        │   └── index.js               (Task 6) — Phase 2 stub
        ├── expo-config/
        │   ├── app.json               (Task 6)
        │   ├── babel.config.js        (Task 6)
        │   └── metro.config.js        (Task 6)
        └── .gitignore                 (Task 6)
```

---

## Task 1: Workspace deps, tsconfig, vitest

**Files:**
- Modify: `packages/create-proto/package.json`
- Create: `packages/create-proto/tsconfig.json`
- Create: `packages/create-proto/vitest.config.ts`
- Create: `packages/create-proto/README.md`
- Create: `packages/create-proto/.gitignore`

- [ ] **Step 1: Replace `packages/create-proto/package.json`**

```json
{
  "name": "create-proto",
  "version": "0.0.0",
  "description": "Scaffolding CLI for new Proto prototypes — run via `npm create proto@latest`",
  "type": "module",
  "bin": {
    "create-proto": "./dist/index.js"
  },
  "files": ["dist", "template"],
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "sync-template": "tsx scripts/sync-template.ts",
    "prebuild": "tsx scripts/sync-template.ts",
    "prepublishOnly": "tsx scripts/sync-template.ts && tsc -p tsconfig.json"
  },
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "fs-extra": "^11.2.0",
    "qrcode-terminal": "^0.12.0",
    "validate-npm-package-name": "^5.0.1"
  },
  "devDependencies": {
    "@types/fs-extra": "^11.0.4",
    "@types/node": "^20.12.0",
    "@types/qrcode-terminal": "^0.12.2",
    "@types/validate-npm-package-name": "^4.0.2",
    "tsx": "^4.15.0"
  }
}
```

- [ ] **Step 2: Create `packages/create-proto/tsconfig.json`**

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
  "exclude": ["src/**/*.test.ts", "scripts/**", "template/**"]
}
```

**NodeNext is load-bearing.** The compiled CLI is executed directly by Node — not bundled. NodeNext keeps the `.js` extensions on relative imports that Node ESM requires. Every relative import in `src/*.ts` MUST end with `.js` (e.g. `from './cli.js'`). Test files use Vitest's resolver and don't need the extension.

- [ ] **Step 3: Create `packages/create-proto/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create `packages/create-proto/README.md`**

```md
# create-proto

The npm create command for Proto.

```bash
npm create proto@latest my-app
```

See `docs/proto-master.md` for the full product.
```

- [ ] **Step 5: Create `packages/create-proto/.gitignore`**

```
dist/
node_modules/

# Populated by scripts/sync-template.ts at build time
template/components/proto/*
!template/components/proto/.gitkeep
```

- [ ] **Step 6: Install deps**

Run from repo root: `export PATH="$HOME/.local/bin:$PATH" && pnpm install`
Expected: dependencies resolve. Lockfile updates.

- [ ] **Step 7: Verify the toolchain runs**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: exits 0 — "No test files found, exiting with code 0" or similar.

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto typecheck`
Expected: tsc reports "No inputs were found" or completes with no errors. Either is fine.

- [ ] **Step 8: Commit**

```bash
git add packages/create-proto/package.json packages/create-proto/tsconfig.json packages/create-proto/vitest.config.ts packages/create-proto/README.md packages/create-proto/.gitignore pnpm-lock.yaml
git commit -m "chore(create-proto): wire workspace deps, tsconfig, vitest"
```

---

## Task 2: messages.ts (designer copy) with jargon audit

**Files:**
- Create: `packages/create-proto/src/messages.test.ts`
- Create: `packages/create-proto/src/messages.ts`

- [ ] **Step 1: Write the failing test (`messages.test.ts`)**

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
  it('exposes the keys the CLI uses', () => {
    expect(messages.header).toBe('Proto');
    expect(messages.namePrompt).toMatch(/prototype/i);
    expect(messages.settingUp).toBeTruthy();
    expect(messages.installing).toBeTruthy();
    expect(messages.ready).toBeTruthy();
    expect(messages.folderExists('demo')).toContain('demo');
    expect(messages.installFailed).toBeTruthy();
    expect(messages.final).toBeTruthy();
  });

  it('contains no engineering jargon (case-insensitive)', () => {
    const allStrings: string[] = [];
    for (const value of Object.values(messages)) {
      if (typeof value === 'string') allStrings.push(value);
      if (typeof value === 'function') allStrings.push(value('example'));
    }
    for (const text of allStrings) {
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

- [ ] **Step 2: Run — expect failure (module missing)**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: FAIL with "Cannot find module './messages'" or similar.

- [ ] **Step 3: Create `packages/create-proto/src/messages.ts`**

```ts
export const messages = {
  header: 'Proto',
  namePrompt: 'What is your prototype called?',
  settingUp: 'Setting things up',
  filesReady: 'Project files ready',
  installing: 'Installing',
  ready: 'Ready',
  folderExists: (name: string) =>
    `That folder already exists. Pick another name or delete "${name}" first.`,
  noNetwork:
    "Couldn't reach the package registry. Check your internet and try again.",
  noPermission:
    "Don't have permission to write here. Try a different folder.",
  noSpace: 'Out of disk space. Free some up and try again.',
  installFailed:
    "Couldn't get things installed. Try again, or visit proto.run/help",
  final:
    'Proto is ready. Scan the QR to preview on your device, or run: proto start',
};

export type Messages = typeof messages;
```

- [ ] **Step 4: Run — expect pass**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/create-proto/src/messages.ts packages/create-proto/src/messages.test.ts
git commit -m "feat(create-proto): designer-facing message strings with jargon audit"
```

---

## Task 3: validate-name.ts (project name validation)

**Files:**
- Create: `packages/create-proto/src/validate-name.test.ts`
- Create: `packages/create-proto/src/validate-name.ts`

- [ ] **Step 1: Write failing tests (`validate-name.test.ts`)**

```ts
import { describe, expect, it } from 'vitest';
import { validateName } from './validate-name';

describe('validateName', () => {
  it('accepts a simple lowercase name', () => {
    expect(validateName('my-app')).toEqual({ ok: true, sanitized: 'my-app' });
  });

  it('trims surrounding whitespace', () => {
    expect(validateName('  my-app  ')).toEqual({ ok: true, sanitized: 'my-app' });
  });

  it('lowercases uppercase input', () => {
    expect(validateName('My-App')).toEqual({ ok: true, sanitized: 'my-app' });
  });

  it('rejects names with spaces', () => {
    const result = validateName('my app');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/space/i);
  });

  it('rejects empty input', () => {
    expect(validateName('').ok).toBe(false);
    expect(validateName('   ').ok).toBe(false);
  });

  it('rejects reserved names', () => {
    expect(validateName('node_modules').ok).toBe(false);
    expect(validateName('.proto').ok).toBe(false);
    expect(validateName('proto').ok).toBe(false);
  });

  it('rejects names starting with a digit', () => {
    expect(validateName('1app').ok).toBe(false);
  });

  it('rejects names longer than 214 characters', () => {
    expect(validateName('a'.repeat(215)).ok).toBe(false);
  });

  it('rejects names with uppercase that contain invalid chars after lowercasing', () => {
    expect(validateName('My App').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `packages/create-proto/src/validate-name.ts`**

```ts
import validate from 'validate-npm-package-name';

export type NameValidation =
  | { ok: true; sanitized: string }
  | { ok: false; reason: string };

const RESERVED = new Set(['node_modules', '.proto', 'proto']);

export function validateName(input: string): NameValidation {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, reason: 'Give your prototype a name.' };
  }
  if (/\s/.test(trimmed)) {
    return {
      ok: false,
      reason: 'No spaces allowed. Try hyphens instead, like "my-app".',
    };
  }
  const sanitized = trimmed.toLowerCase();
  if (RESERVED.has(sanitized)) {
    return { ok: false, reason: 'That name is reserved. Pick something else.' };
  }
  const result = validate(sanitized);
  if (!result.validForNewPackages) {
    return {
      ok: false,
      reason: 'That name has characters that cause trouble. Use letters, numbers, and hyphens.',
    };
  }
  return { ok: true, sanitized };
}
```

- [ ] **Step 4: Run — expect pass**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: all validate-name tests + messages tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/create-proto/src/validate-name.ts packages/create-proto/src/validate-name.test.ts
git commit -m "feat(create-proto): validate project name with friendly reasons"
```

---

## Task 4: detect-pm.ts (package manager detection)

**Files:**
- Create: `packages/create-proto/src/detect-pm.test.ts`
- Create: `packages/create-proto/src/detect-pm.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { detectPm } from './detect-pm';

describe('detectPm', () => {
  it('detects pnpm from user agent', () => {
    expect(detectPm('pnpm/9.0.0 npm/? node/v20.0.0 darwin arm64')).toBe('pnpm');
  });

  it('detects yarn from user agent', () => {
    expect(detectPm('yarn/4.0.0 npm/? node/v20.0.0 darwin arm64')).toBe('yarn');
  });

  it('detects npm from user agent', () => {
    expect(detectPm('npm/10.0.0 node/v20.0.0 darwin arm64')).toBe('npm');
  });

  it('falls back to npm when user agent is undefined', () => {
    expect(detectPm(undefined)).toBe('npm');
  });

  it('falls back to npm when user agent is empty', () => {
    expect(detectPm('')).toBe('npm');
  });

  it('falls back to npm for unrecognised user agents', () => {
    expect(detectPm('something/1.0.0 node/v20.0.0')).toBe('npm');
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: FAIL.

- [ ] **Step 3: Create `packages/create-proto/src/detect-pm.ts`**

```ts
export type PackageManager = 'npm' | 'pnpm' | 'yarn';

export function detectPm(userAgent: string | undefined): PackageManager {
  if (!userAgent) return 'npm';
  if (userAgent.startsWith('pnpm/')) return 'pnpm';
  if (userAgent.startsWith('yarn/')) return 'yarn';
  if (userAgent.startsWith('npm/')) return 'npm';
  return 'npm';
}
```

- [ ] **Step 4: Run — expect pass**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/create-proto/src/detect-pm.ts packages/create-proto/src/detect-pm.test.ts
git commit -m "feat(create-proto): detect package manager from npm_config_user_agent"
```

---

## Task 5: Template static files (designer-facing)

**Files:**
- Create: `packages/create-proto/template/proto.config.js`
- Create: `packages/create-proto/template/package.json`
- Create: `packages/create-proto/template/.gitignore`
- Create: `packages/create-proto/template/README.md`
- Create: `packages/create-proto/template/screens/Home.tsx`
- Create: `packages/create-proto/template/screens/.gitkeep`
- Create: `packages/create-proto/template/assets/.gitkeep`
- Create: `packages/create-proto/template/assets/icon.png` (1×1 PNG)
- Create: `packages/create-proto/template/assets/splash.png` (1×1 PNG)
- Create: `packages/create-proto/template/components/proto/.gitkeep`

- [ ] **Step 1: Create `packages/create-proto/template/proto.config.js`**

```js
export default {
  name: '{{name}}',
  theme: 'liquidGlass',
  accentColor: '#007AFF',
  screens: { initial: 'Home' },
};
```

- [ ] **Step 2: Create `packages/create-proto/template/package.json`**

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

- [ ] **Step 3: Create `packages/create-proto/template/.gitignore`**

```
node_modules/
.expo/
.metro-cache/
dist/
*.log
.DS_Store
```

- [ ] **Step 4: Create `packages/create-proto/template/README.md`**

```md
# {{name}}

Built with Proto.

Run `proto start` to preview on your phone.
Run `proto add "describe a screen"` to generate a new screen.
```

- [ ] **Step 5: Create `packages/create-proto/template/screens/Home.tsx`**

```tsx
import { Screen, Stack, Text } from '../components/proto';

export default function Home() {
  return (
    <Screen title="Home">
      <Stack gap={16}>
        <Text size="title">Welcome to Proto</Text>
        <Text size="body" color="secondary">
          Describe what you want to build.
        </Text>
      </Stack>
    </Screen>
  );
}
```

- [ ] **Step 6: Create the four `.gitkeep` files**

```bash
mkdir -p packages/create-proto/template/screens packages/create-proto/template/assets packages/create-proto/template/components/proto
touch packages/create-proto/template/screens/.gitkeep packages/create-proto/template/assets/.gitkeep packages/create-proto/template/components/proto/.gitkeep
```

- [ ] **Step 7: Create the 1×1 PNG placeholders**

Run this inline Node script from repo root:

```bash
node -e "
const fs = require('fs');
const png1x1 = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63f8cfc0500f0001050100bbcb3b6e0000000049454e44ae426082', 'hex');
fs.writeFileSync('packages/create-proto/template/assets/icon.png', png1x1);
fs.writeFileSync('packages/create-proto/template/assets/splash.png', png1x1);
console.log('Wrote 1x1 PNG placeholders.');
"
```

Verify: `ls -la packages/create-proto/template/assets/`
Expected: `icon.png` and `splash.png` exist with non-zero size.

- [ ] **Step 8: Commit**

```bash
git add packages/create-proto/template/proto.config.js packages/create-proto/template/package.json packages/create-proto/template/.gitignore packages/create-proto/template/README.md packages/create-proto/template/screens packages/create-proto/template/assets packages/create-proto/template/components
git commit -m "feat(create-proto): bundle template scaffold for new prototypes"
```

---

## Task 6: Template `.proto/` runtime files

**Files:**
- Create: `packages/create-proto/template/.proto/.gitignore`
- Create: `packages/create-proto/template/.proto/app/_layout.tsx`
- Create: `packages/create-proto/template/.proto/app/(proto)/[...screen].tsx`
- Create: `packages/create-proto/template/.proto/server/index.js`
- Create: `packages/create-proto/template/.proto/expo-config/app.json`
- Create: `packages/create-proto/template/.proto/expo-config/babel.config.js`
- Create: `packages/create-proto/template/.proto/expo-config/metro.config.js`

- [ ] **Step 1: Create `packages/create-proto/template/.proto/.gitignore`**

```
cache/
*.log
```

- [ ] **Step 2: Create `packages/create-proto/template/.proto/app/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Create `packages/create-proto/template/.proto/app/(proto)/[...screen].tsx`**

```tsx
import { useLocalSearchParams } from 'expo-router';
import { Screen, Text } from '../../../components/proto';

export default function DynamicScreen() {
  const params = useLocalSearchParams<{ screen?: string[] }>();
  const name = params.screen?.[0] ?? 'Home';

  let Component: React.ComponentType | null = null;
  try {
    Component = require(`../../../screens/${name}`).default;
  } catch {
    Component = null;
  }

  if (!Component) {
    return (
      <Screen title="Not found">
        <Text size="body">No screen named "{name}" yet.</Text>
      </Screen>
    );
  }

  return <Component />;
}
```

- [ ] **Step 4: Create `packages/create-proto/template/.proto/server/index.js`**

```js
import http from 'node:http';

const PORT = 3001;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  // Phase 2 will replace this stub with the prompt server.
});
```

- [ ] **Step 5: Create `packages/create-proto/template/.proto/expo-config/app.json`**

```json
{
  "expo": {
    "name": "{{name}}",
    "slug": "{{name}}",
    "version": "0.0.0",
    "orientation": "portrait",
    "icon": "../../assets/icon.png",
    "splash": {
      "image": "../../assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#FFFFFF"
    },
    "scheme": "{{name}}",
    "plugins": ["expo-router"],
    "experiments": { "typedRoutes": true }
  }
}
```

- [ ] **Step 6: Create `packages/create-proto/template/.proto/expo-config/babel.config.js`**

```js
export default function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
}
```

- [ ] **Step 7: Create `packages/create-proto/template/.proto/expo-config/metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
```

- [ ] **Step 8: Commit**

```bash
git add packages/create-proto/template/.proto
git commit -m "feat(create-proto): bundle .proto runtime config and router stubs"
```

---

## Task 7: copy-template.ts (recursive copy with token substitution)

**Files:**
- Create: `packages/create-proto/src/copy-template.test.ts`
- Create: `packages/create-proto/src/copy-template.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
  fs.writeFileSync(path.join(templateRoot, 'plain.txt'), `Hello {{name}}, no token here on next line.\nLine 2.`);
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

  it('substitutes {{name}} tokens in text files', async () => {
    await copyTemplate({ templateRoot, destRoot, projectName: 'demo' });
    const config = fs.readFileSync(path.join(destRoot, 'config.js'), 'utf8');
    expect(config).toContain("'demo'");
    expect(config).not.toContain('{{name}}');
    const plain = fs.readFileSync(path.join(destRoot, 'plain.txt'), 'utf8');
    expect(plain).toContain('Hello demo');
  });

  it('skips .gitkeep files', async () => {
    await copyTemplate({ templateRoot, destRoot, projectName: 'demo' });
    expect(fs.existsSync(path.join(destRoot, 'sub', '.gitkeep'))).toBe(false);
    expect(fs.existsSync(path.join(destRoot, 'sub'))).toBe(true);
  });

  it('preserves binary files byte-for-byte', async () => {
    await copyTemplate({ templateRoot, destRoot, projectName: 'demo' });
    const original = fs.readFileSync(path.join(templateRoot, 'binary.png'));
    const copied = fs.readFileSync(path.join(destRoot, 'binary.png'));
    expect(copied.equals(original)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: FAIL — copy-template module missing.

- [ ] **Step 3: Create `packages/create-proto/src/copy-template.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';

export type CopyOptions = {
  templateRoot: string;
  destRoot: string;
  projectName: string;
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
  const { templateRoot, destRoot, projectName } = options;
  await walk(templateRoot, destRoot, projectName);
}

async function walk(srcDir: string, destDir: string, projectName: string): Promise<void> {
  await fs.promises.mkdir(destDir, { recursive: true });
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await walk(srcPath, destPath, projectName);
      continue;
    }
    if (entry.name === '.gitkeep') continue;
    const ext = path.extname(entry.name);
    if (TEXT_EXTENSIONS.has(ext)) {
      const text = await fs.promises.readFile(srcPath, 'utf8');
      const replaced = text.replaceAll('{{name}}', projectName);
      await fs.promises.writeFile(destPath, replaced, 'utf8');
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/create-proto/src/copy-template.ts packages/create-proto/src/copy-template.test.ts
git commit -m "feat(create-proto): recursive template copy with name token substitution"
```

---

## Task 8: install-deps.ts (silent spawn + error translation)

**Files:**
- Create: `packages/create-proto/src/install-deps.test.ts`
- Create: `packages/create-proto/src/install-deps.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { installDeps, translateInstallError } from './install-deps';

describe('translateInstallError', () => {
  it('maps ENOTFOUND to no-network message', () => {
    expect(translateInstallError('npm ERR! code ENOTFOUND')).toMatch(/internet/i);
  });

  it('maps ETIMEDOUT to no-network message', () => {
    expect(translateInstallError('Error: ETIMEDOUT')).toMatch(/internet/i);
  });

  it('maps EACCES to no-permission message', () => {
    expect(translateInstallError('Error: EACCES permission denied')).toMatch(/permission/i);
  });

  it('maps ENOSPC to no-space message', () => {
    expect(translateInstallError('ENOSPC: no space left on device')).toMatch(/disk space/i);
  });

  it('returns the generic message for unknown stderr', () => {
    expect(translateInstallError('Something weird happened')).toMatch(/Try again/i);
  });
});

describe('installDeps', () => {
  it('builds the right argv per package manager', async () => {
    const calls: Array<{ cmd: string; args: string[]; cwd: string }> = [];
    const fakeSpawn = (cmd: string, args: string[], opts: { cwd: string }) => {
      calls.push({ cmd, args, cwd: opts.cwd });
      return Promise.resolve({ code: 0, stderr: '' });
    };

    await installDeps({ cwd: '/tmp/x', pm: 'npm', spawnFn: fakeSpawn });
    expect(calls[0]).toEqual({ cmd: 'npm', args: ['install', '--silent'], cwd: '/tmp/x' });

    await installDeps({ cwd: '/tmp/y', pm: 'pnpm', spawnFn: fakeSpawn });
    expect(calls[1]).toEqual({ cmd: 'pnpm', args: ['install', '--silent'], cwd: '/tmp/y' });

    await installDeps({ cwd: '/tmp/z', pm: 'yarn', spawnFn: fakeSpawn });
    expect(calls[2]).toEqual({ cmd: 'yarn', args: ['install', '--silent'], cwd: '/tmp/z' });
  });

  it('throws a translated error when the spawn exits non-zero', async () => {
    const fakeSpawn = () =>
      Promise.resolve({ code: 1, stderr: 'npm ERR! code ENOTFOUND' });
    await expect(
      installDeps({ cwd: '/tmp/x', pm: 'npm', spawnFn: fakeSpawn }),
    ).rejects.toThrow(/internet/i);
  });

  it('resolves on success', async () => {
    const fakeSpawn = () => Promise.resolve({ code: 0, stderr: '' });
    await expect(
      installDeps({ cwd: '/tmp/x', pm: 'npm', spawnFn: fakeSpawn }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: FAIL.

- [ ] **Step 3: Create `packages/create-proto/src/install-deps.ts`**

```ts
import { spawn } from 'node:child_process';
import { messages } from './messages.js';
import type { PackageManager } from './detect-pm.js';

export type SpawnResult = { code: number | null; stderr: string };
export type SpawnFn = (
  cmd: string,
  args: string[],
  opts: { cwd: string },
) => Promise<SpawnResult>;

export type InstallOptions = {
  cwd: string;
  pm: PackageManager;
  spawnFn?: SpawnFn;
};

export async function installDeps(options: InstallOptions): Promise<void> {
  const fn = options.spawnFn ?? defaultSpawn;
  const result = await fn(options.pm, ['install', '--silent'], { cwd: options.cwd });
  if (result.code !== 0) {
    throw new Error(translateInstallError(result.stderr));
  }
}

export function translateInstallError(stderr: string): string {
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN/.test(stderr)) {
    return messages.noNetwork;
  }
  if (/EACCES/.test(stderr)) {
    return messages.noPermission;
  }
  if (/ENOSPC/.test(stderr)) {
    return messages.noSpace;
  }
  return messages.installFailed;
}

function defaultSpawn(cmd: string, args: string[], opts: { cwd: string }): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => {
      resolve({ code, stderr });
    });
    child.on('error', (err) => {
      resolve({ code: 1, stderr: err.message });
    });
  });
}
```

- [ ] **Step 4: Run — expect pass**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/create-proto/src/install-deps.ts packages/create-proto/src/install-deps.test.ts
git commit -m "feat(create-proto): silent install with translated errors"
```

---

## Task 9: render-qr.ts

**Files:**
- Create: `packages/create-proto/src/render-qr.test.ts`
- Create: `packages/create-proto/src/render-qr.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { renderQr } from './render-qr';

describe('renderQr', () => {
  it('returns a non-empty string for a URL', () => {
    const out = renderQr('http://localhost:8081');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(20);
  });

  it('produces different output for different URLs', () => {
    const a = renderQr('http://localhost:8081');
    const b = renderQr('http://localhost:9999');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: FAIL.

- [ ] **Step 3: Create `packages/create-proto/src/render-qr.ts`**

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

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/create-proto/src/render-qr.ts packages/create-proto/src/render-qr.test.ts
git commit -m "feat(create-proto): render QR as a returnable string"
```

---

## Task 10: cli.ts (orchestrator)

**Files:**
- Create: `packages/create-proto/src/cli.ts`

No test for cli.ts directly — the modules it composes are all tested. Manual end-to-end test happens in Task 13.

- [ ] **Step 1: Create `packages/create-proto/src/cli.ts`**

```ts
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { intro, outro, text, spinner, isCancel, cancel, log } from '@clack/prompts';
import { messages } from './messages.js';
import { validateName } from './validate-name.js';
import { detectPm } from './detect-pm.js';
import { copyTemplate } from './copy-template.js';
import { installDeps } from './install-deps.js';
import { renderQr } from './render-qr.js';

export async function run(argv: string[]): Promise<void> {
  intro(messages.header);

  const folderArg = argv[2];
  const defaultName = folderArg ?? 'my-prototype';

  const nameInput = await text({
    message: messages.namePrompt,
    initialValue: defaultName,
    validate: (v) => {
      const r = validateName(v ?? '');
      return r.ok ? undefined : r.reason;
    },
  });
  if (isCancel(nameInput) || typeof nameInput !== 'string') {
    cancel('Cancelled.');
    process.exit(0);
  }

  const validated = validateName(nameInput);
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

  const s = spinner();
  s.start(messages.settingUp);
  await copyTemplate({ templateRoot, destRoot: dest, projectName: name });
  s.stop(messages.filesReady);

  const pm = detectPm(process.env.npm_config_user_agent);
  const s2 = spinner();
  s2.start(messages.installing);
  try {
    await installDeps({ cwd: dest, pm });
    s2.stop(messages.ready);
  } catch (err) {
    s2.stop(err instanceof Error ? err.message : messages.installFailed);
    process.exit(1);
  }

  log.info(renderQr('http://localhost:8081'));
  outro(messages.final);
}
```

- [ ] **Step 2: Typecheck**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto typecheck`
Expected: exit 0.

- [ ] **Step 3: Run tests (should still pass — no test touched cli.ts but ensure nothing broke)**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto test`
Expected: all earlier tests still pass.

- [ ] **Step 4: Commit**

```bash
git add packages/create-proto/src/cli.ts
git commit -m "feat(create-proto): orchestrator wiring clack flow and modules"
```

---

## Task 11: scripts/sync-template.ts

**Files:**
- Create: `packages/create-proto/scripts/sync-template.ts`

- [ ] **Step 1: Create `packages/create-proto/scripts/sync-template.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const src = path.join(repoRoot, 'packages/proto-components/src');
const dest = path.join(repoRoot, 'packages/create-proto/template/components/proto');

const EXCLUDE = new Set(['proto-config.d.ts']);

async function main() {
  if (!fs.existsSync(src)) {
    throw new Error(`proto-components source not found at ${src}`);
  }
  await fs.promises.rm(dest, { recursive: true, force: true });
  await fs.promises.mkdir(dest, { recursive: true });

  await walk(src, dest);

  // Restore the .gitkeep so the empty dir tracking still works pre-build
  // if the dest ends up empty (it won't, but be safe).
  const keep = path.join(dest, '.gitkeep');
  if (!fs.existsSync(keep)) {
    await fs.promises.writeFile(keep, '');
  }
}

async function walk(srcDir: string, destDir: string): Promise<void> {
  await fs.promises.mkdir(destDir, { recursive: true });
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await walk(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the sync**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto sync-template`
Expected: copies all 10 components + theme files into `packages/create-proto/template/components/proto/`. Verify by listing:

Run: `ls packages/create-proto/template/components/proto/ packages/create-proto/template/components/proto/tokens/`
Expected: Button.tsx, Card.tsx, Divider.tsx, Modal.tsx, Nav.tsx, Row.tsx, Screen.tsx, Stack.tsx, Text.tsx, Toggle.tsx, index.ts, types.ts, useTheme.ts, tokens/, and inside tokens: liquidGlass.ts, materialYou.ts. No `proto-config.d.ts`.

- [ ] **Step 3: Confirm sync output is gitignored**

Run: `git status --short packages/create-proto/template/components/proto/`
Expected: empty output (everything except `.gitkeep` is ignored per `.gitignore`).

- [ ] **Step 4: Commit**

```bash
git add packages/create-proto/scripts/sync-template.ts
git commit -m "feat(create-proto): sync proto-components source into template at build time"
```

---

## Task 12: src/index.ts (bin entry with shebang) + build

**Files:**
- Create: `packages/create-proto/src/index.ts`

- [ ] **Step 1: Create `packages/create-proto/src/index.ts`**

```ts
#!/usr/bin/env node
import { run } from './cli.js';

run(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 2: Build**

Run: `export PATH="$HOME/.local/bin:$PATH" && pnpm --filter create-proto build`
Expected: prebuild runs sync-template, then tsc emits `packages/create-proto/dist/`.

Verify the shebang lands in the compiled output:

Run: `head -1 packages/create-proto/dist/index.js`
Expected: `#!/usr/bin/env node`

If the shebang is missing (tsc strips it by default), add this step:

Run: `chmod +x packages/create-proto/dist/index.js`

And if the shebang is gone, prepend it manually for this commit, and update `prebuild` later. (Most tsc configs preserve the shebang. If yours doesn't, the safest fix is a small post-build script.)

- [ ] **Step 3: Commit**

```bash
git add packages/create-proto/src/index.ts
git commit -m "feat(create-proto): bin entry with shebang"
```

---

## Task 13: End-to-end smoke test

**Files:** none — verification only.

- [ ] **Step 1: Run the full pipeline manually**

```bash
cd /tmp
mkdir -p proto-smoke && cd proto-smoke
node /Users/sherizan/Public/proto/packages/create-proto/dist/index.js smoke-app
```

Expected interactive flow:
1. Header: "Proto"
2. Prompt: "What is your prototype called?" with default "smoke-app"
3. Hit Enter
4. Spinner: "Setting things up" → "Project files ready"
5. Spinner: "Installing" → "Ready"  (this requires network)
6. QR rendered for `http://localhost:8081`
7. Final message: "Proto is ready. Scan the QR to preview on your device, or run: proto start"

Verify scaffold:

```bash
ls /tmp/proto-smoke/smoke-app
ls /tmp/proto-smoke/smoke-app/components/proto
cat /tmp/proto-smoke/smoke-app/proto.config.js
```

Expected:
- `proto.config.js`, `package.json`, `README.md`, `screens/Home.tsx`, `assets/icon.png`, `components/proto/Screen.tsx` (and the other 9 components), `.proto/app/_layout.tsx`, etc.
- `proto.config.js` contains `name: 'smoke-app'` (token replaced).
- `package.json` has `"name": "smoke-app"`.

- [ ] **Step 2: Run the folder-exists check**

```bash
cd /tmp/proto-smoke
node /Users/sherizan/Public/proto/packages/create-proto/dist/index.js smoke-app
```

Hit Enter to accept the default `smoke-app`. Expected: error message `That folder already exists. Pick another name or delete "smoke-app" first.` and exit code 1.

- [ ] **Step 3: Clean up**

```bash
rm -rf /tmp/proto-smoke
```

- [ ] **Step 4: Final typecheck + tests for the whole package**

```bash
cd /Users/sherizan/Public/proto
export PATH="$HOME/.local/bin:$PATH"
pnpm --filter create-proto typecheck
pnpm --filter create-proto test
pnpm --filter create-proto build
```

Expected: all three exit 0.

- [ ] **Step 5: Acceptance checklist (read against the spec)**

Open `docs/superpowers/specs/2026-05-20-create-proto-design.md` "Acceptance" section. Verify:
- Tests pass ✓ (Step 4)
- Typecheck passes ✓ (Step 4)
- Build produces `dist/index.js` with shebang ✓ (Task 12 Step 2)
- `sync-template` populates `template/components/proto/` ✓ (Task 11 Step 2)
- Local install vector test ✓ (Step 1)
- Folder collision aborts cleanly ✓ (Step 2)
- No jargon in `messages.ts` ✓ (Task 2 test)
- `npm create`, `pnpm create`, `yarn create` paths — DEFERRED to publish time (record in Task 13 commit as a known follow-up).

- [ ] **Step 6: Commit the verification log**

```bash
git commit --allow-empty -m "test(create-proto): end-to-end smoke verified locally"
```

---

## Self-review notes

**Spec coverage:**
- Build-time template sync — Task 11 ✓
- Template structure (proto.config.js, package.json, screens/Home.tsx, .proto/*) — Tasks 5 + 6 ✓
- All `src/` modules in spec — Tasks 2–10 ✓
- Acceptance criteria — Task 13 ✓
- Designer-facing strings + jargon audit — Task 2 ✓
- Error translation table — Task 8 ✓
- Folder collision handling — Task 10 + 13 ✓
- `npm`/`pnpm`/`yarn` testing — Task 13 Step 5 documents this is deferred to publish; the underlying `detect-pm` is tested for all three (Task 4).

**Placeholder scan:** None of the disallowed patterns. The "Open follow-ups" in the spec are intentionally out of scope and called out as such.

**Type consistency:**
- `PackageManager` defined in Task 4, used in Task 8 (`install-deps.ts`) and Task 10 (`cli.ts`) consistently.
- `NameValidation` defined in Task 3, used in Task 10.
- `CopyOptions` in Task 7, used in Task 10.
- `messages` shape in Task 2, consumed unchanged in Tasks 8 and 10.
- The `SpawnFn` type in Task 8 is internal to install-deps.

**Known sharp edges:**
- Shebang preservation across tsc varies — Task 12 Step 2 calls out the manual fix if tsc strips it. Modern tsc preserves shebangs in `.ts` source written with `#!` at the top.
- `node:fs` `readFile` + `writeFile` with `'utf8'` encoding in `copy-template.ts` assumes text files don't exceed memory — fine for our template files (all < 5 KB).
- `installDeps`'s real spawn path is integration-tested via Task 13, not unit tests — the unit test uses an injected `spawnFn`.
