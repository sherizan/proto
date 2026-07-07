# Viewer Home Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Mine/Shared dashboard with one adaptive recipient-first home: recents body, thumb-zone bottom bar (tabs pill left, scan FAB right), scanner as the single "get me in" portal with a clipboard banner, and an app-open clipboard prompt.

**Architecture:** All changes in `apps/prototo-app` (Expo SDK 56, expo-router, proto-components). Pure logic (history shape, clipboard detection, decline memory) lives in `lib/` with vitest coverage; chrome (bottom bar, prompt dialog, scanner banner) renders on `expo-glass-effect` GlassView with reanimated entrances. Routes are unchanged (`/p/[token]`, `/connect`, `home/index`, `home/profile`); `home/_layout` swaps NativeTabs for a custom bar.

**Tech Stack:** React Native / Expo SDK 56, expo-router, proto-components (Screen/Stack/Card/Text/Lottie/useTheme/useAccent), expo-glass-effect GlassView, react-native-reanimated, expo-clipboard, expo-symbols, AsyncStorage, vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-07-viewer-home-redesign-design.md`.
- No em dashes in any user-facing copy (brand rule).
- Chrome is glass, content is not: GlassView for bottom bar, FAB, scanner banner, prompt dialog; flat `Card` for recents/Yours content.
- Animations under ~500ms, ease-out, no overshoot; reduced-motion respected via `ReduceMotion.System` on every `withTiming`.
- DC-11 security posture in the scanner is untouchable: `parseShareLink` host pinning and `parseConnectUrl` LAN guard stay exactly as they are.
- Working dir for all commands: `~/Public/proto/apps/prototo-app`. Tests: `pnpm vitest run <file>`. Typecheck: `npx tsc --noEmit` (ignore pre-existing proto-components errors only).
- Commit format: `viewer: <what>` + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: open-history records the designer name

**Files:**
- Modify: `lib/open-history.ts`
- Modify: `app/p/[token].tsx:81` (the `recordOpen` call)
- Test: `lib/open-history.test.ts` (exists; extend)

**Interfaces:**
- Produces: `OpenedProto = { token: string; appName: string; openedAt: string; designerName?: string }`; `recordOpen(entry: { token: string; appName: string; designerName?: string })`. Task 4 renders `designerName`.

- [ ] **Step 1: Write the failing test** — append to `lib/open-history.test.ts`:

```ts
describe('designerName (optional, added for the recents "by <name>" line)', () => {
  it('mergeHistory preserves designerName', () => {
    const merged = mergeHistory([], {
      token: 'AB12CD34EF56',
      appName: 'botim',
      designerName: 'Yitong',
      openedAt: '2026-07-07T00:00:00.000Z',
    });
    expect(merged[0].designerName).toBe('Yitong');
  });

  it('getHistory keeps legacy entries without designerName', async () => {
    await AsyncStorage.setItem(
      'proto.openHistory',
      JSON.stringify([{ token: 'AB12CD34EF56', appName: 'old', openedAt: '2026-01-01T00:00:00.000Z' }]),
    );
    const list = await getHistory();
    expect(list).toHaveLength(1);
    expect(list[0].designerName).toBeUndefined();
  });
});
```

(Match the existing test file's AsyncStorage mock/setup conventions; if it already imports a mock, reuse it.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run lib/open-history.test.ts`
Expected: FAIL (type error on `designerName` / property undefined assertions).

- [ ] **Step 3: Implement** — in `lib/open-history.ts`:

```ts
export type OpenedProto = { token: string; appName: string; openedAt: string; designerName?: string };
```

and

```ts
export async function recordOpen(entry: { token: string; appName: string; designerName?: string }): Promise<void> {
```

