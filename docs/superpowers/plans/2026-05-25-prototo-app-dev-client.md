# Prototo App Dev-Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the existing `apps/proto-app/` scaffold into the Prototo brand, swap the proto-cli's Expo-Go-aware simulator helper for a Prototo-App downloader/installer, switch `proto start` to `expo start --dev-client --ios`, set the template scheme to `prototo`, then publish the first simulator binary so `proto start` end-to-end opens Prototo (not Expo Go).

**Architecture:** Approach 1 from the spec — standard Expo dev-client URL convention. Both the project template and Prototo App declare `scheme: "prototo"`; `expo start --dev-client` then prints `prototo://expo-development-client/?url=exp://<lan>:8081` natively. Simulator binary distributed via GitHub Releases (tag `prototo-sim-sdk<major>-latest`), fetched on first `proto start` and cached at `~/.prototo/cache/`. iPhone install is App Store-only (out of scope for this plan; Phase 3 sub-unit F).

**Tech Stack:** TypeScript + Vitest + pnpm workspace. Expo SDK 55. EAS Build (hosted) with `development`, `development-simulator`, `preview`, `production` profiles. Node 18+ `fetch`/`crypto` for downloads. `xcrun simctl` for Simulator install.

**Spec:** `docs/superpowers/specs/2026-05-25-prototo-app-dev-client-design.md`.

---

## File map

**Files to create:**
- `packages/proto-cli/src/ensure-prototo-app.ts` (the replacement helper)
- `packages/proto-cli/src/ensure-prototo-app.test.ts`
- `apps/prototo-app/scripts/release-simulator.ts` (maintainer-only release tool)

**Files to delete:**
- `packages/proto-cli/src/ensure-expo-go.ts`
- `packages/proto-cli/src/ensure-expo-go.test.ts`

**Files to rename:**
- `apps/proto-app/` → `apps/prototo-app/` (whole directory, `git mv`)

**Files to modify (code):**
- `apps/prototo-app/package.json` — name, add `release:simulator` script
- `apps/prototo-app/app.json` — display name, slug, scheme, bundle ID, `MinimumOSVersion`, `associatedDomains`, remove old EAS projectId
- `apps/prototo-app/eas.json` — add `production` profile
- `apps/prototo-app/README.md` — rebrand
- `packages/proto-cli/src/start.ts` — call ensurePrototoAppMatchesProject
- `packages/proto-cli/src/expo-spawn.ts` — `--dev-client` flag
- `packages/proto-cli/src/expo-spawn.test.ts` — expected args
- `packages/proto-cli/src/messages.ts` — new keys + drop Expo-Go-flavoured copy
- `packages/proto-cli/src/messages.test.ts` — cover new keys
- `packages/proto-cli/src/error-translation.ts` — audit for any Expo Go strings
- `packages/create-proto/template/.proto/expo-config/app.json` — `scheme: "prototo"`
- `packages/create-proto/template/CLAUDE.md` — audit for stray "Expo Go"
- `packages/create-proto/template/README.md` — add App Store install line

**Files to modify (docs):**
- `docs/proto-master.md` — branding, file structure block, decisions log
- `docs/superpowers/specs/2026-05-22-proto-app-dev-client-design.md` — superseded banner
- `docs/superpowers/specs/2026-05-22-onboarding-redesign-design.md` — single-QR note
- `docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md` — bundle ID + path sync

**Files unchanged but touched indirectly:**
- `pnpm-workspace.yaml` — already globs `apps/*`, no edit needed

---

## Conventions used in this plan

- **Working directory** for shell commands: project root `/Users/sherizan/Public/proto` unless stated otherwise.
- **Test runner**: `pnpm --filter @sherizan/proto-cli test` (Vitest, runs from `packages/proto-cli`).
- **Commit cadence**: one commit per task. Commit messages: `feat(scope): subject` or `chore(scope): subject` per existing repo style; bodies optional. Always include the Co-Authored-By trailer.
- **TDD**: every code task writes the failing test first, runs it to confirm RED, implements the code, runs to confirm GREEN, then commits.
- **Subprocess invocation**: use `execFileSync` from `node:child_process` (not `execSync`) to match the codebase's existing pattern in `ensure-expo-go.ts`. Pass args as an array — never interpolate into a shell string.

---

## Task 1: Rename `apps/proto-app/` → `apps/prototo-app/` with full branding sweep

**Files:**
- Rename: `apps/proto-app/` → `apps/prototo-app/`
- Modify: `apps/prototo-app/package.json`
- Modify: `apps/prototo-app/app.json`
- Modify: `apps/prototo-app/README.md` (rebrand any Proto → Prototo references; out of scope if it's already clean)

- [ ] **Step 1: Move the directory via git**

Run:

```bash
git mv apps/proto-app apps/prototo-app
```

Expected: git tracks the rename; `git status` shows `renamed: apps/proto-app/... -> apps/prototo-app/...` for every tracked file.

- [ ] **Step 2: Rewrite `apps/prototo-app/package.json`**

Replace its contents with:

```json
{
  "name": "prototo-app",
  "version": "0.1.0",
  "private": true,
  "description": "Prototo — custom Expo dev client. Designer canvas for proto start on Simulator and iPhone. Renders real iOS 26 Liquid Glass.",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --dev-client",
    "ios": "expo run:ios",
    "build:ios": "eas build --platform ios --profile development",
    "build:ios:sim": "eas build --platform ios --profile development-simulator",
    "build:ios:prod": "eas build --platform ios --profile production",
    "submit:ios": "eas submit --platform ios --latest",
    "release:simulator": "tsx scripts/release-simulator.ts"
  },
  "dependencies": {
    "@expo/ui": "55.0.17",
    "expo": "~55.0.26",
    "expo-blur": "~55.0.14",
    "expo-dev-client": "~55.0.35",
    "expo-glass-effect": "~55.0.11",
    "expo-haptics": "~55.0.14",
    "expo-router": "~55.0.16",
    "expo-status-bar": "~55.0.6",
    "react": "19.2.0",
    "react-native": "0.83.6",
    "react-native-gesture-handler": "~2.30.1",
    "react-native-reanimated": "4.2.1",
    "react-native-safe-area-context": "5.6.2",
    "react-native-screens": "4.23.0",
    "react-native-worklets": "0.7.4"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/node": "^20.12.0",
    "@types/react": "~19.2.15",
    "babel-preset-expo": "~55.0.22",
    "tsx": "^4.15.0",
    "typescript": "^5.9.2"
  }
}
```

(`tsx` added as devDep so `release:simulator` can execute the TS script without a separate build step.)

- [ ] **Step 3: Rewrite `apps/prototo-app/app.json`**

Replace its contents with:

```json
{
  "expo": {
    "name": "Prototo",
    "slug": "prototo-app",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "prototo",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#FFFFFF"
    },
    "ios": {
      "bundleIdentifier": "com.sherizan.prototo",
      "supportsTablet": false,
      "associatedDomains": ["applinks:prototo.app"],
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false,
        "MinimumOSVersion": "26.0"
      }
    },
    "plugins": ["expo-dev-client", "expo-router"],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": {}
    },
    "owner": "sherizan"
  }
}
```

Removed: the old `extra.eas.projectId` (EAS will provision a fresh one on first build under the new slug).

- [ ] **Step 4: Rebrand `apps/prototo-app/README.md`**

Read the file. Replace every "Proto" reference that refers to the dev client (not the broader product/project) with "Prototo", and bundle ID `com.sherizan.proto` → `com.sherizan.prototo`. If the file is already clean, skip.

- [ ] **Step 5: Reinstall workspace dependencies**

Run:

```bash
pnpm install
```

Expected: pnpm picks up the renamed `apps/prototo-app/`, no errors. `tsx` is now in the dev tree.

- [ ] **Step 6: Type-check the renamed app**

Run:

```bash
pnpm --filter prototo-app exec tsc -p tsconfig.json --noEmit
```

Expected: exits 0.

- [ ] **Step 7: Verify the rest of the workspace still builds**

Run:

```bash
pnpm --filter @sherizan/proto-cli typecheck && pnpm --filter @sherizan/proto-cli test
```

Expected: both exit 0. (Nothing in proto-cli imports `apps/proto-app`, so this is just sanity.)

- [ ] **Step 8: Commit**

```bash
git add apps/prototo-app pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
refactor(prototo-app): rename apps/proto-app -> apps/prototo-app

Brand rename to Prototo. Bundle id com.sherizan.prototo, scheme prototo,
display name Prototo, slug prototo-app. MinimumOSVersion 26.0 for
guaranteed Liquid Glass support. associatedDomains for share-landing
universal links. Removed stale EAS projectId so a fresh one provisions
on first build under the new slug.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds. `git status` clean.

---

## Task 2: Add `production` profile to `eas.json`

**Files:**
- Modify: `apps/prototo-app/eas.json`

- [ ] **Step 1: Rewrite `apps/prototo-app/eas.json`**

Replace its contents with:

```json
{
  "cli": {
    "version": ">= 13.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "development-simulator": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "distribution": "store",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "hi@sherizan.com",
        "ascAppId": "REPLACE_WITH_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "REPLACE_WITH_APPLE_TEAM_ID"
      }
    }
  }
}
```

The `REPLACE_WITH_*` placeholders are filled in during Task 16/17 once the maintainer's first build has registered the app with App Store Connect — until then they're inert (no submit will run).

- [ ] **Step 2: Validate EAS schema (best-effort)**

Run:

```bash
cd apps/prototo-app && pnpm exec eas build:configure --help > /dev/null && cd -
```

Expected: exits 0 (just sanity that `eas` CLI is reachable). If `eas` is not installed, skip this step — the file will be validated on the first real `eas build` invocation in Task 12.

- [ ] **Step 3: Commit**

```bash
git add apps/prototo-app/eas.json
git commit -m "$(cat <<'EOF'
chore(prototo-app): add production + submit profiles to eas.json

