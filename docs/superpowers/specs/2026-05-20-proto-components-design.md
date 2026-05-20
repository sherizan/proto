# Proto Components — Design Spec

> Date: 2026-05-20
> Unit: Phase 1, deliverable 2 (`packages/proto-components`)
> Source spec: `docs/proto-master.md` §6, §10, §11, §15 Prompt 3
> Foundation: `docs/superpowers/specs/2026-05-20-proto-foundation-design.md`

## Goal

Ship the Proto React Native component library — 10 components, theme system, two token sets — as **source files** that `create-proto` copies into a scaffolded project under `components/proto/`. Designer and engineer can read every component. No node_modules dependency at runtime.

## Decisions

| Decision | Choice |
|---|---|
| Distribution | Source copy via `create-proto` template (not npm dep at runtime) |
| Theme resolution | `useTheme` imports `proto.config.js` directly via relative path |
| Themes | `liquidGlass` and `materialYou` only — drop `base` from master doc §10 (update master doc separately) |
| File layout | One component per file under `src/` |
| Build | `tsc --noEmit` typecheck only — no `dist/` |
| Tests | None — per CLAUDE.md, RN components validated on device |

## Package shape

```
packages/
├── proto.config.js           (dev stub — see Dev preview)
└── proto-components/
    ├── package.json          (already exists)
    ├── tsconfig.json         (extends root, jsx: react-native)
    └── src/
        ├── index.ts          (barrel)
        ├── useTheme.ts
        ├── types.ts          (Theme type, ThemeName union)
        ├── tokens/
        │   ├── liquidGlass.ts
        │   └── materialYou.ts
        ├── Screen.tsx
        ├── Stack.tsx
        ├── Row.tsx
        ├── Text.tsx
        ├── Card.tsx
        ├── Button.tsx
        ├── Toggle.tsx
        ├── Divider.tsx
        ├── Nav.tsx
        └── Modal.tsx
```

When `create-proto` scaffolds a project, the `src/` contents (excluding tsconfig) are copied to `<project>/components/proto/`. The import path `../../proto.config.js` from `useTheme.ts` resolves to:
- **Scaffolded project:** `components/proto/useTheme.ts` → `../../proto.config.js` = `<project>/proto.config.js` ✓
- **Dev environment:** `packages/proto-components/src/useTheme.ts` → `../../proto.config.js` = `packages/proto.config.js`

We therefore place the dev stub at `packages/proto.config.js` (not repo root) — see "Dev preview" below.

## Theme system

**`types.ts`:**

```ts
export type ThemeName = 'liquidGlass' | 'materialYou';

export type Theme = {
  surface: { primary: string; secondary: string; card: string; nav: string };
  text: { primary: string; secondary: string; tertiary: string; destructive: string };
  blur: { nav: number; card: number; modal: number };
  border: { default: string; strong: string };
  radius: { card: number; button: number; nav: number; modal: number };
  space: { xs: number; sm: number; md: number; lg: number; xl: number };
};
```

**`useTheme.ts`:**

```ts
import config from '../../proto.config.js';
import { liquidGlass } from './tokens/liquidGlass';
import { materialYou } from './tokens/materialYou';
import type { Theme, ThemeName, ThemeOverrides } from './types';

const themes: Record<ThemeName, Theme> = { liquidGlass, materialYou };

function mergeTheme(base: Theme, overrides?: ThemeOverrides): Theme {
  if (!overrides) return base;
  return {
    surface: { ...base.surface, ...overrides.surface },
    text: { ...base.text, ...overrides.text },
    blur: { ...base.blur, ...overrides.blur },
    border: { ...base.border, ...overrides.border },
    radius: { ...base.radius, ...overrides.radius },
    space: { ...base.space, ...overrides.space },
  };
}

export function useTheme(): Theme {
  const name = (config.theme ?? 'liquidGlass') as ThemeName;
  const base = themes[name] ?? themes.liquidGlass;
  return mergeTheme(base, config.tokens);
}

export function useAccent(): string {
  return config.accentColor ?? '#007AFF';
}
```

No React context needed — `proto.config.js` is static for a session. If the designer changes the theme, Metro reloads.

**`ThemeProvider.tsx`:** dropped. Each component calls `useTheme()` directly. Master doc §15 Prompt 3 names it but doesn't justify it — without a runtime-mutable theme, there's nothing for the provider to do. Update master doc §15 Prompt 3 separately to match.

## Designer customisation surface

Two paths, both first-class:

**Path A — config tokens (no-code).** `proto.config.js` accepts a partial `tokens` block that overrides any leaf in the active theme. Pick a base (`liquidGlass` or `materialYou`) and override only what the brand requires.

```js
// proto.config.js
export default {
  name: 'Acme',
  theme: 'liquidGlass',
  accentColor: '#FF6B35',
  tokens: {
    surface: { card: 'rgba(255, 240, 230, 0.7)' },
    radius: { card: 28, button: 12 },
    text: { primary: '#1A0E08' },
  },
};
```