(`mergeHistory` and `getHistory`'s validator need no change: the validator checks only the required fields, so optional `designerName` passes through JSON round-trips.)

- [ ] **Step 4: Update the call site** — `app/p/[token].tsx`, the success path:

```ts
void recordOpen({ token, appName: result.share.appName, designerName: result.share.designerName });
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm vitest run lib/open-history.test.ts && npx tsc --noEmit`
Expected: PASS / clean (ignoring pre-existing proto-components errors).

- [ ] **Step 6: Commit**

```bash
git add lib/open-history.ts lib/open-history.test.ts "app/p/[token].tsx"
git commit -m "viewer: open-history records designerName for the recents card

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: clipboard share detection + decline memory (pure lib)

**Files:**
- Create: `lib/clipboard-share.ts`
- Test: `lib/clipboard-share.test.ts`

**Interfaces:**
- Consumes: `parseShareLink` from `lib/share-link.ts`.
- Produces:
  - `detectClipboardShare(deps?: { hasUrl?: () => Promise<boolean>; getString?: () => Promise<string> }): Promise<string | null>` — resolves to a share token or null. Checks `hasUrl` FIRST (no iOS paste toast), only then reads.
  - `wasDeclined(token: string): Promise<boolean>` and `rememberDecline(token: string): Promise<void>` — single-slot memory (AsyncStorage key `proto.clipboardDeclined`); a NEW token overwrites, so a previously declined token prompts again only if re-copied after another declined link. Tasks 6 and 7 consume all three.

- [ ] **Step 1: Write the failing test** — `lib/clipboard-share.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { detectClipboardShare, rememberDecline, wasDeclined } from './clipboard-share';

const TOKEN = 'TVY8DNDW8G4V';
const LINK = `https://prototo.app/p/${TOKEN}`;

describe('detectClipboardShare', () => {
  it('returns the token when the clipboard holds a share link', async () => {
    const token = await detectClipboardShare({
      hasUrl: async () => true,
      getString: async () => LINK,
    });
    expect(token).toBe(TOKEN);
  });

  it('never reads the clipboard when hasUrl is false (no iOS paste toast)', async () => {
    let read = false;
    const token = await detectClipboardShare({
      hasUrl: async () => false,
      getString: async () => {
        read = true;
        return LINK;
      },
    });
    expect(token).toBeNull();
    expect(read).toBe(false);
  });

  it('returns null for a non-Prototo URL and on errors', async () => {
    expect(
      await detectClipboardShare({ hasUrl: async () => true, getString: async () => 'https://example.com' }),
    ).toBeNull();
    expect(
      await detectClipboardShare({
        hasUrl: async () => {
          throw new Error('boom');
        },
        getString: async () => LINK,
      }),
    ).toBeNull();
  });
});

describe('decline memory', () => {
  beforeEach(() => AsyncStorage.clear());

  it('remembers a declined token', async () => {
    expect(await wasDeclined(TOKEN)).toBe(false);
    await rememberDecline(TOKEN);
    expect(await wasDeclined(TOKEN)).toBe(true);
  });

  it('a different token is not declined', async () => {
    await rememberDecline(TOKEN);
    expect(await wasDeclined('AB12CD34EF56')).toBe(false);
  });
});
```

(If the repo's vitest setup lacks an AsyncStorage mock for new files, mirror whatever `lib/open-history.test.ts` does.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run lib/clipboard-share.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `lib/clipboard-share.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { parseShareLink } from './share-link';

const DECLINED_KEY = 'proto.clipboardDeclined';

type Deps = { hasUrl?: () => Promise<boolean>; getString?: () => Promise<string> };

/**
 * Share token on the clipboard, or null. Checks WHETHER a URL exists first
 * (UIPasteboard pattern detection, no iOS paste toast); only a positive check
 * reads the clipboard, which the user perceives as truthful ("it found my link").
 */
export async function detectClipboardShare(deps: Deps = {}): Promise<string | null> {
  const hasUrl = deps.hasUrl ?? Clipboard.hasUrlAsync;
  const getString = deps.getString ?? Clipboard.getStringAsync;
  try {
    if (!(await hasUrl())) return null;
    return parseShareLink(await getString());
  } catch {
    return null;
  }
}

/** "Not now" on the app-open prompt: never re-prompt for this exact token. */
export async function rememberDecline(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DECLINED_KEY, token);
  } catch {
    // best-effort; worst case the prompt shows again
  }
}