Production profile (store distribution) prepares the App Store ship
path. Submit config has placeholder IDs that maintainer fills in once
App Store Connect is set up.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 3: Update create-proto template scheme to `prototo`

**Files:**
- Modify: `packages/create-proto/template/.proto/expo-config/app.json`

- [ ] **Step 1: Read current file**

Run:

```bash
cat packages/create-proto/template/.proto/expo-config/app.json
```

Confirm `"scheme": "{{name}}"` is present (it should be per earlier inspection).

- [ ] **Step 2: Replace the scheme line**

Edit `packages/create-proto/template/.proto/expo-config/app.json`. Change:

```json
    "scheme": "{{name}}",
```

to:

```json
    "scheme": "prototo",
```

Leave every other field unchanged.

- [ ] **Step 3: Run the create-proto tests**

Run:

```bash
pnpm --filter @sherizan/create-proto test
```

Expected: all tests pass. If any test asserts on the old `scheme` value, update the assertion to `prototo`.

- [ ] **Step 4: Commit**

```bash
git add packages/create-proto/template/.proto/expo-config/app.json
git commit -m "$(cat <<'EOF'
chore(create-proto): template scheme = prototo

All Prototo projects share the prototo:// URL scheme so the Prototo
dev client opens them via the standard expo-development-client URL
convention.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 4: Add new proto-cli messages (TDD)

**Files:**
- Modify: `packages/proto-cli/src/messages.ts`
- Modify: `packages/proto-cli/src/messages.test.ts`

- [ ] **Step 1: Read current messages test file**

Run:

```bash
cat packages/proto-cli/src/messages.test.ts
```

Note its existing structure so the new tests follow the same conventions.

- [ ] **Step 2: Write failing tests for the new message keys**

Add the following block to `packages/proto-cli/src/messages.test.ts` (inside the existing top-level `describe` if present, else as new test cases):

```ts
import { describe, it, expect } from 'vitest';
import { messages } from './messages.js';

describe('messages — Prototo dev-client copy', () => {
  it('installingPrototoApp is a short status string with no engineering jargon', () => {
    expect(messages.installingPrototoApp).toBe('Setting up Prototo on the Simulator…');
  });

  it('prototoAppOutdated tells the designer to update via App Store', () => {
    expect(messages.prototoAppOutdated).toBe(
      'This project needs a newer Prototo. Update Prototo from the App Store and try again.',
    );
  });

  it('prototoSimulatorOffline gives a recovery path without engineering terms', () => {
    expect(messages.prototoSimulatorOffline).toBe(
      "The Simulator's Prototo is older than this project. Connect to the internet, then run proto start to refresh it.",
    );
  });

  it('startingHeader rebrand to Prototo', () => {
    expect(messages.startingHeader).toBe('Prototo');
  });

  it('designIntro rebrand to Prototo', () => {
    expect(messages.designIntro).toBe('Prototo');
  });

  it('does not surface Expo Go anywhere in copy', () => {
    for (const value of Object.values(messages)) {
      if (typeof value === 'string') {
        expect(value).not.toMatch(/expo go/i);
      }
    }
  });
});
```

- [ ] **Step 3: Run the test to confirm RED**

Run:

```bash
pnpm --filter @sherizan/proto-cli test -- messages
```

Expected: the three new-key tests fail with `undefined`; the rebrand tests fail because messages still say `'Proto'`. The Expo Go test should pass already (no "Expo Go" strings present).

- [ ] **Step 4: Update `messages.ts`**

Open `packages/proto-cli/src/messages.ts`. Make these specific changes:

1. Change `startingHeader: 'Proto'` to `startingHeader: 'Prototo'`.
2. Change `designIntro: 'Proto'` to `designIntro: 'Prototo'`.
3. Replace `noConfig: 'Run this inside a Proto project.'` with `noConfig: 'Run this inside a Prototo project.'`.
4. Replace `portInUse: 'Proto is already running in another window. Close it first, then try again.'` with `portInUse: 'Prototo is already running in another window. Close it first, then try again.'`.
5. Replace `stoppedPrevious: 'Stopped a previous Proto session.'` with `stoppedPrevious: 'Stopped a previous Prototo session.'`.
6. Leave `generic: 'Something went wrong. Run: proto reset'` as-is — command name stays `proto`.
7. Replace `resetting: 'Resetting Proto'` with `resetting: 'Resetting Prototo'`.
8. Replace `resetDone: 'Proto reset. Run: proto start'` with `resetDone: 'Prototo reset. Run: proto start'`.
9. Replace `designInstallFailed: "Couldn't install the component library. Try again, or pick Proto."` with `designInstallFailed: "Couldn't install the component library. Try again, or pick Prototo."`.
10. Add these three new keys somewhere in the object (e.g. just above `generic`):

```ts
  installingPrototoApp: 'Setting up Prototo on the Simulator…',
  prototoAppOutdated:
    'This project needs a newer Prototo. Update Prototo from the App Store and try again.',
  prototoSimulatorOffline:
    "The Simulator's Prototo is older than this project. Connect to the internet, then run proto start to refresh it.",
