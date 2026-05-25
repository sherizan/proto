# Prototo App Viewer-Mode Handler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add viewer-mode routing to Prototo App so tapping a `https://prototo.app/p/<token>` link (universal link) or `prototo://p/<token>` (scheme fallback) on iPhone opens Prototo directly and loads the designer's prototype via the cloudflared tunnel.

**Architecture:** New `app/p/[token].tsx` route receives the token, calls a small `lib/share-lookup.ts` unit to GET `/api/share/<token>` from `prototo.app`, then calls a small `lib/viewer-redirect.ts` unit that emits `Linking.openURL('prototo://expo-development-client/?url=<encoded-tunnel-url>')`. The native expo-dev-client intercepts that URL at the iOS layer before expo-router sees it and loads the bundle. The existing creator-mode screen at `app/index.tsx` stays unchanged; a new `app/_layout.tsx` hosts both routes with `headerShown: false`. AASA file in the sibling `prototo-website` repo gets its `appID` corrected.

**Tech Stack:** TypeScript ESM, Expo SDK 55, expo-router, expo-dev-client. Vitest for the logic unit tests (added to `apps/prototo-app/`'s devDeps). Zod for share-lookup body validation (matches the proto-cli pattern from D).

**Spec:** `docs/superpowers/specs/2026-05-25-prototo-viewer-mode-design.md`

---

## File map

**Files to create in `/Users/sherizan/Public/proto/apps/prototo-app/`:**

- `app/_layout.tsx` — root Stack layout
- `app/p/[token].tsx` — viewer-mode entry
- `lib/share-lookup.ts` — HTTP + zod
- `lib/share-lookup.test.ts`
- `lib/viewer-redirect.ts` — URL construction + Linking call
- `lib/viewer-redirect.test.ts`
- `vitest.config.ts` — minimal config (so the workspace test runner picks up our `.test.ts` files)

**Files to modify in `/Users/sherizan/Public/proto/apps/prototo-app/`:**

- `package.json` — version bump `0.1.0` → `0.2.0`; add `zod@^3.23.8` to deps; add `vitest@^2.1.4` + `@vitest/coverage-v8@^2.1.4` to devDeps; add `test` script

**Files unchanged:**

- `app/index.tsx` — existing creator-mode welcome screen, inherits the new layout
- `app.json` — already has `scheme: "prototo"`, `associatedDomains`, `MinimumOSVersion`
- `eas.json` — build profiles unchanged

**Files to modify in `/Users/sherizan/Public/prototo/` (sibling website repo):**

- `public/.well-known/apple-app-site-association` — `appID` from `BEJ53HUAE7.com.sherizan.proto` → `BEJ53HUAE7.com.sherizan.prototo`

---

## Conventions used in this plan

- **Primary working directory** for shell commands: `/Users/sherizan/Public/proto` unless stated otherwise. Tasks that touch the sibling website repo explicitly `cd /Users/sherizan/Public/prototo`.
- **Branch in proto repo**: all work on `feat/prototo-viewer-mode` (created in Task 1).
- **Branch in prototo-website repo**: all work on `feat/aasa-bundle-id-fix` (created in Task 8).
- **Test runner**: `pnpm --filter prototo-app test` (vitest, added in Task 1).
- **Commit cadence**: one commit per task. Imperative subject. Co-Authored-By trailer (the user's established convention).
- **TDD**: `lib/` units follow TDD strict (failing test → run RED → implement → run GREEN → commit). `app/p/[token].tsx` is a visual surface (loading + error states with Liquid Glass card) — skip TDD per CLAUDE.md component rule; validate on device.

---

## Task 1: Branch + version bump + add zod + vitest

**Files:**
- Modify: `apps/prototo-app/package.json`
- Create: `apps/prototo-app/vitest.config.ts`

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feat/prototo-viewer-mode
```

Expected: `Switched to a new branch 'feat/prototo-viewer-mode'`.

- [ ] **Step 2: Update `apps/prototo-app/package.json`**

Replace its contents with:

```json
{
  "name": "prototo-app",
  "version": "0.2.0",
  "private": true,
  "description": "Prototo — custom Expo dev client. Designer canvas for proto start on Simulator and iPhone. Renders real iOS 26 Liquid Glass.",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --dev-client",
    "ios": "expo run:ios",
    "test": "vitest run",
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
    "expo-clipboard": "~55.0.13",
    "expo-dev-client": "~55.0.35",
    "expo-glass-effect": "~55.0.11",
    "expo-haptics": "~55.0.14",
    "expo-router": "~55.0.16",
    "expo-status-bar": "~55.0.6",
    "expo-symbols": "~55.0.9",
    "react": "19.2.0",
    "react-native": "0.83.6",
    "react-native-gesture-handler": "~2.30.1",
    "react-native-reanimated": "4.2.1",
    "react-native-safe-area-context": "5.6.2",
    "react-native-screens": "4.23.0",
    "react-native-worklets": "0.7.4",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/node": "^20.12.0",
    "@types/react": "~19.2.15",
    "@vitest/coverage-v8": "^2.1.4",
    "babel-preset-expo": "~55.0.22",
    "tsx": "^4.15.0",
    "typescript": "^5.9.2",
    "vitest": "^2.1.4"
  }
}
```

Changes from previous: `version` bumped, `zod` added to deps, `vitest` + `@vitest/coverage-v8` added to devDeps, `test` script added, `dependencies` keys re-sorted alphabetically (`zod` slots after `react-native-worklets`).

- [ ] **Step 3: Create `vitest.config.ts`**

Create `apps/prototo-app/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
```

Vitest auto-discovers `lib/**/*.test.ts`. Node env is fine — we're testing logic functions that don't touch React Native runtime APIs directly (Linking is injected as a dep).

- [ ] **Step 4: Install + verify**

```bash
pnpm install 2>&1 | tail -3
```

Expected: lockfile updates without error. Pre-existing peer warnings unrelated.

- [ ] **Step 5: Verify the (currently empty) test command runs cleanly**

```bash
pnpm --filter prototo-app test 2>&1 | tail -5
```

Expected: vitest runs and reports "No test files found, exiting with code 1" — that's fine, no tests yet. Will pass once Task 2 lands.

- [ ] **Step 6: Commit**

```bash
git add apps/prototo-app/package.json apps/prototo-app/vitest.config.ts pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(prototo-app): add vitest + zod, bump version to 0.2.0

Stages the viewer-mode feature. Vitest runs the lib/ unit tests
(matches the proto-cli pattern); zod validates the /api/share/<token>
response body.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds. `git status` clean (except pre-existing apps/prototo-app/assets/ working-tree state which we leave alone).

---

## Task 2: `lib/share-lookup.ts` — HTTP + zod (TDD)

**Files:**
- Create: `apps/prototo-app/lib/share-lookup.ts`
- Create: `apps/prototo-app/lib/share-lookup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/prototo-app/lib/share-lookup.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { lookupShare, ShareLookupError, SHARE_API_BASE } from './share-lookup';

const VALID_BODY = {
  designerName: 'Sheri',
  appName: 'Atlas',
  screenCount: 7,
  theme: 'liquid-glass' as const,
  tunnelUrl: 'https://abc.trycloudflare.com',
  createdAt: '2026-05-25T00:00:00.000Z',
  expiresAt: '2026-06-01T00:00:00.000Z',
};

describe('SHARE_API_BASE', () => {
  it('points at the prototo.app production host', () => {
    expect(SHARE_API_BASE).toBe('https://prototo.app');
  });
});

describe('lookupShare', () => {
  it('GETs /api/share/<token> and returns the parsed body', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => VALID_BODY,
    })) as unknown as typeof fetch;

    const result = await lookupShare('xk92m', { fetch: fetchSpy });
    expect(result).toEqual(VALID_BODY);
    const [url] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://prototo.app/api/share/xk92m');
  });

  it('throws ShareLookupError with kind="expired" on 404', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      name: 'ShareLookupError',
      kind: 'expired',
    });
  });

  it('throws ShareLookupError with kind="unreachable" on 5xx', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'unreachable',
    });
  });

  it('throws ShareLookupError with kind="unreachable" when fetch rejects', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'unreachable',
    });
  });

  it('throws ShareLookupError with kind="unreachable" when response schema is invalid', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ designerName: 'only-this' }),
    })) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'unreachable',
    });
  });

  it('rejects locally on empty token before fetching', async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    await expect(lookupShare('   ', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'expired',
    });
    expect((fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter prototo-app test 2>&1 | tail -5
```

Expected: fails with `Cannot find module './share-lookup'`.

- [ ] **Step 3: Implement `share-lookup.ts`**

Create `apps/prototo-app/lib/share-lookup.ts`:

```ts
import { z } from 'zod';

export const SHARE_API_BASE = 'https://prototo.app';

const ShareLookupResponseSchema = z.object({
  designerName: z.string(),
  appName: z.string(),
  screenCount: z.number(),
  theme: z.enum(['liquid-glass', 'material-you']),
  tunnelUrl: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export type ShareLookupResponse = z.infer<typeof ShareLookupResponseSchema>;

export type ShareLookupErrorKind = 'expired' | 'unreachable';

export class ShareLookupError extends Error {
  readonly kind: ShareLookupErrorKind;
  constructor(kind: ShareLookupErrorKind, message: string) {
    super(message);
    this.name = 'ShareLookupError';
    this.kind = kind;
  }
}

export type LookupOptions = {
  fetch?: typeof fetch;
  baseUrl?: string;
};

export async function lookupShare(
  token: string,
  opts: LookupOptions = {},
): Promise<ShareLookupResponse> {
  if (!token.trim()) throw new ShareLookupError('expired', 'Token must not be empty');

  const fetchFn = opts.fetch ?? fetch;
  const baseUrl = opts.baseUrl ?? SHARE_API_BASE;
  const url = `${baseUrl}/api/share/${encodeURIComponent(token)}`;

  let res: Response;
  try {
    res = (await fetchFn(url)) as Response;
  } catch {
    throw new ShareLookupError('unreachable', 'Could not reach the share service');
  }

  if (res.status === 404) throw new ShareLookupError('expired', 'Share token not found');
  if (!res.ok) throw new ShareLookupError('unreachable', `Unexpected status ${res.status}`);

  let bodyJson: unknown;
  try {
    bodyJson = await res.json();
  } catch {
    throw new ShareLookupError('unreachable', 'Response was not JSON');
  }

  const parsed = ShareLookupResponseSchema.safeParse(bodyJson);
  if (!parsed.success) {
    throw new ShareLookupError('unreachable', 'Response did not match schema');
  }
  return parsed.data;
}
```

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter prototo-app test 2>&1 | tail -3
```

Expected: 6 tests pass.

- [ ] **Step 5: Type-check**

```bash
pnpm --filter prototo-app exec tsc -p tsconfig.json --noEmit 2>&1 | tail -3
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/prototo-app/lib/share-lookup.ts apps/prototo-app/lib/share-lookup.test.ts
git commit -m "$(cat <<'EOF'
feat(prototo-app): lib/share-lookup zod-validated HTTP client

Consumer of the prototo.app /api/share/<token> route. Maps HTTP
responses to ShareLookupError kinds: 'expired' (404 / empty token)
vs 'unreachable' (5xx / network / bad-body). Designer-friendly
error kinds drive the three render states in app/p/[token].tsx.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 3: `lib/viewer-redirect.ts` — URL construction + Linking call (TDD)

**Files:**
- Create: `apps/prototo-app/lib/viewer-redirect.ts`
- Create: `apps/prototo-app/lib/viewer-redirect.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/prototo-app/lib/viewer-redirect.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { redirectToDevClient, buildDevClientUrl } from './viewer-redirect';

describe('buildDevClientUrl', () => {
  it('builds the canonical prototo://expo-development-client URL', () => {
    const url = buildDevClientUrl('https://abc.trycloudflare.com');
    expect(url).toBe(
      'prototo://expo-development-client/?url=https%3A%2F%2Fabc.trycloudflare.com',
    );
  });

  it('URL-encodes special characters in the tunnel URL', () => {
    const url = buildDevClientUrl('https://abc.trycloudflare.com/?x=1&y=2');
    expect(url).toBe(
      'prototo://expo-development-client/?url=https%3A%2F%2Fabc.trycloudflare.com%2F%3Fx%3D1%26y%3D2',
    );
  });
});

describe('redirectToDevClient', () => {
  it('calls linking.openURL with the constructed dev-client URL', async () => {
    const openURL = vi.fn(async () => true);
    await redirectToDevClient('https://abc.trycloudflare.com', {
      linking: { openURL },
    });
    expect(openURL).toHaveBeenCalledWith(
      'prototo://expo-development-client/?url=https%3A%2F%2Fabc.trycloudflare.com',
    );
  });

  it('rejects when linking.openURL rejects', async () => {
    const openURL = vi.fn(async () => {
      throw new Error('iOS denied URL open');
    });
    await expect(
      redirectToDevClient('https://abc.trycloudflare.com', {
        linking: { openURL },
      }),
    ).rejects.toThrow(/iOS denied/);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter prototo-app test -- viewer-redirect 2>&1 | tail -5
```

Expected: module-not-found.

- [ ] **Step 3: Implement `viewer-redirect.ts`**

Create `apps/prototo-app/lib/viewer-redirect.ts`:

```ts
import * as Linking from 'expo-linking';

const DEV_CLIENT_URL_PREFIX = 'prototo://expo-development-client/?url=';

export function buildDevClientUrl(tunnelUrl: string): string {
  return `${DEV_CLIENT_URL_PREFIX}${encodeURIComponent(tunnelUrl)}`;
}

export type LinkingShim = {
  openURL: (url: string) => Promise<boolean | void>;
};

export type RedirectOptions = {
  linking?: LinkingShim;
};

const defaultLinking: LinkingShim = {
  openURL: (url: string) => Linking.openURL(url),
};

export async function redirectToDevClient(
  tunnelUrl: string,
  opts: RedirectOptions = {},
): Promise<void> {
  const linking = opts.linking ?? defaultLinking;
  const url = buildDevClientUrl(tunnelUrl);
  await linking.openURL(url);
}
```

The default `Linking` import is `expo-linking` (already a transitive dep via `expo-router`; explicit because it's clearer than reaching into `react-native`'s `Linking`).

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter prototo-app test -- viewer-redirect 2>&1 | tail -3
```

Expected: 4 tests pass.

- [ ] **Step 5: Type-check**

```bash
pnpm --filter prototo-app exec tsc -p tsconfig.json --noEmit 2>&1 | tail -3
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/prototo-app/lib/viewer-redirect.ts apps/prototo-app/lib/viewer-redirect.test.ts
git commit -m "$(cat <<'EOF'
feat(prototo-app): lib/viewer-redirect dev-client URL redirect

Constructs prototo://expo-development-client/?url=<encoded> from a
tunnel URL and calls Linking.openURL. expo-dev-client intercepts the
URL at the native iOS layer (before expo-router sees it) and loads
the bundle from the tunnel. Same mechanism as proto start QR scan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 4: `app/_layout.tsx` — root Stack

**Files:**
- Create: `apps/prototo-app/app/_layout.tsx`

- [ ] **Step 1: Create the layout**

Create `apps/prototo-app/app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

That's the whole file — minimal Stack that hides the default header for every route.

- [ ] **Step 2: Type-check**

```bash
pnpm --filter prototo-app exec tsc -p tsconfig.json --noEmit 2>&1 | tail -3
```

Expected: exit 0.

- [ ] **Step 3: Confirm the existing index route still works structurally (no test runtime — visual validation comes on device)**

```bash
ls apps/prototo-app/app
```

Expected: `_layout.tsx`, `index.tsx`. Both files present.

- [ ] **Step 4: Commit**

```bash
git add apps/prototo-app/app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(prototo-app): root layout for multi-route navigation

expo-router needs an explicit Stack to host more than one route.
headerShown: false because both creator-mode and viewer-mode are
fullscreen surfaces — they own their own chrome.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 5: `app/p/[token].tsx` — viewer-mode entry

**Files:**
- Create: `apps/prototo-app/app/p/[token].tsx`

This route is a visual surface (loading + error states with Liquid Glass). Skip TDD per CLAUDE.md component rule — visual validation comes on device in Task 11.

- [ ] **Step 1: Create the directory + route**

```bash
mkdir -p apps/prototo-app/app/p
```

Create `apps/prototo-app/app/p/[token].tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GlassView } from 'expo-glass-effect';
import { lookupShare, ShareLookupError, type ShareLookupResponse } from '../../lib/share-lookup';
import { redirectToDevClient } from '../../lib/viewer-redirect';

type State =
  | { kind: 'loading'; designerName: string | null }
  | { kind: 'error-expired' }
  | { kind: 'error-unreachable' };

export default function ViewerRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: 'loading', designerName: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const safeToken = typeof token === 'string' ? token : '';

    (async () => {
      let share: ShareLookupResponse;
      try {
        share = await lookupShare(safeToken);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ShareLookupError && err.kind === 'expired') {
          setState({ kind: 'error-expired' });
        } else {
          setState({ kind: 'error-unreachable' });
        }
        return;
      }
      if (cancelled) return;
      setState({ kind: 'loading', designerName: share.designerName });
      try {
        await redirectToDevClient(share.tunnelUrl);
        // After Linking.openURL fires, expo-dev-client takes over and
        // the JS context will be replaced. Render state below doesn't matter.
      } catch {
        if (!cancelled) setState({ kind: 'error-unreachable' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  return (
    <View style={styles.container}>
      <View style={styles.bg} />
      <GlassView style={styles.glass} glassEffectStyle="clear">
        {state.kind === 'loading' && (
          <Text style={styles.title}>
            {state.designerName ? `Loading ${state.designerName}'s prototype…` : 'Loading prototype…'}
          </Text>
        )}
        {state.kind === 'error-expired' && (
          <>
            <Text style={styles.title}>This share link expired.</Text>
            <Text style={styles.body}>Ask the designer for a new one.</Text>
            <Pressable
              style={styles.button}
              onPress={() => setAttempt((n) => n + 1)}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </>
        )}
        {state.kind === 'error-unreachable' && (
          <>
            <Text style={styles.title}>Can't reach the designer's Mac.</Text>
            <Text style={styles.body}>They may have stopped sharing.</Text>
            <Pressable
              style={styles.button}
              onPress={() => setAttempt((n) => n + 1)}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </>
        )}
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1a1a1a' },
  glass: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '40%',
    padding: 28,
    borderRadius: 28,
    overflow: 'hidden',
  },
  title: { fontSize: 22, fontWeight: '600', color: '#FFFFFF' },
  body: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  button: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
  },
  buttonText: { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
});
```

The `attempt` state increments on "Try again" tap → `useEffect`'s dep array re-runs the whole lookup-and-redirect chain.

- [ ] **Step 2: Type-check**

```bash
pnpm --filter prototo-app exec tsc -p tsconfig.json --noEmit 2>&1 | tail -3
```

Expected: exit 0.

- [ ] **Step 3: Confirm directory structure**

```bash
ls apps/prototo-app/app/p
```

Expected: `[token].tsx` present.

- [ ] **Step 4: Commit**

```bash
git add apps/prototo-app/app/p/\[token\].tsx
git commit -m "$(cat <<'EOF'
feat(prototo-app): app/p/[token] viewer-mode entry