export async function wasDeclined(token: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DECLINED_KEY)) === token;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run lib/clipboard-share.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/clipboard-share.ts lib/clipboard-share.test.ts
git commit -m "viewer: clipboard share detection + decline memory (toast-free hasUrl gate)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: HomeBar — glass tabs pill + scan FAB (thumb zone)

**Files:**
- Create: `components/HomeBar.tsx`

**Interfaces:**
- Consumes: expo-router `useRouter`/`usePathname`, GlassView, `useAccent`/`useTheme`, SymbolView, reanimated.
- Produces: `<HomeBar />` (no props) — absolute-positioned bottom bar: left pill with Prototypes/Account triggers (`router.replace('/home')` / `router.replace('/home/profile')`, active state from `usePathname()`), right circular scan FAB → `router.push('/connect')`. On mount it plays one gentle attention pulse on the FAB (once per cold start — deliberate simplification of the spec's empty-state-only pulse; flag at review). Task 6 mounts it.

- [ ] **Step 1: Implement** — `components/HomeBar.tsx`:

```tsx
import { GlassView } from 'expo-glass-effect';
import { useRouter, usePathname } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useAccent, useTheme, Text } from 'proto-components';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TIMING = { duration: 160, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };

function PressScale({ onPress, children, style }: { onPress: () => void; children: React.ReactNode; style?: object }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPressIn={() => (scale.value = withTiming(0.96, TIMING))}
      onPressOut={() => (scale.value = withTiming(1, TIMING))}
      onPress={onPress}
    >
      <Animated.View style={[animated, style]}>{children}</Animated.View>
    </Pressable>
  );
}

// Thumb-zone chrome: tabs pill left, scan FAB alone on the right. Chrome is
// glass; the FAB is the one accent-filled element on the screen.
export function HomeBar() {
  const router = useRouter();
  const pathname = usePathname();
  const accent = useAccent();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const onProfile = pathname.includes('profile');

  const pulse = useSharedValue(1);
  useEffect(() => {
    // one gentle attention beat per cold start, then never again
    const t = { duration: 450, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };
    pulse.value = withSequence(withDelay(900, withTiming(1.08, t)), withTiming(1, t));
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const tab = (label: string, active: boolean, onPress: () => void) => (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text size="label" color={active ? 'accent' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]}>
      <GlassView style={[styles.pill, { backgroundColor: theme.surface.card }]}>
        <View style={styles.pillInner}>
          {tab('Prototypes', !onProfile, () => router.replace('/home'))}
          {tab('Account', onProfile, () => router.replace('/home/profile'))}
        </View>
      </GlassView>
      <Animated.View style={pulseStyle}>
        <PressScale onPress={() => router.push('/connect')}>
          <GlassView style={[styles.fab, { backgroundColor: accent }]}>
            <SymbolView name="qrcode.viewfinder" size={24} tintColor="#FFFFFF" />
          </GlassView>
        </PressScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: { borderRadius: 24, overflow: 'hidden' },
  pillInner: { flexDirection: 'row', gap: 20, paddingVertical: 14, paddingHorizontal: 20 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (pre-existing proto-components errors only). If `React.ReactNode` errors, add `import type { ReactNode } from 'react'` and use it.

- [ ] **Step 3: Commit**

```bash
git add components/HomeBar.tsx
git commit -m "viewer: HomeBar — glass tabs pill + accent scan FAB in the thumb zone

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Home screen rewrite — recents + Yours + empty state

**Files:**
- Modify: `app/home/index.tsx` (full rewrite below)
- Modify: `components/dashboard-ui.tsx` (add `badge` to TapCard; delete `Segmented` and `OpenButton` if now unused — check usages first)
- Delete: `lib/sample.ts`, `lib/sample.test.ts`

**Interfaces:**
- Consumes: Task 1's `OpenedProto.designerName`; `useMyShares` (`shares: { token; appName; createdAt; expiresAt }[]`, `status`); `getHistory`; `relativeTime`; `HomeBar` is NOT mounted here (Task 5 owns it in the layout).
- Produces: the screen renders sections `Yours` (when `shares.length > 0`) then `Recently viewed` (when history non-empty); owned recents get an accent "Yours" badge; both-empty shows the single dashed empty card with copy exactly: "Prototypes people share with you will appear here." / "Tap scan to open your first." Exposes nothing to other tasks.

- [ ] **Step 1: Add `badge` to TapCard** — in `components/dashboard-ui.tsx`, replace `TapCard` with:

```tsx
export function TapCard({
  title,
  caption,
  badge,
  onPress,
}: {
  title: string;
  caption?: string;
  badge?: string;
  onPress: () => void;
}) {
  const accent = useAccent();
  return (
    <Pressable onPress={onPress}>
      <Card>
        <Row gap={12} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Stack gap={4}>
              <Row gap={8} style={{ alignItems: 'center' }}>
                <Text size="headline">{title}</Text>
                {badge ? (
                  <View
                    style={{
                      backgroundColor: `${accent}1F`,
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text size="label" color="accent">
                      {badge}
                    </Text>
                  </View>
                ) : null}
              </Row>
              {caption ? (
                <Text size="caption" color="secondary">
                  {caption}
                </Text>
              ) : null}
            </Stack>
          </View>
          <SymbolView name="chevron.right" size={14} tintColor={useTheme().text.secondary} />
        </Row>
      </Card>
    </Pressable>
  );
}
```

Add `useAccent` to the proto-components import. Note the hook call inside JSX (`useTheme().text.secondary`) is not allowed — hoist it: `const theme = useTheme();` at the top and use `theme.text.secondary`.

- [ ] **Step 2: Rewrite the screen** — `app/home/index.tsx` full replacement:

```tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { Lottie, Stack, Text, useTheme } from 'proto-components';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMyShares } from '../../lib/use-my-shares';
import { getHistory, type OpenedProto } from '../../lib/open-history';
import { relativeTime } from '../../lib/relative-time';
import { TapCard } from '../../components/dashboard-ui';

function Enter({ delay, children }: { delay: number; children: ReactNode }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  useEffect(() => {
    const timing = { duration: 450, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };
    opacity.value = withDelay(delay, withTiming(1, timing));
    translateY.value = withDelay(delay, withTiming(0, timing));
  }, [delay, opacity, translateY]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function Prototypes() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { shares, status } = useMyShares();
  const [history, setHistory] = useState<OpenedProto[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getHistory().then((h) => {
        if (active) setHistory(h);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const ownedTokens = new Set(shares.map((s) => s.token));
  const empty = status === 'ready' && shares.length === 0 && history.length === 0;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 96, // clear the HomeBar
        gap: 24,
      }}
      style={{ backgroundColor: theme.surface.primary }}
    >
      <Enter delay={0}>
        <Lottie
          source={require('../../assets/logo-prototo.json')}
          style={{ width: 36, height: 36, alignSelf: 'center' }}
        />
      </Enter>

      {shares.length > 0 ? (
        <Enter delay={80}>
          <Stack gap={8}>
            <Text size="label" color="secondary">
              Yours
            </Text>
            {shares.map((s) => {
              const expired = new Date(s.expiresAt).getTime() < Date.now();
              const daysLeft = Math.max(0, Math.ceil((new Date(s.expiresAt).getTime() - Date.now()) / 86_400_000));
              return (
                <TapCard
                  key={s.token}
                  title={s.appName}
                  caption={
                    expired
                      ? `Expired · shared ${relativeTime(s.createdAt)}`
                      : `Link live ${daysLeft} more ${daysLeft === 1 ? 'day' : 'days'}`
                  }
                  onPress={() => router.push(`/p/${s.token}`)}
                />
              );
            })}
          </Stack>
        </Enter>
      ) : null}

      {history.length > 0 ? (
        <Enter delay={shares.length > 0 ? 160 : 80}>
          <Stack gap={8}>
            <Text size="label" color="secondary">
              Recently viewed
            </Text>
            {history.map((p) => (
              <TapCard
                key={p.token}
                title={p.appName}
                badge={ownedTokens.has(p.token) ? 'Yours' : undefined}
                caption={
                  p.designerName
                    ? `Opened ${relativeTime(p.openedAt)} · by ${p.designerName}`
                    : `Opened ${relativeTime(p.openedAt)}`
                }
                onPress={() => router.push(`/p/${p.token}`)}
              />
            ))}
          </Stack>
        </Enter>
      ) : null}

      {empty ? (
        <Enter delay={80}>
          <View
            style={{
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: theme.text.secondary,
              borderRadius: 16,
              padding: 28,
              gap: 8,
              alignItems: 'center',
              opacity: 0.9,
            }}
          >
            <Text size="body" color="secondary" style={{ textAlign: 'center' }}>
              Prototypes people share with you will appear here.
            </Text>
            <Text size="body" color="secondary" style={{ textAlign: 'center' }}>
              Tap <Text size="body" color="accent">scan</Text> to open your first.
            </Text>
          </View>
        </Enter>
      ) : null}
    </ScrollView>
  );
}
```


- [ ] **Step 3: Delete the sample** — remove `lib/sample.ts` and `lib/sample.test.ts` (`git rm`). Grep first: `grep -rn "lib/sample\|SAMPLE" app components lib` must return nothing after the rewrite. Also grep `Segmented\|OpenButton\|InfoCard` — delete each from `dashboard-ui.tsx` only if it now has zero usages (InfoCard may still be used elsewhere; keep whatever is referenced). Remove `@react-native-segmented-control/segmented-control` import if Segmented goes.

- [ ] **Step 4: Tests + typecheck**

Run: `pnpm vitest run && npx tsc --noEmit`
Expected: suite green minus the deleted sample tests; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add -A app/home/index.tsx components/dashboard-ui.tsx lib/
git commit -m "viewer: recipient-first home — recents + Yours + empty state; sample removed

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: ClipboardPrompt — app-open "Open <name>?" dialog

**Files:**
- Create: `components/ClipboardPrompt.tsx`

**Interfaces:**
- Consumes: `detectClipboardShare`, `wasDeclined`, `rememberDecline` (Task 2); `fetchShare` (`lib/share-lookup.ts`, returns `{ ok: true, share: { appName, designerName, deepLink } } | { ok: false, ... }`); `usePathname`, `useRouter`; GlassView; reanimated.
- Produces: `<ClipboardPrompt />`, self-contained: checks on mount + AppState `active`, skips when already on `/p/<same token>`, renders a transparent-Modal glass dialog, Open → `router.push('/p/<token>')`, Not now → `rememberDecline`. Task 6 mounts it in the layout.

- [ ] **Step 1: Implement** — `components/ClipboardPrompt.tsx`:

```tsx
import { GlassView } from 'expo-glass-effect';
import { usePathname, useRouter } from 'expo-router';
import { Button, Stack, Text } from 'proto-components';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { detectClipboardShare, rememberDecline, wasDeclined } from '../lib/clipboard-share';
import { fetchShare } from '../lib/share-lookup';

// App-open clipboard detection (spec §App-open clipboard prompt): if the user
// copied a Prototo link, offer it in one tap. hasUrl gate keeps iOS quiet
// until there is actually a URL to look at.
export function ClipboardPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<{ token: string; name: string | null } | null>(null);
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const token = await detectClipboardShare();
      if (!token || (await wasDeclined(token))) return;
      if (pathname === `/p/${token}`) return; // already looking at it
      const res = await fetchShare(token);
      setPrompt({ token, name: res.ok ? res.share.appName : null });
    } finally {
      checking.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  useEffect(() => {
    const timing = { duration: 320, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };
    opacity.value = withTiming(prompt ? 1 : 0, timing);
    translateY.value = withTiming(prompt ? 0 : 16, timing);
  }, [prompt, opacity, translateY]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!prompt) return null;

  const dismiss = () => {
    void rememberDecline(prompt.token);
    setPrompt(null);
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={cardStyle}>
          <GlassView style={styles.card}>
            <Stack gap={12}>
              <Text size="headline">{prompt.name ? `Open ${prompt.name}?` : 'Open your copied link?'}</Text>
              <Text size="body" color="secondary">
                You copied a Prototo link.
              </Text>
              <Stack gap={8}>
                <Button
                  label="Open"
                  variant="primary"
                  onPress={() => {
                    const token = prompt.token;
                    setPrompt(null);
                    router.push(`/p/${token}`);
                  }}
                />
                <Button label="Not now" variant="ghost" onPress={dismiss} />
              </Stack>
            </Stack>
          </GlassView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 32,
  },
  card: { borderRadius: 20, padding: 20, overflow: 'hidden' },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (If GlassView needs an explicit background for legibility on older iOS fallback, add `backgroundColor: theme.surface.card` via `useTheme` — acceptable divergence.)

- [ ] **Step 3: Commit**

```bash
git add components/ClipboardPrompt.tsx
git commit -m "viewer: app-open clipboard prompt (Open <name>? with remembered decline)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Layout swap — custom bar replaces NativeTabs, prompt mounted

**Files:**
- Modify: `app/home/_layout.tsx` (full replacement)

**Interfaces:**
- Consumes: `HomeBar` (Task 3), `ClipboardPrompt` (Task 5).
- Produces: `home/index` and `home/profile` render inside a Stack with no native tab bar; HomeBar overlays both; the FAB pulse is self-contained in HomeBar (once per cold start).

- [ ] **Step 1: Replace `app/home/_layout.tsx`**:

```tsx
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { HomeBar } from '../../components/HomeBar';
import { ClipboardPrompt } from '../../components/ClipboardPrompt';

export default function HomeLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      <HomeBar />
      <ClipboardPrompt />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck** (with Task 6 done, or the import commented)

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/home/_layout.tsx
git commit -m "viewer: custom HomeBar layout replaces native tabs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Scanner portal — clipboard banner inside `/connect`

**Files:**
- Modify: `app/connect.tsx` (add the bottom slot; DO NOT touch the scanning/security logic)

**Interfaces:**
- Consumes: `detectClipboardShare` (Task 2), `fetchShare`, GlassView, reanimated.
- Produces: inside the camera screen, a bottom slot: banner ("Link on your clipboard" + accent "Open <name>") when a share link is detected, else hint text "Copy a Prototo link and it appears here." Banner tap → `router.replace('/p/<token>')`.

- [ ] **Step 1: Add the slot.** In `app/connect.tsx`, add imports:

```tsx
import { GlassView } from 'expo-glass-effect';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react'; // merge into the existing react import
import { detectClipboardShare } from '../lib/clipboard-share';
import { fetchShare } from '../lib/share-lookup';
```

Inside the component (after existing state), add:

```tsx
const [clip, setClip] = useState<{ token: string; name: string | null } | null>(null);

useEffect(() => {
  let active = true;
  void detectClipboardShare().then(async (token) => {
    if (!token || !active) return;
    const res = await fetchShare(token);
    if (active) setClip({ token, name: res.ok ? res.share.appName : null });
  });
  return () => {
    active = false;
  };
}, []);

const slotOpacity = useSharedValue(0);
useEffect(() => {
  slotOpacity.value = withTiming(1, {
    duration: 350,
    easing: Easing.out(Easing.quad),
    reduceMotion: ReduceMotion.System,
  });
}, [clip, slotOpacity]);
const slotStyle = useAnimatedStyle(() => ({ opacity: slotOpacity.value }));
```

In the granted-permission JSX, inside the camera container (below the `CameraView`, above any existing error text), add the slot overlay:

```tsx
<Animated.View style={[{ position: 'absolute', left: 16, right: 16, bottom: 24 }, slotStyle]}>
  {clip ? (
    <GlassView style={{ borderRadius: 16, overflow: 'hidden' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 14,
          gap: 10,
        }}
      >
        <Text size="body">Link on your clipboard</Text>
        <Button
          label={clip.name ? `Open ${clip.name}` : 'Open link'}
          variant="primary"
          onPress={() => router.replace(`/p/${clip.token}`)}
        />
      </View>
    </GlassView>
  ) : (
    <Text size="caption" color="secondary" style={{ textAlign: 'center' }}>
      Copy a Prototo link and it appears here.
    </Text>
  )}
</Animated.View>
```

Adjust to the file's actual JSX structure (the camera view container is a `View` with `StyleSheet` styles; the slot must be a sibling overlay inside it). The permission screens' copy stays as-is except the title line "Scan to connect" body text: change "Prototo needs your camera to scan the QR code from proto start." to "Prototo needs your camera to scan a prototype's QR code." (recipients scan share QRs, not just proto start).

- [ ] **Step 2: Typecheck + full suite**

Run: `pnpm vitest run && npx tsc --noEmit`
Expected: green/clean — connect-url and share-link tests untouched.

- [ ] **Step 3: Commit**

```bash
git add app/connect.tsx
git commit -m "viewer: scanner portal — clipboard banner inside /connect

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: On-sim verification + docs

**Files:**
- Modify: `docs/STATUS.md` (one line in Done recently), `docs/BACKLOG.md` (mark the absorbed items)

**Interfaces:** none — verification gate.

- [ ] **Step 1: Full suite + tsc**

Run: `pnpm vitest run && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 2: Release-sim run** (dedicated sim, per `docs/RELEASE-CHECKLIST.md`; NEVER the desktop's booted sim):

```bash
UDID=$(xcrun simctl list devices | grep "Prototo-Test" | grep -oE "[A-F0-9-]{36}" | head -1)
npx expo run:ios --configuration Release --device "$UDID"
```

Then with an injected signed-in session (see `scripts/sim-e2e.sh` header for minting):
- Fresh account: empty state renders with the dashed card; HomeBar shows pill left + FAB right; FAB opens the camera.
- Copy `https://prototo.app/p/CJCGN93R04XQ` to the sim clipboard (`xcrun simctl pbcopy`), background + foreground the app: the "Open botim?" glass prompt appears; Not now → re-foreground → no re-prompt.
- Open the scanner with the link still on the clipboard: banner "Link on your clipboard / Open botim" shows; tap → prototype loads.
- After opening: home shows it under Recently viewed; with the owner session injected instead, the same card carries the "Yours" badge and a "Yours" section lists published shares.
- Screenshot each state for Sheri.

- [ ] **Step 3: Run the release gate script**

Run: `bash scripts/sim-e2e.sh --udid "$UDID" --session <session.json> --skip-build`
Expected: PASS (routes unchanged).

- [ ] **Step 4: Docs + commit**

`docs/BACKLOG.md`: mark "Remove the pinned sample prototype", "Bring back a scanner entry point", and "Home rethink" as DONE (date + spec link) under the stakeholder revamp section. `docs/STATUS.md`: one Done-recently line.

```bash
git add docs/STATUS.md docs/BACKLOG.md
git commit -m "viewer: home redesign shipped in-repo — docs updated

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