```

Leave the `proto-cli` command name itself (`proto start`, `proto reset`, `proto edit`, `proto new-screen`) unchanged — the CLI binary stays `proto`.

- [ ] **Step 5: Run the test to confirm GREEN**

Run:

```bash
pnpm --filter @sherizan/proto-cli test -- messages
```

Expected: all message tests pass.

- [ ] **Step 6: Run the full proto-cli test suite to make sure nothing broke**

Run:

```bash
pnpm --filter @sherizan/proto-cli test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/proto-cli/src/messages.ts packages/proto-cli/src/messages.test.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): Prototo branding + simulator-binary copy

Rebrands user-facing strings from Proto to Prototo (CLI command name
stays proto for backwards compatibility on early users' machines).
Adds installingPrototoApp / prototoAppOutdated / prototoSimulatorOffline
strings for the new ensure-prototo-app helper.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 5: Build `ensure-prototo-app.ts` module (TDD)

**Files:**
- Create: `packages/proto-cli/src/ensure-prototo-app.ts`
- Create: `packages/proto-cli/src/ensure-prototo-app.test.ts`

This is the largest task. It builds the new module side-by-side with the old one; the old one stays in place until Task 6 deletes it.

- [ ] **Step 1: Write the failing test file**

Create `packages/proto-cli/src/ensure-prototo-app.test.ts` with:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensurePrototoAppMatchesProject,
  parsePrototoAppVersion,
  buildManifestUrl,
  buildTarballUrl,
  PROTOTO_APP_BUNDLE_ID,
  type Manifest,
  type Deps,
} from './ensure-prototo-app.js';

function makeProject(expoVersion: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ensure-prototo-'));
  const expoPkg = path.join(dir, 'node_modules', 'expo');
  fs.mkdirSync(expoPkg, { recursive: true });
  fs.writeFileSync(
    path.join(expoPkg, 'package.json'),
    JSON.stringify({ name: 'expo', version: expoVersion }),
  );
  return dir;
}

function makeCacheDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'proto-cache-'));
}

const VALID_MANIFEST: Manifest = {
  sdkMajor: 55,
  sha256: 'a'.repeat(64),
  builtAt: '2026-05-25T12:00:00Z',
};

describe('PROTOTO_APP_BUNDLE_ID', () => {
  it('is com.sherizan.prototo', () => {
    expect(PROTOTO_APP_BUNDLE_ID).toBe('com.sherizan.prototo');
  });
});

describe('parsePrototoAppVersion', () => {
  it('extracts CFBundleShortVersionString from the Prototo block', () => {
    const sample = `
      "some.other.app" = {
        CFBundleShortVersionString = "99.0.0";
      };
      "com.sherizan.prototo" = {
        ApplicationType = "User";
        CFBundleIdentifier = "com.sherizan.prototo";
        CFBundleShortVersionString = "55.0.1";
      };
    `;
    expect(parsePrototoAppVersion(sample)).toBe('55.0.1');
  });

  it('returns null when Prototo is not installed', () => {
    expect(parsePrototoAppVersion('"com.apple.notes" = { };')).toBe(null);
  });

  it('returns null when block has no version string', () => {
    expect(parsePrototoAppVersion('"com.sherizan.prototo" = { CFBundleIdentifier = "com.sherizan.prototo"; };')).toBe(
      null,
    );
  });
});

describe('buildManifestUrl / buildTarballUrl', () => {
  it('manifest URL uses GitHub Releases latest tag for the given SDK major', () => {
    expect(buildManifestUrl('55')).toBe(
      'https://github.com/sherizan/proto/releases/download/prototo-sim-sdk55-latest/manifest.json',
    );
  });

  it('tarball URL uses the same tag', () => {
    expect(buildTarballUrl('55')).toBe(
      'https://github.com/sherizan/proto/releases/download/prototo-sim-sdk55-latest/Prototo.app.tar.gz',
    );
  });
});