Receives token from URL params, calls lib/share-lookup, then
lib/viewer-redirect. Renders three states: loading (with designer
name once known), expired ("share link expired, ask for new one"),
unreachable ("can't reach designer's Mac"). One-tap "Try again"
on both error states increments attempt counter and re-fires the
lookup chain.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 6: Sanity rebuild + tests + typecheck

**Files:** none modified.

- [ ] **Step 1: Reinstall to be safe**

```bash
pnpm install 2>&1 | tail -3
```

Expected: "Already up to date" or normal install output.

- [ ] **Step 2: Run all proto-cli + create-proto + prototo-app tests**

```bash
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
pnpm --filter create-proto test 2>&1 | tail -3
pnpm --filter prototo-app test 2>&1 | tail -3
```

Expected: all three all-green. prototo-app should show 10 tests passing (6 share-lookup + 4 viewer-redirect).

- [ ] **Step 3: Type-check prototo-app**

```bash
pnpm --filter prototo-app exec tsc -p tsconfig.json --noEmit 2>&1 | tail -3
```

Expected: exit 0.

- [ ] **Step 4: No commit** (verification gate only).

---

## Task 7: Push branch + open PR in proto repo

**Files:** none modified.

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/prototo-viewer-mode 2>&1 | tail -3
```

Expected: branch pushed to remote.

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "prototo viewer mode: open share links natively in Prototo App" --body "$(cat <<'EOF'
## Summary

Implements Phase 3a sub-unit E — viewer-mode routing in Prototo App. When a stakeholder taps a \`https://prototo.app/p/<token>\` link on iPhone, Prototo opens directly and loads the designer's prototype via the cloudflared tunnel. Zero viewer chrome, three designer-friendly error states.

## What changed

- New \`app/_layout.tsx\` — root Stack with \`headerShown: false\`
- New \`app/p/[token].tsx\` — viewer entry; reads token, calls lookup, redirects to dev-client URL
- New \`lib/share-lookup.ts\` — zod-validated GET /api/share/<token> with \`ShareLookupError\` kinds (expired / unreachable)
- New \`lib/viewer-redirect.ts\` — builds \`prototo://expo-development-client/?url=...\` and calls \`Linking.openURL\`
- Both lib units TDD'd (10 tests total)
- Vitest + zod added to \`apps/prototo-app\`'s devDeps / deps
- \`apps/prototo-app/package.json\` version bumped 0.1.0 → 0.2.0

The AASA-fix in the sibling \`prototo-website\` repo is handled in a separate PR (\`feat/aasa-bundle-id-fix\` there).

## Test plan

- [x] \`pnpm --filter prototo-app test\` — 10 tests pass
- [x] \`pnpm --filter prototo-app exec tsc -p tsconfig.json --noEmit\` — exits 0
- [ ] \`eas build --platform ios --profile development\` produces a fresh binary
- [ ] Sideloaded build on Sheri's iPhone via EAS install URL
- [ ] Scheme path validated: paste \`prototo://p/<token>\` from a running \`proto share\` into iMessage, tap → Prototo opens and the prototype renders
- [ ] Manual ergonomics: loading state renders briefly; deliberately-killed \`proto share\` shows the unreachable error state with "Try again" working
- [ ] Universal-link path: deferred until F (App Store submission) lands; until then, scheme path is the load-bearing validation

## References

- Spec: \`docs/superpowers/specs/2026-05-25-prototo-viewer-mode-design.md\`
- Plan: \`docs/superpowers/plans/2026-05-25-prototo-viewer-mode.md\`
- API contract (B+C): \`docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md\`
- Producer (D): \`docs/superpowers/specs/2026-05-25-proto-share-design.md\`
- New risks tracked in \`docs/RISKS.md\`: DC-07, SH-08, AS-03
EOF
)" 2>&1 | tail -3
```