`useTheme()` deep-merges `tokens` onto the base. Every component picks up the change automatically. No file edits.

**Path B — source edit (deeper changes).** Components live as `.tsx` source at `components/proto/` in the scaffolded project (per the source-copy model). Designer or engineer can edit any component directly — replace the `Button` press animation, change the `Card` border treatment, swap typography weights — without leaving the project.

Generated screens (`proto add` in Phase 2) always go through Path A automatically: the Claude API system prompt includes the active token set.

**What's exposed:**

```ts
// types.ts — alongside Theme
export type ThemeOverrides = Partial<{
  surface: Partial<Theme['surface']>;
  text: Partial<Theme['text']>;
  blur: Partial<Theme['blur']>;
  border: Partial<Theme['border']>;
  radius: Partial<Theme['radius']>;
  space: Partial<Theme['space']>;
}>;
```

The `proto.config.js` shape in master doc §5 gets extended with `tokens?: ThemeOverrides` — update master doc separately.

## Components — contracts

Props match master doc §10 exactly. All components import only from `react`, `react-native`, `react-native-safe-area-context`, `react-native-reanimated`, `expo-haptics`, and `@react-native-community/blur`.

| Component | Notes |
|---|---|
| `Screen` | `title?: string`, `scrollable?: boolean` (default true). Wraps `SafeAreaView` + optional `ScrollView`. Background from `theme.surface.primary`. Title rendered in a top header area (no nav lib needed). |
| `Stack` | `gap?: number`, `padding?: number`. `flexDirection: 'column'`. |
| `Row` | `gap?: number`, `align?: 'start'\|'center'\|'end'`. `flexDirection: 'row'`. |
| `Text` | `size: 'title'\|'headline'\|'body'\|'caption'\|'label'`, `color?: 'primary'\|'secondary'\|'accent'\|'destructive'`. Maps to fontSize + weight table inside the component. |
| `Card` | `glass?: boolean`, `padding?: number` (default 16). If `glass`, render `BlurView` background with `theme.blur.card`. Else solid `theme.surface.card`. Applies `theme.radius.card`, `theme.border.default`. |
| `Button` | `label: string`, `variant: 'primary'\|'secondary'\|'ghost'\|'destructive'`, `onPress?`. `Pressable` with reanimated scale-down (0.96) on press-in. Optional `expo-haptics` selection feedback on press. |
| `Toggle` | `label: string`, `value: boolean`, `onChange?: (v: boolean) => void`. Native `Switch` styled with `accent` colour. |
| `Divider` | 1px hairline using `theme.border.default`, full width. |
| `Nav` | `tabs: Array<{ icon: string; label: string; screen: string }>`. Fixed bottom bar with `BlurView` background from `theme.surface.nav`. Tab routing is owned by expo-router (Phase 1 ships the visual primitive; routing wiring lives in the scaffolded project's `.proto/app/`). |
| `Modal` | `title: string`, `visible: boolean`, `onClose?`. Bottom sheet using RN `Modal` + animated translate. Backdrop tap closes. |

## index.ts (barrel)

Re-exports every component, `useTheme`, `useAccent`, and types.

## Dev preview question

For local development of `packages/proto-components/` itself, there is no `proto.config.js` at `../../`. `useTheme.ts` will fail typecheck.

**Resolution:** ship a `proto.config.js` stub at `packages/proto.config.js` (workspace-level, not repo root — matches the `../../` resolution from `useTheme.ts`). Content: `export default { theme: 'liquidGlass', accentColor: '#007AFF' };`. It's only consumed by the workspace's typecheck; when components are copied into a scaffolded project, the relative import resolves to the real `proto.config.js` written by `create-proto`.

Alternative considered: declare a module type via ambient `.d.ts`. Rejected — the stub is simpler and lets `tsc` resolve a real value.

## Acceptance

- `pnpm --filter proto-components typecheck` passes
- All 10 components export from `src/index.ts`
- `liquidGlass.ts` and `materialYou.ts` token files match master doc §11 byte-for-byte (verified by visual diff in PR)
- `useTheme` resolves to `liquidGlass` when config is missing or invalid (fallback)
- `tokens` overrides in `proto.config.js` deep-merge correctly (e.g. setting only `radius.card` preserves all other radius values)
- No raw RN primitive imports outside `proto-components`
- Master doc §5 updated: `proto.config.js` schema gains `tokens?: ThemeOverrides` (separate commit)
- Master doc §10 updated: drop `"base"` from theme union (separate commit)

## Out of scope

- Tests
- `dist/` build
- Material You haptics
- iOS 26 native Liquid Glass APIs (placeholder using `@react-native-community/blur` for now; native module wiring is Phase 2 with the custom dev client)
- Animation choreography beyond Button press-scale