describe('ensurePrototoAppMatchesProject', () => {
  let project: string;
  let cacheDir: string;

  beforeEach(() => {
    project = makeProject('55.0.26');
    cacheDir = makeCacheDir();
  });

  afterEach(() => {
    if (fs.existsSync(project)) fs.rmSync(project, { recursive: true, force: true });
    if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  function joinArgs(args: string[]): string {
    return args.join(' ');
  }

  function makeDeps(overrides: Partial<Deps>): Deps {
    return {
      run: (cmd, args) => {
        const full = `${cmd} ${joinArgs(args)}`;
        if (full.includes('list devices booted')) return '(Booted) iOS 26.0';
        if (full.includes('listapps')) return '';
        return '';
      },
      fetch: vi.fn(async () => new Response(JSON.stringify(VALID_MANIFEST))),
      computeSha256: vi.fn(async () => VALID_MANIFEST.sha256),
      extractTarball: vi.fn(async (_archive, into) => {
        fs.mkdirSync(path.join(into, 'Prototo.app'), { recursive: true });
      }),
      cacheRoot: cacheDir,
      log: () => {},
      ...overrides,
    };
  }

  it('no-ops when no simulator is booted', async () => {
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          return '== Devices ==\n-- iOS 26.0 --\n';
        },
      }),
    });
    expect(calls.some((c) => c.includes('install'))).toBe(false);
  });

  it('no-ops when installed Prototo major matches project SDK', async () => {
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps'))
            return '"com.sherizan.prototo" = { CFBundleShortVersionString = "55.0.1"; };';
          return '';
        },
      }),
    });
    expect(calls.some((c) => c.includes('simctl install'))).toBe(false);
  });

  it('downloads + installs Prototo when missing on a booted simulator', async () => {
    const calls: string[] = [];
    const fetched: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps')) return ''; // not installed
          return '';
        },
        fetch: vi.fn(async (url: string) => {
          fetched.push(url);
          if (url.endsWith('manifest.json')) {
            return new Response(JSON.stringify(VALID_MANIFEST));
          }
          return new Response(new Uint8Array([]));
        }),
      }),
    });
    expect(fetched.some((u) => u.endsWith('manifest.json'))).toBe(true);
    expect(fetched.some((u) => u.endsWith('Prototo.app.tar.gz'))).toBe(true);
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
  });

  it('refreshes Prototo when major version mismatches', async () => {
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps'))
            return '"com.sherizan.prototo" = { CFBundleShortVersionString = "54.0.7"; };';
          return '';
        },
      }),
    });
    expect(calls.some((c) => c.includes('simctl uninstall booted com.sherizan.prototo'))).toBe(true);
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
  });

  it('uses cache when a matching tarball is already on disk', async () => {
    const entryDir = path.join(cacheDir, `55-${VALID_MANIFEST.sha256.slice(0, 12)}`);
    fs.mkdirSync(path.join(entryDir, 'Prototo.app'), { recursive: true });
    fs.writeFileSync(path.join(entryDir, 'manifest.json'), JSON.stringify(VALID_MANIFEST));

    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(VALID_MANIFEST)));
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        fetch: fetchSpy,
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps')) return ''; // not installed
          return '';
        },
      }),
    });
    const tarballFetches = fetchSpy.mock.calls.filter(([url]: [string]) =>
      typeof url === 'string' && url.endsWith('.tar.gz'),
    );
    expect(tarballFetches.length).toBe(0);
  });

  it('logs the prototoSimulatorOffline message when offline and cache is stale', async () => {
    const logs: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        fetch: vi.fn(async () => {
          throw new Error('ENOTFOUND github.com');
        }),
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps'))
            return '"com.sherizan.prototo" = { CFBundleShortVersionString = "54.0.7"; };';
          return '';
        },
        log: (m) => logs.push(m),
      }),
    });
    expect(logs.some((m) => m.includes('older than this project'))).toBe(true);
  });

  it('no-ops silently when xcrun is unavailable', async () => {
    await expect(
      ensurePrototoAppMatchesProject({
        cwd: project,
        deps: makeDeps({
          run: () => {
            throw new Error('xcrun: command not found');
          },
        }),
      }),
    ).resolves.toBeUndefined();
  });

  it('no-ops when project has no expo dep installed', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-empty-'));
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: empty,
      deps: makeDeps({
        run: (cmd, args) => {
          calls.push(`${cmd} ${joinArgs(args)}`);
          return '';
        },
      }),
    });
    expect(calls.length).toBe(0);
    fs.rmSync(empty, { recursive: true, force: true });
  });

  it('rejects a tarball whose sha256 does not match the manifest', async () => {
    const logs: string[] = [];
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify(VALID_MANIFEST));
      return new Response(new Uint8Array([1, 2, 3]));
    });
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        fetch: fetchSpy,
        computeSha256: vi.fn(async () => 'b'.repeat(64)),
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps')) return '';
          return '';
        },
        log: (m) => logs.push(m),
      }),
    });
    expect(logs.some((m) => m.toLowerCase().includes('hash'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm RED**

Run:

```bash
pnpm --filter @sherizan/proto-cli test -- ensure-prototo-app
```

Expected: all tests fail with "Cannot find module './ensure-prototo-app.js'".

- [ ] **Step 3: Implement `ensure-prototo-app.ts`**

Create `packages/proto-cli/src/ensure-prototo-app.ts` with:

```ts
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const PROTOTO_APP_BUNDLE_ID = 'com.sherizan.prototo';
const RELEASE_OWNER = 'sherizan';
const RELEASE_REPO = 'proto';

export type Manifest = {
  sdkMajor: number;
  sha256: string;
  builtAt: string;
};

export type RunCommand = (cmd: string, args: string[], opts?: { silent?: boolean }) => string;

export type Deps = {
  run: RunCommand;
  fetch: typeof fetch;
  computeSha256: (filePath: string) => Promise<string>;
  extractTarball: (archivePath: string, into: string) => Promise<void>;
  cacheRoot: string;
  log: (message: string) => void;
};

export type EnsureOptions = {
  cwd: string;
  deps?: Partial<Deps>;
};

const messageOffline =
  "The Simulator's Prototo is older than this project. Connect to the internet, then run proto start to refresh it.";
const messageInstalling = 'Setting up Prototo on the Simulator…';
const messageHashMismatch =
  "Couldn't verify the downloaded Prototo (hash mismatch). Run proto start again to retry.";

export function buildManifestUrl(sdkMajor: string): string {
  return `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/download/prototo-sim-sdk${sdkMajor}-latest/manifest.json`;
}

export function buildTarballUrl(sdkMajor: string): string {
  return `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/download/prototo-sim-sdk${sdkMajor}-latest/Prototo.app.tar.gz`;
}

export function parsePrototoAppVersion(simctlListAppsOutput: string): string | null {
  const bundleIdx = simctlListAppsOutput.indexOf(PROTOTO_APP_BUNDLE_ID);
  if (bundleIdx === -1) return null;
  const block = simctlListAppsOutput.slice(bundleIdx, bundleIdx + 2000);
  const match = block.match(/CFBundleShortVersionString\s*=\s*"?([0-9]+\.[0-9]+\.[0-9]+)"?/);
  return match?.[1] ?? null;
}

function readProjectExpoMajor(cwd: string): string | null {
  const pkgPath = path.join(cwd, 'node_modules', 'expo', 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (typeof pkg.version !== 'string') return null;
    return pkg.version.split('.')[0];
  } catch {
    return null;
  }
}

const defaultRun: RunCommand = (cmd, args, opts) =>
  execFileSync(cmd, args, { stdio: opts?.silent ? 'ignore' : 'pipe' }).toString();

async function defaultComputeSha256(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function defaultExtractTarball(archivePath: string, into: string): Promise<void> {
  fs.mkdirSync(into, { recursive: true });
  execFileSync('tar', ['-xzf', archivePath, '-C', into]);
}

function defaultCacheRoot(): string {
  return path.join(os.homedir(), '.prototo', 'cache');
}

function findCachedEntry(cacheRoot: string, sdkMajor: number, sha256: string): string | null {
  const entry = path.join(cacheRoot, `${sdkMajor}-${sha256.slice(0, 12)}`);
  const appPath = path.join(entry, 'Prototo.app');
  return fs.existsSync(appPath) ? entry : null;
}

export async function ensurePrototoAppMatchesProject(opts: EnsureOptions): Promise<void> {
  const deps: Deps = {
    run: opts.deps?.run ?? defaultRun,
    fetch: opts.deps?.fetch ?? fetch,
    computeSha256: opts.deps?.computeSha256 ?? defaultComputeSha256,
    extractTarball: opts.deps?.extractTarball ?? defaultExtractTarball,
    cacheRoot: opts.deps?.cacheRoot ?? defaultCacheRoot(),
    log: opts.deps?.log ?? (() => {}),
  };

  const projectMajor = readProjectExpoMajor(opts.cwd);
  if (!projectMajor) return;

  let booted = '';
  try {
    booted = deps.run('xcrun', ['simctl', 'list', 'devices', 'booted']);
  } catch {
    return;
  }
  if (!/Booted/.test(booted)) return;

  let apps = '';
  try {
    apps = deps.run('xcrun', ['simctl', 'listapps', 'booted']);
  } catch {
    return;
  }

  const installedVersion = parsePrototoAppVersion(apps);
  const installedMajor = installedVersion?.split('.')[0] ?? null;

  if (installedMajor && installedMajor === projectMajor) return; // up to date

  // Need to install or refresh.
  let manifest: Manifest | null = null;
  try {
    const res = await deps.fetch(buildManifestUrl(projectMajor));
    if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
    manifest = (await res.json()) as Manifest;
  } catch {
    deps.log(messageOffline);
    return;
  }
  if (!manifest) return;

  fs.mkdirSync(deps.cacheRoot, { recursive: true });
  const cached = findCachedEntry(deps.cacheRoot, manifest.sdkMajor, manifest.sha256);
  let appPath: string | null = null;

  if (cached) {
    appPath = path.join(cached, 'Prototo.app');
  } else {
    const tarballPath = path.join(deps.cacheRoot, `download-${Date.now()}.tar.gz`);
    try {
      const res = await deps.fetch(buildTarballUrl(projectMajor));
      if (!res.ok) throw new Error(`tarball fetch failed: ${res.status}`);
      const body = res.body;
      if (body) {
        await pipeline(
          Readable.fromWeb(body as unknown as import('node:stream/web').ReadableStream),
          fs.createWriteStream(tarballPath),
        );
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(tarballPath, buf);
      }
    } catch {
      deps.log(messageOffline);
      return;
    }

    const actualHash = await deps.computeSha256(tarballPath);
    if (actualHash !== manifest.sha256) {
      deps.log(messageHashMismatch);
      fs.rmSync(tarballPath, { force: true });
      return;
    }

    const entryDir = path.join(deps.cacheRoot, `${manifest.sdkMajor}-${manifest.sha256.slice(0, 12)}`);
    await deps.extractTarball(tarballPath, entryDir);
    fs.writeFileSync(path.join(entryDir, 'manifest.json'), JSON.stringify(manifest));
    fs.rmSync(tarballPath, { force: true });
    appPath = path.join(entryDir, 'Prototo.app');
  }

  if (installedVersion) {
    try {
      deps.run('xcrun', ['simctl', 'uninstall', 'booted', PROTOTO_APP_BUNDLE_ID], { silent: true });
    } catch {
      // best-effort
    }
  }

  deps.log(messageInstalling);
  try {
    deps.run('xcrun', ['simctl', 'install', 'booted', appPath]);
  } catch {
    // Surface as silent failure; expo start will still try to run.
  }
}
```

- [ ] **Step 4: Run the test to confirm GREEN**

Run:

```bash
pnpm --filter @sherizan/proto-cli test -- ensure-prototo-app
```

Expected: all tests pass.

- [ ] **Step 5: Run the full test suite**

Run:

```bash
pnpm --filter @sherizan/proto-cli test
```

Expected: all tests pass, including the still-present `ensure-expo-go` tests.

- [ ] **Step 6: Commit**

```bash
git add packages/proto-cli/src/ensure-prototo-app.ts packages/proto-cli/src/ensure-prototo-app.test.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): add ensure-prototo-app helper

New simulator helper that fetches the Prototo dev-client binary from
GitHub Releases (tag prototo-sim-sdk<major>-latest), verifies its
SHA256 against a manifest, caches under ~/.prototo/cache/, and
installs via xcrun simctl. Falls back to a designer-friendly offline
message when fetch fails. Old ensure-expo-go module stays in place
until the call site swaps over.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 6: Wire `ensure-prototo-app` into `start.ts`; delete `ensure-expo-go`

**Files:**
- Modify: `packages/proto-cli/src/start.ts`
- Delete: `packages/proto-cli/src/ensure-expo-go.ts`
- Delete: `packages/proto-cli/src/ensure-expo-go.test.ts`

- [ ] **Step 1: Update `start.ts` imports + call site**

Open `packages/proto-cli/src/commands/start.ts`. Make these two changes:

- Replace the import line `import { ensureExpoGoMatchesProject } from '../ensure-expo-go.js';` with `import { ensurePrototoAppMatchesProject } from '../ensure-prototo-app.js';`.
- Replace the call `ensureExpoGoMatchesProject({ cwd: config.root, log: (m) => console.log(m) });` with `await ensurePrototoAppMatchesProject({ cwd: config.root, deps: { log: (m) => console.log(m) } });`.

(Note: the call now needs `await` because the helper is async. The surrounding `runStart` is already `async`.)

- [ ] **Step 2: Delete the old module + test file**

Run:

```bash
git rm packages/proto-cli/src/ensure-expo-go.ts packages/proto-cli/src/ensure-expo-go.test.ts
```

Expected: both files staged for deletion.

- [ ] **Step 3: Type-check + run tests**

Run:

```bash
pnpm --filter @sherizan/proto-cli typecheck && pnpm --filter @sherizan/proto-cli test
```

Expected: typecheck exits 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/proto-cli/src/commands/start.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): swap ensure-expo-go for ensure-prototo-app in start

proto start now uses the Prototo dev-client helper. The old
ensure-expo-go module is removed; Expo Go is no longer part of the
designer-facing flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 7: Update `expo-spawn.ts` to `--dev-client` (TDD)

**Files:**
- Modify: `packages/proto-cli/src/expo-spawn.ts`
- Modify: `packages/proto-cli/src/expo-spawn.test.ts`

- [ ] **Step 1: Update the test expectation**

Open `packages/proto-cli/src/expo-spawn.test.ts`. Change the line:

```ts
    expect(calls).toEqual([{ cmd: 'npx', args: ['expo', 'start', '--ios'], cwd: '/tmp/x' }]);
```

to:

```ts
    expect(calls).toEqual([
      { cmd: 'npx', args: ['expo', 'start', '--dev-client', '--ios'], cwd: '/tmp/x' },
    ]);
```

And update the surrounding `it()` description: `'invokes spawn function with npx expo start --ios and the configured cwd'` → `'invokes spawn function with npx expo start --dev-client --ios and the configured cwd'`.

- [ ] **Step 2: Run the test to confirm RED**

Run:

```bash
pnpm --filter @sherizan/proto-cli test -- expo-spawn
```

Expected: the first test fails on the args mismatch.

- [ ] **Step 3: Update `expo-spawn.ts`**

Open `packages/proto-cli/src/expo-spawn.ts`. Change:

```ts
  const child = fn('npx', ['expo', 'start', '--ios'], { cwd: options.cwd });
```

to:

```ts
  const child = fn('npx', ['expo', 'start', '--dev-client', '--ios'], { cwd: options.cwd });
```

- [ ] **Step 4: Run the test to confirm GREEN**

Run:

```bash
pnpm --filter @sherizan/proto-cli test -- expo-spawn
```

Expected: all expo-spawn tests pass.

- [ ] **Step 5: Run full test suite**

Run:

```bash
pnpm --filter @sherizan/proto-cli test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/proto-cli/src/expo-spawn.ts packages/proto-cli/src/expo-spawn.test.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): expo start --dev-client --ios

Tells Expo to target the custom dev client (Prototo) instead of Expo
Go. Combined with template scheme=prototo, the printed QR now uses
the prototo:// scheme.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 8: Audit `error-translation.ts` and template for stray Expo Go strings

**Files:**
- Modify (audit-only, possibly no changes): `packages/proto-cli/src/error-translation.ts`
- Modify (audit-only, possibly no changes): `packages/create-proto/template/CLAUDE.md`
- Modify: `packages/create-proto/template/README.md`

- [ ] **Step 1: Grep for stray Expo Go references**

Run:

```bash
grep -rn -i "expo go\|expo-go" packages/proto-cli/src packages/create-proto/template
```

Expected: zero matches in `packages/proto-cli/src` (Task 4 + Task 6 should have cleaned those up). May still appear in `packages/create-proto/template` — verify.

- [ ] **Step 2: If any match exists, rebrand it**

For each match: open the file, replace the "Expo Go" mention with either "Prototo" (if it's referring to the dev client) or remove the sentence entirely (if it was an Expo Go-specific workaround). Prefer surgical edits — preserve surrounding copy.

If no matches: skip step 2.

- [ ] **Step 3: Add App Store install line to template README**

Open `packages/create-proto/template/README.md`. Replace its contents with:

```markdown
# {{name}}

Built with Prototo.

Before running `proto start` on iPhone, install Prototo from the App Store.

Run `proto start` to preview on the iOS Simulator (auto) or your iPhone (scan QR).
Run `proto add "describe a screen"` to generate a new screen.
```

- [ ] **Step 4: Type-check + tests**

Run:

```bash
pnpm --filter @sherizan/proto-cli typecheck && pnpm --filter @sherizan/proto-cli test && pnpm --filter @sherizan/create-proto test
```

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src packages/create-proto/template
git commit -m "$(cat <<'EOF'
chore: remove residual Expo Go references; add App Store install hint

Template README now points designers at the App Store for the iPhone
install path. CLI source confirmed clean of Expo Go strings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds (skip if no changes to commit beyond README).

---

## Task 9: Implement `release-simulator.ts` script

**Files:**
- Create: `apps/prototo-app/scripts/release-simulator.ts`

Maintainer-only release tool. Not TDD'd (shells out to `eas`, `gh`, `tar`, `curl`); exercised end-to-end in Task 12. Uses `execFileSync` exclusively (no shell-string interpolation, no `execSync`).

- [ ] **Step 1: Create the script file**

Create `apps/prototo-app/scripts/release-simulator.ts` with:

```ts
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const SDK_MAJOR = readSdkMajor();
const TAG_PREFIX = `prototo-sim-sdk${SDK_MAJOR}`;
const LATEST_TAG = `${TAG_PREFIX}-latest`;

function readSdkMajor(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  const expoSpec: string | undefined = pkg.dependencies?.expo;
  if (!expoSpec) throw new Error('expo dep not found in apps/prototo-app/package.json');
  const m = expoSpec.match(/(\d+)\./);
  if (!m) throw new Error(`could not parse expo version from ${expoSpec}`);
  return m[1];
}

function shInherit(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

function shCapture(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: 'utf8' }).trim();
}

function nextBuildNumber(): number {
  try {
    const out = shCapture('gh', ['release', 'list', '--limit', '100', '--json', 'tagName']);
    const tags: { tagName: string }[] = JSON.parse(out);
    const numbers = tags
      .map((t) => {
        const m = t.tagName.match(new RegExp(`^${TAG_PREFIX}-(\\d+)$`));
        return m ? Number(m[1]) : null;
      })
      .filter((n): n is number => n !== null);
    return numbers.length ? Math.max(...numbers) + 1 : 1;
  } catch {
    return 1;
  }
}

async function main(): Promise<void> {
  const build = nextBuildNumber();
  const tag = `${TAG_PREFIX}-${build}`;
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prototo-release-'));

  console.log(`==> Resolving most recent development-simulator EAS build`);
  const easJson = shCapture('eas', [
    'build:list',
    '--platform',
    'ios',
    '--status',
    'finished',
    '--limit',
    '10',
    '--json',
    '--non-interactive',
  ]);
  const builds: Array<{ id: string; profile: string; artifacts?: { applicationArchiveUrl?: string } }> =
    JSON.parse(easJson);
  const simBuild = builds.find((b) => b.profile === 'development-simulator');
  if (!simBuild?.artifacts?.applicationArchiveUrl) {
    throw new Error(
      'No finished development-simulator build found. Run: eas build --platform ios --profile development-simulator',
    );
  }

  console.log(`==> Downloading artifact from EAS (build ${simBuild.id})`);
  const downloadedPath = path.join(workDir, 'eas-artifact.tar.gz');
  shInherit('curl', ['-L', '-o', downloadedPath, simBuild.artifacts.applicationArchiveUrl]);

  console.log(`==> Re-packing as Prototo.app.tar.gz`);
  const unpackDir = path.join(workDir, 'unpack');
  fs.mkdirSync(unpackDir, { recursive: true });
  shInherit('tar', ['-xzf', downloadedPath, '-C', unpackDir]);
  const appName = fs.readdirSync(unpackDir).find((n) => n.endsWith('.app'));
  if (!appName) throw new Error(`No .app found inside ${downloadedPath}`);
  if (appName !== 'Prototo.app') {
    fs.renameSync(path.join(unpackDir, appName), path.join(unpackDir, 'Prototo.app'));
  }
  const finalTarball = path.join(workDir, 'Prototo.app.tar.gz');
  shInherit('tar', ['-czf', finalTarball, '-C', unpackDir, 'Prototo.app']);

  console.log(`==> Computing SHA256`);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(finalTarball)).digest('hex');

  console.log(`==> Writing manifest`);
  const manifest = {
    sdkMajor: Number(SDK_MAJOR),
    sha256,
    builtAt: new Date().toISOString(),
  };
  const manifestPath = path.join(workDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`==> Creating GitHub release ${tag}`);
  shInherit('gh', [
    'release',
    'create',
    tag,
    '--title',
    tag,
    '--notes',
    `Prototo simulator binary for Expo SDK ${SDK_MAJOR}`,
    finalTarball,
    manifestPath,
  ]);

  console.log(`==> Updating ${LATEST_TAG} pointer`);
  try {
    shInherit('gh', ['release', 'delete', LATEST_TAG, '--yes', '--cleanup-tag']);
  } catch {
    // first run — no -latest to delete
  }
  shInherit('gh', [
    'release',
    'create',
    LATEST_TAG,
    '--title',
    LATEST_TAG,
    '--notes',
    `Pointer to ${tag}`,
    finalTarball,
    manifestPath,
  ]);

  console.log(`✓ Released ${tag} and updated ${LATEST_TAG}`);
  console.log(
    `  Manifest: https://github.com/sherizan/proto/releases/download/${LATEST_TAG}/manifest.json`,
  );
  console.log(
    `  Tarball:  https://github.com/sherizan/proto/releases/download/${LATEST_TAG}/Prototo.app.tar.gz`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Sanity-type-check the script**

Run:

```bash
cd apps/prototo-app && pnpm exec tsc --noEmit --module nodenext --target es2022 --moduleResolution nodenext --skipLibCheck scripts/release-simulator.ts && cd -
```

Expected: exits 0. If tsc complains about missing globals (`fetch`, `crypto`), the script still runs fine under tsx — typecheck failures here are non-blocking.

- [ ] **Step 3: Commit**

```bash
git add apps/prototo-app/scripts/release-simulator.ts
git commit -m "$(cat <<'EOF'
feat(prototo-app): release-simulator maintainer script

Downloads the most recent finished development-simulator EAS build,
re-packs as Prototo.app.tar.gz, computes SHA256, writes manifest.json,
publishes to GitHub Releases under prototo-sim-sdk<major>-<n>, and
updates the -latest tag pointer that proto-cli reads. Uses execFileSync
with arg arrays (no shell interpolation).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 10: Master doc rebrand sweep

**Files:**
- Modify: `docs/proto-master.md`

- [ ] **Step 1: Replace "Proto App" → "Prototo App"**

Run:

```bash
sed -i '' 's/Proto App/Prototo App/g' docs/proto-master.md
```

Verify with:

```bash
grep -n "Proto App" docs/proto-master.md
```

Expected: zero matches.

- [ ] **Step 2: Update the file-structure block**

Open `docs/proto-master.md`, find the §11/§14 file-structure block (around line ~1586: `proto-app/        ← Expo custom dev client (Phase 2, stub for now)`). Replace `proto-app/` with `prototo-app/`. Update the trailing comment to remove "(Phase 2, stub for now)" — it's no longer a stub.

If similar `proto-app/` references appear elsewhere in code blocks within the master doc, update those too. Verify with:

```bash
grep -n "proto-app/" docs/proto-master.md
```

Expected: zero matches (all should be `prototo-app/` now).

- [ ] **Step 3: Update bundle ID references**

Run:

```bash
sed -i '' 's/com\.sherizan\.proto\b/com.sherizan.prototo/g' docs/proto-master.md
```

Verify:

```bash
grep -n "com.sherizan.proto" docs/proto-master.md
```

Expected: only `com.sherizan.prototo` matches remain.

- [ ] **Step 4: Remove stale Expo Go preview-surface copy**

Open `docs/proto-master.md`. Find lines that frame Expo Go as the preview surface (per earlier grep: line 140, 181–182, 1412, 1425, 1467–1468). For each, rewrite to reflect that Prototo is the only preview surface on both Simulator and iPhone:

- Line 140 area: "iOS Simulator primary for Phase 1+2, physical device via Expo Go / Proto App as fallback" → "iOS Simulator primary throughout; physical device via Prototo App."
- Lines 181–182 area: collapse to a single line: "Preview surface: Prototo App on Simulator (auto-installed) and iPhone (App Store)."
- Line 1412 area (install-Expo-Go QR copy): rewrite the example block to use the single-QR Prototo flow.

If any of those lines have already been updated by previous refactors, skip.

- [ ] **Step 5: Add a decisions-log entry**

Find the decisions-log section of `docs/proto-master.md` (toward the end). Add this entry at the top of the log (most-recent-first ordering):

```markdown
**2026-05-25 — Prototo App dev-client refinement.**
- Brand rename Proto → Prototo across folder, bundle ID, scheme, display name.
- Single-QR onboarding (supersedes the two-QR Step-1/Step-2 model from 2026-05-22 onboarding spec).
- Designer install path: App Store only. No TestFlight, no public EAS sideload. Maintainer pre-launch testing uses EAS development profile + UDID-registered sideload.
- Simulator binary auto-distributed via GitHub Releases tag prototo-sim-sdk<major>-latest, fetched + cached + installed by proto-cli on first proto start.
- SDK-bump pain on iPhone surfaces as an in-app "Update Prototo" screen gated by App Store update.
- See: docs/superpowers/specs/2026-05-25-prototo-app-dev-client-design.md.
```

- [ ] **Step 6: Verify the doc is internally consistent**

Run:

```bash
grep -n "Proto App\|proto-app/\|com.sherizan.proto\b\|Expo Go" docs/proto-master.md
```

Expected: zero matches (or only matches that are clearly historical / in-quotes / part of the decisions log).

- [ ] **Step 7: Commit**

```bash
git add docs/proto-master.md
git commit -m "$(cat <<'EOF'
docs(master): Prototo App rebrand + dev-client decisions

Proto App -> Prototo App throughout. Bundle id com.sherizan.proto ->
com.sherizan.prototo. File structure block updated. Stale Expo Go
preview-surface copy replaced. Adds a 2026-05-25 decisions-log entry
summarising the dev-client refinement.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 11: Sync sibling specs

**Files:**
- Modify: `docs/superpowers/specs/2026-05-22-proto-app-dev-client-design.md`
- Modify: `docs/superpowers/specs/2026-05-22-onboarding-redesign-design.md`
- Modify: `docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md`

- [ ] **Step 1: Mark the 2026-05-22 dev-client spec superseded**

Open `docs/superpowers/specs/2026-05-22-proto-app-dev-client-design.md`. Insert the following two lines immediately after the existing `> Date: ...` line at the top:

```markdown
> **Status: SUPERSEDED by `docs/superpowers/specs/2026-05-25-prototo-app-dev-client-design.md`.**
> Kept as historical record. Do not implement from this doc.
```

- [ ] **Step 2: Annotate the 2026-05-22 onboarding spec**

Open `docs/superpowers/specs/2026-05-22-onboarding-redesign-design.md`. Insert immediately after the `> Status: design locked, plan pending. Date: 2026-05-22.` line at the top:

```markdown
> **Update 2026-05-25:** The two-QR Step-1/Step-2 architecture in §1 + §2 is superseded by the single-QR model in `2026-05-25-prototo-app-dev-client-design.md`. Copy patterns, terminal output style, and friction analysis in this spec remain canonical.
```

- [ ] **Step 3: Sync the 2026-05-24 share-landing spec**

Run:

```bash
sed -i '' 's/Proto App/Prototo App/g' docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md
sed -i '' 's/com\.sherizan\.proto\b/com.sherizan.prototo/g' docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md
sed -i '' 's|apps/proto-app/|apps/prototo-app/|g' docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md
```

Verify:

```bash
grep -n "Proto App\|com\.sherizan\.proto\b\|apps/proto-app/" docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md
```

Expected: zero matches.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-05-22-proto-app-dev-client-design.md docs/superpowers/specs/2026-05-22-onboarding-redesign-design.md docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md
git commit -m "$(cat <<'EOF'
docs(specs): sync sibling specs with Prototo rebrand

- 2026-05-22 dev-client spec: marked superseded
- 2026-05-22 onboarding spec: noted two-QR -> single-QR architecture shift
- 2026-05-24 share-landing spec: Proto App -> Prototo App, bundle id, folder path

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 12: First EAS `development-simulator` build + publish to GitHub Releases

Maintainer-time task. Each step ends with a clearly observable result.

**Prereqs (verify, don't automate):**
- `eas` CLI installed and logged in (`eas whoami` succeeds).
- `gh` CLI installed and logged in to a token with `repo` scope (`gh auth status` succeeds).
- Apple Developer account active.

- [ ] **Step 1: Trigger the simulator build**

Run:

```bash
cd apps/prototo-app && pnpm run build:ios:sim && cd -
```

Expected: EAS prompts (first time only) to register the new slug `prototo-app` under owner `sherizan` and creates a fresh project ID. Accept. Build queues. Note the build ID. Queue time can be 5–30 minutes on free tier.

- [ ] **Step 2: Wait for the build to finish**

Run:

```bash
cd apps/prototo-app && pnpm exec eas build:list --platform ios --status finished --limit 5 --json --non-interactive && cd -
```

Expected: the just-finished build appears with `profile: "development-simulator"`. If status is still `IN_PROGRESS` / `IN_QUEUE`, wait and re-run.

- [ ] **Step 3: Publish to GitHub Releases**

Run:

```bash
cd apps/prototo-app && pnpm run release:simulator && cd -
```

Expected: script prints `✓ Released prototo-sim-sdk55-1 and updated prototo-sim-sdk55-latest` (build number may differ). Two GitHub releases exist on the repo.

- [ ] **Step 4: Verify URLs are reachable**

Run:

```bash
curl -fsSL https://github.com/sherizan/proto/releases/download/prototo-sim-sdk55-latest/manifest.json
```

Expected: prints JSON `{ "sdkMajor": 55, "sha256": "...", "builtAt": "..." }`.

```bash
curl -fsSI https://github.com/sherizan/proto/releases/download/prototo-sim-sdk55-latest/Prototo.app.tar.gz | head -1
```

Expected: HTTP `302` (redirect to GitHub asset storage) or `200`.

- [ ] **Step 5: End-to-end smoke test the simulator path**

In a fresh temp directory:

```bash
cd /tmp && rm -rf prototo-e2e && npm create proto@latest prototo-e2e
```

Inside the project, run `proto start`. Expected observable result:

- `ensurePrototoAppMatchesProject` logs `Setting up Prototo on the Simulator…` on first run
- Simulator boots, Prototo opens, welcome screen renders

If Prototo opens but the welcome screen fails to load, that points at a scheme/template mismatch — a regression in Tasks 3 or 7, not a Task-12 failure.

- [ ] **Step 6: Commit (if any state changed)**

If `eas.json` or `app.json` was touched by EAS during the first build (e.g., a fresh `extra.eas.projectId` written back), commit those changes:

```bash
git add apps/prototo-app
git commit -m "$(cat <<'EOF'
chore(prototo-app): provision EAS project id under prototo-app slug

First eas build under the renamed slug. EAS-generated project id is
checked in so future builds resume against the same project.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Otherwise skip this step.

---

## Task 13: First EAS `development` build + sideload + iPhone Liquid Glass validation

Maintainer-time. Requires maintainer's iPhone with UDID registered in the Apple Developer account.

- [ ] **Step 1: Register UDID in Apple Developer**

One-time setup outside the CLI:
1. iPhone Settings → General → About → copy serial / use Apple Configurator 2 to retrieve UDID.
2. developer.apple.com → Certificates, Identifiers & Profiles → Devices → add the UDID.
3. In EAS dashboard or via `eas device:create`, register the device for the `development` profile.

If already registered: skip.

- [ ] **Step 2: Trigger the device build**

Run:

```bash
cd apps/prototo-app && pnpm run build:ios && cd -
```

Expected: EAS builds, returns build URL + install URL (contains session token). Note the install URL.

- [ ] **Step 3: Sideload onto the iPhone**

On the iPhone, open the EAS install URL in Safari, tap "Install", complete the iOS dialog. Prototo icon appears on the home screen.

Expected: home-screen icon labelled "Prototo", launches without crash, shows the dev-client development host UI.

- [ ] **Step 4: Wire up project and scan QR**

On the Mac, in the `prototo-e2e` project from Task 12 Step 5:

```bash
cd /tmp/prototo-e2e && pnpm proto start
```

Expected: prints a single QR. Scan with iPhone Camera. iOS routes to Prototo via `prototo://` (no Expo-Go-style "select dev client" picker). Prototo loads bundle from Mac's LAN IP. Welcome screen renders.

- [ ] **Step 5: Confirm visible Liquid Glass refraction**

On the loaded prototype:
- Open a screen with `Card glass={true}`. Scroll content behind it.
- Expected: visible refractive material with content distortion (not flat gray).
- Open a screen with the native large-title `Stack` nav bar.
- Expected: Liquid Glass material visible on the nav bar as content scrolls underneath.

If either check fails, file an issue capturing iOS version, EAS build ID, screenshot. **Do not** mark this task complete.

- [ ] **Step 6: Document the install URL out-of-band**

EAS internal install URL is maintainer-private. Save to a private location (e.g. 1Password). Do not commit.

- [ ] **Step 7: No-op commit if nothing changed**

Skip the commit step unless `app.json` / `eas.json` were modified.

---

## Task 14: Final E2E + DoD checklist signoff

**Files:**
- Modify: DoD checklist inside `docs/superpowers/specs/2026-05-25-prototo-app-dev-client-design.md`

- [ ] **Step 1: Walk the spec DoD**

Open `docs/superpowers/specs/2026-05-25-prototo-app-dev-client-design.md`, scroll to "Definition of done". For each checkbox:

- Folder rename → confirmed in Task 1
- `MinimumOSVersion: 26.0` + `associatedDomains` → confirmed in Task 1 Step 3
- `eas.json` four profiles → confirmed in Task 2
- `pnpm release:simulator` publishes → confirmed in Task 12 Step 3
- `ensure-prototo-app` exists → confirmed in Task 5 + 6
- `spawnExpo` uses `--dev-client --ios` → confirmed in Task 7
- Template scheme `prototo` → confirmed in Task 3
- Master doc rebrand → confirmed in Task 10
- 2026-05-22 dev-client spec superseded → confirmed in Task 11
- 2026-05-22 onboarding spec annotated → confirmed in Task 11
- 2026-05-24 share-landing spec synced → confirmed in Task 11
- Maintainer EAS dev sideload + iPhone Liquid Glass → confirmed in Task 13 Step 5
- Fresh-machine Simulator E2E → confirmed in Task 12 Step 5
- Zero "Expo Go" in designer-facing copy → confirmed in Task 8 Step 1
- All proto-cli tests pass → re-run in Step 2 below
- App Store submission filed → out of scope; tracked separately under Phase 3 sub-unit F

Update the spec file inline: convert each `[ ]` → `[x]` for items now satisfied.

- [ ] **Step 2: Re-run all tests one final time**

Run:

```bash
pnpm --filter @sherizan/proto-cli test && pnpm --filter @sherizan/create-proto test
```

Expected: all green.

- [ ] **Step 3: Re-run the grep audits**

Run:

```bash
grep -rn -i "expo go\|expo-go" packages/proto-cli/src packages/create-proto/template apps/prototo-app
grep -rn "apps/proto-app/" docs packages apps
grep -rn "com\.sherizan\.proto\b" docs packages apps
```

Expected: zero matches across all three.

- [ ] **Step 4: Final commit signing off DoD**

```bash
git add docs/superpowers/specs/2026-05-25-prototo-app-dev-client-design.md
git commit -m "$(cat <<'EOF'
docs(spec): Prototo App dev-client DoD complete

All Definition of Done items satisfied except App Store submission
(tracked separately under Phase 3 sub-unit F). Spec checkboxes
updated in-place to reflect shipped state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds, `git status` clean.

---

## Notes for the executor

- **Order matters between Tasks 1–11 only loosely.** Tasks 4–7 (proto-cli) are independent of Tasks 1–3 (folder + template); they can be reordered. Tasks 10–11 (docs) can land any time after Tasks 1–9. Tasks 12–14 require Tasks 1, 2, 3, 9 done.
- **If `eas` or `gh` is unavailable on the executor's machine**, Tasks 12 and 13 must be deferred to the maintainer's machine. Tasks 1–11 ship as a clean PR without 12–13; mark Task 14 as "pending Tasks 12–13 on maintainer machine" and surface that explicitly.
- **The first EAS build under the new slug** will prompt to register the new project ID interactively. If the executor is not the account owner, pause for human input rather than guessing.
- **Liquid Glass visibility on Simulator (Task 12 Step 5)** is unknown. If the welcome screen renders but Liquid Glass looks flat on Simulator, that is acceptable — the device check in Task 13 Step 5 is the load-bearing visual proof.