Expected: prints the PR URL (e.g. `https://github.com/sherizan/proto/pull/3`).

- [ ] **Step 3: Capture the PR URL** in your notes.

---

## Task 8: AASA fix in sibling `prototo-website` repo

**Files:**
- Modify: `/Users/sherizan/Public/prototo/public/.well-known/apple-app-site-association`

This task touches the sibling Next.js repo on Vercel. Same flow as the proto repo: branch + commit + push + PR + merge.

- [ ] **Step 1: Create the feature branch in the sibling repo**

```bash
cd /Users/sherizan/Public/prototo && git checkout -b feat/aasa-bundle-id-fix
```

Expected: branch created.

- [ ] **Step 2: Edit the AASA file**

Open `/Users/sherizan/Public/prototo/public/.well-known/apple-app-site-association`. Change:

```json
"appID": "BEJ53HUAE7.com.sherizan.proto",
```

to:

```json
"appID": "BEJ53HUAE7.com.sherizan.prototo",
```

Final file content:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "BEJ53HUAE7.com.sherizan.prototo",
        "paths": [ "/p/*" ]
      }
    ]
  }
}
```

- [ ] **Step 3: Validate JSON syntax locally**

```bash
cd /Users/sherizan/Public/prototo && cat public/.well-known/apple-app-site-association | python3 -m json.tool > /dev/null && echo "valid JSON"
```

Expected: prints `valid JSON`.

- [ ] **Step 4: Commit**

```bash
cd /Users/sherizan/Public/prototo && git add public/.well-known/apple-app-site-association && git commit -m "$(cat <<'EOF'
fix(aasa): correct appID bundle ID prototo not proto

Pre-rebrand value blocked universal-link routing of
prototo.app/p/<token> into Prototo App. Final bundle ID is
com.sherizan.prototo (post-rebrand, registered in App Store
Connect under team ID BEJ53HUAE7).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

- [ ] **Step 5: Push branch + open PR**

```bash
cd /Users/sherizan/Public/prototo && git push -u origin feat/aasa-bundle-id-fix 2>&1 | tail -3
gh pr create --title "AASA: correct appID bundle ID prototo not proto" --body "$(cat <<'EOF'
## Summary

One-line fix to \`public/.well-known/apple-app-site-association\` — \`appID\` was \`BEJ53HUAE7.com.sherizan.proto\` (pre-rebrand), should be \`BEJ53HUAE7.com.sherizan.prototo\`. This blocks iOS universal-link routing from \`prototo.app/p/<token>\` into Prototo App.

## Test plan

- [ ] After merge, Vercel auto-deploys
- [ ] \`curl -fsSL https://prototo.app/.well-known/apple-app-site-association | jq .applinks.details[0].appID\` returns \`"BEJ53HUAE7.com.sherizan.prototo"\`
- [ ] Universal-link routing on iPhone (gated on Prototo App being App-Store-installed — separate F sub-unit)
EOF
)" 2>&1 | tail -3
```

Expected: PR URL printed.

- [ ] **Step 6: Merge the AASA PR**

```bash
cd /Users/sherizan/Public/prototo && gh pr merge --merge --delete-branch
```

Expected: merge succeeds. Vercel deploys within 1–2 minutes.

- [ ] **Step 7: Sync local main**

```bash
cd /Users/sherizan/Public/prototo && git checkout main && git pull && git fetch --prune origin
```

Expected: local main contains the merge commit.

- [ ] **Step 8: Verify deployment**

Wait ~2 minutes for Vercel to deploy, then:

```bash
curl -fsSL https://prototo.app/.well-known/apple-app-site-association
```

Expected: JSON output with `"appID": "BEJ53HUAE7.com.sherizan.prototo"`. If still showing `.proto` (no `to`), wait longer and retry — Vercel deploy can take up to 5 minutes.

- [ ] **Step 9: cd back to the main proto repo**

```bash
cd /Users/sherizan/Public/proto
```

---

## Task 9: Merge the proto repo PR

**Files:** none modified.

- [ ] **Step 1: Verify mergeable**

```bash
gh pr view <PR-number-from-task-7> --json mergeable,mergeStateStatus
```

Expected: `"mergeable": "MERGEABLE"`, `"mergeStateStatus": "CLEAN"`.

- [ ] **Step 2: Merge with merge commit**

```bash
gh pr merge <PR-number-from-task-7> --merge --delete-branch
```

Expected: merge succeeds.

- [ ] **Step 3: Sync main**

```bash
git checkout main && git pull && git fetch --prune origin && git branch -d feat/prototo-viewer-mode 2>/dev/null
```

Expected: local main contains the merge commit; feature branch gone.

---

## Task 10: EAS build of Prototo App with viewer mode

**Files:** none modified directly.

This is maintainer-time. The fresh EAS development build picks up all the new viewer-mode code + the existing `associatedDomains` entitlement.

- [ ] **Step 1: Trigger the EAS build**

```bash
cd /Users/sherizan/Public/proto/apps/prototo-app && pnpm run build:ios && cd -
```

Expected: build queues. Wait for `status: "finished"` (5–30 min).

- [ ] **Step 2: Sideload onto iPhone**

EAS prints an install URL after build completion. Open the URL in Safari on iPhone, tap "Install", complete the iOS dialog. The new Prototo (with viewer mode) replaces the existing one on the home screen.

- [ ] **Step 3: Capture the build SHA in your notes**

```bash
cd /Users/sherizan/Public/proto/apps/prototo-app && pnpm exec eas build:list --platform ios --status finished --limit 3 --json --non-interactive | head -50
```

Note the most recent build's `id` and `gitCommitHash`.

---

## Task 11: End-to-end scheme-path validation

**Files:** none modified.

The scheme path always works on sideloaded builds — universal-link path is gated on F + AASA propagation. This task validates the scheme path on your iPhone.

- [ ] **Step 1: Start a fresh share from a test project**

```bash
cd /tmp && rm -rf share-e2e-test && npm create proto@latest share-e2e-test
```

After scaffold + auto-start of `proto start`, hit Ctrl+C in the terminal. Then:

```bash
cd /tmp/share-e2e-test && pnpm proto share
```

Note the token from the output (e.g. `xk92m`).

- [ ] **Step 2: Construct the scheme URL**

In the format `prototo://p/<token>`. Example: `prototo://p/xk92m`. Send it to yourself via iMessage:

```bash
# (on Mac, paste into iMessage to your own number)
```

Or just type it into iMessage manually. Tap-and-hold the link in iMessage if it doesn't appear tappable — iMessage sometimes formats custom-scheme links as plain text.

- [ ] **Step 3: Tap the link on iPhone**

Expected sequence:
1. Prototo opens (no Safari intermediate)
2. Brief loading state — "Loading [your-name]'s prototype…"
3. expo-dev-client takes over, loads the bundle from the tunnel
4. The welcome screen of the scaffolded prototype renders fullscreen

If you see the loading state but the bundle never loads, that means the tunnel-URL handoff to expo-dev-client failed — paste the output here and we'll diagnose.

- [ ] **Step 4: Test the unreachable error state**

In the original Mac terminal running `proto share`, hit Ctrl+C to stop the tunnel.

Re-tap the same `prototo://p/<token>` link on iPhone. Expected: brief loading → "Can't reach the designer's Mac. They may have stopped sharing." with a "Try again" button.

Tap "Try again". Expected: same error appears (tunnel is still dead). Good — proves the retry chain runs.

- [ ] **Step 5: Test the expired error state**

Either wait 7 days (impractical) OR test by constructing a deliberately-fake token like `prototo://p/AAAAA` and tapping it. The `/api/share/AAAAA` lookup will return 404, and the viewer renders "This share link expired. Ask the designer for a new one."

- [ ] **Step 6: No commit** (manual validation only).

---

## Task 12: Universal-link path validation (DEFERRED until F lands)

**Files:** none modified.

This task is **NOT executable today** — it requires Prototo to be installed from the App Store (which is sub-unit F's deliverable). Document as deferred.

Once F lands and your iPhone has Prototo installed via App Store:

- Wait at least 24h after the AASA file is live on `prototo.app` (iOS AASA cache).
- Paste a fresh `https://prototo.app/p/<token>` URL into iMessage to yourself.
- Tap the link.
- Expected: Prototo opens directly (no Safari intermediate). Same flow as Task 11's scheme path.

If iOS still routes to Safari after 24h, verify:
- `curl -fsSL https://prototo.app/.well-known/apple-app-site-association` shows the correct `appID`.
- The installed Prototo binary has the `associatedDomains` entitlement (check via Apple Configurator or `codesign -d --entitlements -:- /path/to/Prototo.app`).
- The Apple Team ID in the AASA file matches the team that signed the App Store binary.

- [ ] **Step 1**: Document this validation as "deferred until F lands; scheme path validated in Task 11" and tick the corresponding DoD item with the `(deferred)` annotation.

No commit needed in this task — the DoD tick happens in Task 13.

---

## Task 13: DoD signoff in the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-05-25-prototo-viewer-mode-design.md`

- [ ] **Step 1: Walk the DoD checklist**

Open `docs/superpowers/specs/2026-05-25-prototo-viewer-mode-design.md` and for each item under "Definition of done", change `[ ]` to `[x]` for items now satisfied. The universal-link DoD item stays unchecked with the explicit `(deferred until F lands)` annotation. Examples of items that ARE complete after Tasks 1–11:

- [x] `app/_layout.tsx` exists, renders a Stack with headerShown: false
- [x] `app/p/[token].tsx` exists, reads token, kicks off lookup + redirect
- [x] `lib/share-lookup.ts` exports `lookupShare` with zod validation + designer-friendly error kinds
- [x] `lib/share-lookup.test.ts` covers happy + 404 + 5xx + network paths
- [x] `lib/viewer-redirect.ts` exports `redirectToDevClient`
- [x] `lib/viewer-redirect.test.ts` covers URL construction + encoding + Linking rejection
- [x] `apps/prototo-app/package.json` version bumped 0.1.0 → 0.2.0; zod added
- [x] `pnpm --filter prototo-app test` passes
- [x] `pnpm --filter prototo-app exec tsc -p tsconfig.json --noEmit` exits 0
- [x] `eas build --platform ios --profile development` produces a fresh binary
- [x] Sideloaded build on Sheri's iPhone
- [x] Scheme path validated
- [x] Manual viewer flow ergonomics
- [x] AASA file in /Users/sherizan/Public/prototo/ updated, deployed
- [ ] Universal-link path validated *(deferred until F lands and Prototo is App-Store-installed)*

- [ ] **Step 2: Commit + push the DoD update**

```bash
cd /Users/sherizan/Public/proto
git add docs/superpowers/specs/2026-05-25-prototo-viewer-mode-design.md
git commit -m "$(cat <<'EOF'
docs(spec): prototo viewer-mode DoD signoff

All items ticked except universal-link path (deferred until sub-unit F
App Store submission lands; scheme path is the load-bearing
validation today). End-to-end scheme path validated on Sheri's iPhone:
share link tap → Prototo opens → bundle loads from tunnel → prototype
renders. AASA file deployed on prototo.app; ready to flip on universal
links the moment App-Store-installed Prototo is in users' hands.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main 2>&1 | tail -3
```

Expected: commit + push succeed.

---

## Self-review

**Spec coverage:**
- ✓ Bundle-loading mechanism (Linking redirect): Task 3
- ✓ Universal-link path: AASA fix Task 8 + scheme path Task 11
- ✓ Scheme fallback path: Task 11
- ✓ Route file at `app/p/[token].tsx`: Task 5
- ✓ Root layout: Task 4
- ✓ Zero viewer chrome (loading + 3 states): Task 5
- ✓ Three error states (loading / expired / unreachable): Task 5
- ✓ AASA fix sibling repo: Task 8
- ✓ Zod reuse: Task 2
- ✓ No persistence across launches: implicit in the design (no AsyncStorage / no SecureStore work)
- ✓ Two units (share-lookup + viewer-redirect): Tasks 2 + 3
- ✓ TDD scope (lib/ yes, app/p/ no): tasks reflect this
- ✓ Cross-repo work: Tasks 7 + 8 + 9

**Placeholder scan:** no `TODO`, `TBD`, "implement later" patterns. The "deferred until F lands" annotations are explicit, not placeholders.

**Type consistency:** `ShareLookupResponse`, `ShareLookupError`, `ShareLookupErrorKind`, `LinkingShim`, `LookupOptions`, `RedirectOptions` — used consistently across Tasks 2, 3, and 5.
