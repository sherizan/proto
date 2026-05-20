# Proto Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Proto React Native component library — 10 components, theme system with `liquidGlass` + `materialYou` tokens, and a designer-driven customisation surface — as source files that `create-proto` will later copy into scaffolded projects.

**Architecture:** No runtime build. Components live as `.tsx` source under `packages/proto-components/src/`. `useTheme()` reads `proto.config.js` from a known relative path (`../../proto.config.js`) — at dev time, that resolves to a workspace stub at `packages/proto.config.js`; in a scaffolded project, it resolves to the user's real config. Every component reads from the merged theme. Designers customise via `tokens` overrides in `proto.config.js` (no source edits required).

**Tech Stack:** TypeScript, React Native, react-native-safe-area-context, react-native-reanimated, react-native-gesture-handler, expo-haptics, @react-native-community/blur. Vitest available at workspace level but unused here (no tests for RN components per CLAUDE.md). Verification is `tsc --noEmit` only.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-20-proto-components-design.md`
- Master doc §10, §11 — component contracts and exact token values
- CLAUDE.md — no tests for `proto-components/`

---

## File Structure

**Workspace dev stub:**
- Create: `packages/proto.config.js` — typecheck-only stub so `useTheme.ts` resolves a real config object at dev time.

**Package config:**
- Modify: `packages/proto-components/package.json` — add peer + dev dependencies, add `jsx` typecheck script.
- Create: `packages/proto-components/tsconfig.json` — extends `tsconfig.base.json`, sets `jsx: "react-native"`, `noEmit: true`.

**Types and theme:**
- Create: `packages/proto-components/src/types.ts` — `Theme`, `ThemeName`, `ThemeOverrides`, `ProtoConfig` types.
- Create: `packages/proto-components/src/tokens/liquidGlass.ts` — iOS-26-flavoured tokens, byte-matches master doc §11.
- Create: `packages/proto-components/src/tokens/materialYou.ts` — Material You tokens, byte-matches master doc §11.
- Create: `packages/proto-components/src/useTheme.ts` — reads `../../proto.config.js`, deep-merges `tokens` overrides onto base theme, exports `useTheme` and `useAccent`.

**Primitives (visual atoms):**
- Create: `packages/proto-components/src/Stack.tsx`
- Create: `packages/proto-components/src/Row.tsx`
- Create: `packages/proto-components/src/Divider.tsx`
- Create: `packages/proto-components/src/Text.tsx`

**Surfaces and chrome:**
- Create: `packages/proto-components/src/Screen.tsx`
- Create: `packages/proto-components/src/Card.tsx`
- Create: `packages/proto-components/src/Modal.tsx`
- Create: `packages/proto-components/src/Nav.tsx`

**Controls:**
- Create: `packages/proto-components/src/Button.tsx`
- Create: `packages/proto-components/src/Toggle.tsx`

**Barrel:**
- Create: `packages/proto-components/src/index.ts` — re-exports all components, `useTheme`, `useAccent`, and types.

**Ambient module shim (only if needed):**
- Conditionally create: `packages/proto-components/src/proto-config.d.ts` — declares the shape of the imported `.js` module so TS resolves it cleanly.

---

## Task 1: Workspace dependencies and tsconfig

**Files:**
- Modify: `packages/proto-components/package.json`
- Create: `packages/proto-components/tsconfig.json`
- Create: `packages/proto.config.js`

- [ ] **Step 1: Replace `packages/proto-components/package.json`**

```json
{
  "name": "proto-components",
  "version": "0.0.0",
  "description": "Proto React Native component library — Screen, Stack, Text, Card, Button, Toggle, Nav, Modal, Divider",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "files": ["src"],
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "peerDependencies": {
    "react": "*",
    "react-native": "*",
    "react-native-safe-area-context": "*",
    "react-native-reanimated": "*",
    "expo-haptics": "*",
    "@react-native-community/blur": "*"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "react": "18.3.1",
    "react-native": "0.74.0",
    "react-native-safe-area-context": "4.10.0",
    "react-native-reanimated": "3.10.0",
    "expo-haptics": "13.0.0",
    "@react-native-community/blur": "4.4.1"
  }
}
```

- [ ] **Step 2: Create `packages/proto-components/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-native",
    "noEmit": true,
    "allowJs": true,
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["react"]
  },
  "include": ["src/**/*", "../proto.config.js"]
}
```

- [ ] **Step 3: Create `packages/proto.config.js`** (workspace dev stub)

```js
// Dev stub — only used when typechecking packages/proto-components/ standalone.
// In a scaffolded project, this file is replaced by the user's proto.config.js
// at the project root.
export default {
  name: 'Proto Components Dev',
  theme: 'liquidGlass',
  accentColor: '#007AFF',
};
```

- [ ] **Step 4: Install workspace dependencies**

Run: `pnpm install`
Expected: dependencies resolve; no error output. (Lockfile updates.)

- [ ] **Step 5: Verify typecheck script wires up (will fail — no source files yet)**

Run: `pnpm --filter proto-components typecheck`
Expected: tsc reports either "No inputs were found" or completes with no errors. Either is fine — we're confirming the toolchain runs.

- [ ] **Step 6: Commit**

```bash
git add packages/proto-components/package.json packages/proto-components/tsconfig.json packages/proto.config.js pnpm-lock.yaml
git commit -m "chore(proto-components): wire workspace deps and tsconfig"
```

---

## Task 2: Theme types

**Files:**
- Create: `packages/proto-components/src/types.ts`

- [ ] **Step 1: Create `packages/proto-components/src/types.ts`**

```ts
export type ThemeName = 'liquidGlass' | 'materialYou';

export type Theme = {
  surface: {
    primary: string;
    secondary: string;
    card: string;
    nav: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    destructive: string;
  };
  blur: {
    nav: number;
    card: number;
    modal: number;
  };
  border: {
    default: string;
    strong: string;
  };
  radius: {
    card: number;
    button: number;
    nav: number;
    modal: number;
  };
  space: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
};

export type ThemeOverrides = Partial<{
  surface: Partial<Theme['surface']>;
  text: Partial<Theme['text']>;
  blur: Partial<Theme['blur']>;
  border: Partial<Theme['border']>;
  radius: Partial<Theme['radius']>;
  space: Partial<Theme['space']>;
}>;

export type ProtoConfig = {
  name?: string;
  theme?: ThemeName;
  accentColor?: string;
  tokens?: ThemeOverrides;
  screens?: { initial?: string };
};
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add packages/proto-components/src/types.ts
git commit -m "feat(proto-components): add Theme, ThemeOverrides, ProtoConfig types"
```

---

## Task 3: Liquid Glass token set

**Files:**
- Create: `packages/proto-components/src/tokens/liquidGlass.ts`

- [ ] **Step 1: Create `packages/proto-components/src/tokens/liquidGlass.ts`**

```ts
import type { Theme } from '../types';

export const liquidGlass: Theme = {
  surface: {
    primary: 'rgba(255, 255, 255, 0.72)',
    secondary: 'rgba(255, 255, 255, 0.48)',
    card: 'rgba(255, 255, 255, 0.6)',
    nav: 'rgba(255, 255, 255, 0.82)',
  },
  text: {
    primary: '#000000',
    secondary: 'rgba(0, 0, 0, 0.5)',
    tertiary: 'rgba(0, 0, 0, 0.3)',
    destructive: '#FF3B30',
  },
  blur: {
    nav: 40,
    card: 20,
    modal: 60,
  },
  border: {
    default: 'rgba(255, 255, 255, 0.4)',
    strong: 'rgba(255, 255, 255, 0.7)',
  },
  radius: {
    card: 22,
    button: 14,
    nav: 0,
    modal: 44,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};
```

- [ ] **Step 2: Verify against master doc §11**

Open `docs/proto-master.md`, find the `liquidGlass` block in §11. Compare every value. They must match byte-for-byte.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/proto-components/src/tokens/liquidGlass.ts
git commit -m "feat(proto-components): add liquidGlass token set"
```

---

## Task 4: Material You token set

**Files:**
- Create: `packages/proto-components/src/tokens/materialYou.ts`

- [ ] **Step 1: Create `packages/proto-components/src/tokens/materialYou.ts`**

```ts
import type { Theme } from '../types';

export const materialYou: Theme = {
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
  blur: {
    nav: 0,
    card: 0,
    modal: 0,
  },
  border: {
    default: '#CAC4D0',
    strong: '#79747E',
  },
  radius: {
    card: 12,
    button: 20,
    nav: 0,
    modal: 28,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};
```

- [ ] **Step 2: Verify against master doc §11**

Open `docs/proto-master.md`, find the `materialYou` block in §11. Every value must match byte-for-byte.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/proto-components/src/tokens/materialYou.ts
git commit -m "feat(proto-components): add materialYou token set"
```

---

## Task 5: useTheme with deep-merge of designer overrides

**Files:**
- Create: `packages/proto-components/src/useTheme.ts`

- [ ] **Step 1: Create `packages/proto-components/src/useTheme.ts`**

```ts
import config from '../../proto.config.js';
import { liquidGlass } from './tokens/liquidGlass';
import { materialYou } from './tokens/materialYou';
import type { ProtoConfig, Theme, ThemeName, ThemeOverrides } from './types';

const themes: Record<ThemeName, Theme> = {
  liquidGlass,
  materialYou,
};

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

const cfg = config as ProtoConfig;

export function useTheme(): Theme {
  const name: ThemeName = cfg.theme ?? 'liquidGlass';
  const base = themes[name] ?? themes.liquidGlass;
  return mergeTheme(base, cfg.tokens);
}

export function useAccent(): string {
  return cfg.accentColor ?? '#007AFF';
}
```

- [ ] **Step 2: Handle the JS-import type resolution**

The default import of a `.js` file with no declaration will trigger TS error TS7016 ("Could not find a declaration file"). Create `packages/proto-components/src/proto-config.d.ts`:

```ts
declare module '*proto.config.js' {
  import type { ProtoConfig } from './types';
  const config: ProtoConfig;
  export default config;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/proto-components/src/useTheme.ts packages/proto-components/src/proto-config.d.ts
git commit -m "feat(proto-components): add useTheme with designer override merge"
```

---

## Task 6: Stack (vertical layout primitive)

**Files:**
- Create: `packages/proto-components/src/Stack.tsx`

- [ ] **Step 1: Create `packages/proto-components/src/Stack.tsx`**

```tsx
import { View, type ViewProps } from 'react-native';
import type { ReactNode } from 'react';

export type StackProps = {
  gap?: number;
  padding?: number;
  children?: ReactNode;
  style?: ViewProps['style'];
};

export function Stack({ gap = 0, padding = 0, style, children }: StackProps) {
  return (
    <View style={[{ flexDirection: 'column', gap, padding }, style]}>
      {children}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/proto-components/src/Stack.tsx
git commit -m "feat(proto-components): add Stack primitive"
```

---

## Task 7: Row (horizontal layout primitive)

**Files:**
- Create: `packages/proto-components/src/Row.tsx`

- [ ] **Step 1: Create `packages/proto-components/src/Row.tsx`**

```tsx
import { View, type ViewProps } from 'react-native';
import type { ReactNode } from 'react';

export type RowProps = {
  gap?: number;
  align?: 'start' | 'center' | 'end';
  children?: ReactNode;
  style?: ViewProps['style'];
};

const alignMap = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
} as const;

export function Row({ gap = 0, align = 'start', style, children }: RowProps) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: alignMap[align], gap },
        style,
      ]}
    >
      {children}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/proto-components/src/Row.tsx
git commit -m "feat(proto-components): add Row primitive"
```

---

## Task 8: Divider (hairline)

**Files:**
- Create: `packages/proto-components/src/Divider.tsx`

- [ ] **Step 1: Create `packages/proto-components/src/Divider.tsx`**

```tsx
import { View } from 'react-native';
import { useTheme } from './useTheme';

export function Divider() {
  const theme = useTheme();
  return (
    <View
      style={{
        height: 1,
        width: '100%',
        backgroundColor: theme.border.default,
      }}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/proto-components/src/Divider.tsx
git commit -m "feat(proto-components): add Divider primitive"
```

---

## Task 9: Text (themed typography)

**Files:**
- Create: `packages/proto-components/src/Text.tsx`

- [ ] **Step 1: Create `packages/proto-components/src/Text.tsx`**

```tsx
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme, useAccent } from './useTheme';

export type TextSize = 'title' | 'headline' | 'body' | 'caption' | 'label';
export type TextColor = 'primary' | 'secondary' | 'accent' | 'destructive';

export type TextProps = {
  size?: TextSize;
  color?: TextColor;
  children?: ReactNode;
  style?: RNTextProps['style'];
};

const sizeMap: Record<TextSize, { fontSize: number; fontWeight: RNTextProps['style'] extends infer S ? string : never }> = {
  title: { fontSize: 34, fontWeight: '700' as never },
  headline: { fontSize: 22, fontWeight: '600' as never },
  body: { fontSize: 17, fontWeight: '400' as never },
  caption: { fontSize: 13, fontWeight: '400' as never },
  label: { fontSize: 13, fontWeight: '600' as never },
};

export function Text({ size = 'body', color = 'primary', style, children }: TextProps) {
  const theme = useTheme();
  const accent = useAccent();
  const palette = {
    primary: theme.text.primary,
    secondary: theme.text.secondary,
    accent,
    destructive: theme.text.destructive,
  };
  const { fontSize, fontWeight } = sizeMap[size];
  return (
    <RNText
      style={[
        { fontSize, fontWeight: fontWeight as RNTextProps['style'] extends { fontWeight?: infer W } ? W : never, color: palette[color] },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
```

Note: the `fontWeight` typing in React Native is `"normal" | "bold" | "100" ... "900" | undefined`. The complicated cast above keeps strict mode happy without `as any`. If you prefer simpler, replace the map values with literal `fontWeight: '700' as const` and accept the `as const` propagation.

**Simpler alternative (use this if the above is awkward):**

```tsx
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme, useAccent } from './useTheme';

export type TextSize = 'title' | 'headline' | 'body' | 'caption' | 'label';
export type TextColor = 'primary' | 'secondary' | 'accent' | 'destructive';

export type TextProps = {
  size?: TextSize;
  color?: TextColor;
  children?: ReactNode;
  style?: RNTextProps['style'];
};

const sizeMap: Record<TextSize, { fontSize: number; fontWeight: TextStyle['fontWeight'] }> = {
  title: { fontSize: 34, fontWeight: '700' },
  headline: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 17, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
};

export function Text({ size = 'body', color = 'primary', style, children }: TextProps) {
  const theme = useTheme();
  const accent = useAccent();
  const palette: Record<TextColor, string> = {
    primary: theme.text.primary,
    secondary: theme.text.secondary,
    accent,
    destructive: theme.text.destructive,
  };
  return (
    <RNText style={[sizeMap[size], { color: palette[color] }, style]}>
      {children}
    </RNText>
  );
}
```

Use the simpler alternative.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/proto-components/src/Text.tsx
git commit -m "feat(proto-components): add Text component with theme-aware sizes and colors"
```

---

## Task 10: Screen (safe-area-aware wrapper)

**Files:**
- Create: `packages/proto-components/src/Screen.tsx`

- [ ] **Step 1: Create `packages/proto-components/src/Screen.tsx`**

```tsx
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';
import { Text } from './Text';

export type ScreenProps = {
  title?: string;
  scrollable?: boolean;
  children?: ReactNode;
};

export function Screen({ title, scrollable = true, children }: ScreenProps) {
  const theme = useTheme();
  const Body = scrollable ? ScrollView : View;
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.surface.primary }}
      edges={['top', 'left', 'right']}
    >
      {title ? (
        <View style={{ paddingHorizontal: theme.space.md, paddingTop: theme.space.md, paddingBottom: theme.space.sm }}>
          <Text size="title">{title}</Text>
        </View>
      ) : null}
      <Body
        style={{ flex: 1 }}
        contentContainerStyle={
          scrollable
            ? { padding: theme.space.md, gap: theme.space.md }
            : undefined
        }
      >
        {scrollable ? children : <View style={{ flex: 1, padding: theme.space.md }}>{children}</View>}
      </Body>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/proto-components/src/Screen.tsx
git commit -m "feat(proto-components): add Screen wrapper with safe-area and optional scroll"
```

---

## Task 11: Card (with optional glass)

**Files:**
- Create: `packages/proto-components/src/Card.tsx`

- [ ] **Step 1: Create `packages/proto-components/src/Card.tsx`**

```tsx
import { Platform, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';

export type CardProps = {
  glass?: boolean;
  padding?: number;
  children?: ReactNode;
};

export function Card({ glass = false, padding, children }: CardProps) {
  const theme = useTheme();
  const pad = padding ?? theme.space.md;

  if (glass) {
    return (
      <View
        style={{
          borderRadius: theme.radius.card,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.border.default,
        }}
      >
        <BlurView
          style={{ padding: pad }}
          blurType={Platform.OS === 'ios' ? 'light' : 'light'}
          blurAmount={theme.blur.card}
          reducedTransparencyFallbackColor={theme.surface.card}
        >
          {children}
        </BlurView>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: theme.surface.card,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        borderColor: theme.border.default,
        padding: pad,
      }}
    >
      {children}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/proto-components/src/Card.tsx
git commit -m "feat(proto-components): add Card with optional glass blur"
```

---

## Task 12: Button (with press animation and haptics)

**Files:**
- Create: `packages/proto-components/src/Button.tsx`

- [ ] **Step 1: Create `packages/proto-components/src/Button.tsx`**

```tsx
import { Pressable, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme, useAccent } from './useTheme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  onPress?: () => void;
};

export function Button({ label, variant = 'primary', onPress }: ButtonProps) {
  const theme = useTheme();
  const accent = useAccent();
  const scale = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 80 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
  };
  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress?.();
  };

  const palette: Record<ButtonVariant, { bg: string; fg: string }> = {
    primary: { bg: accent, fg: '#FFFFFF' },
    secondary: { bg: theme.surface.secondary, fg: theme.text.primary },
    ghost: { bg: 'transparent', fg: accent },
    destructive: { bg: theme.text.destructive, fg: '#FFFFFF' },
  };
  const { bg, fg } = palette[variant];

  const baseStyle: ViewStyle = {
    backgroundColor: bg,
    borderRadius: theme.radius.button,
    paddingVertical: theme.space.sm + 4,
    paddingHorizontal: theme.space.md,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress}>
      <Animated.View style={[baseStyle, animated]}>
        <Text size="label" style={{ color: fg }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/proto-components/src/Button.tsx
git commit -m "feat(proto-components): add Button with press animation and haptics"
```

---

## Task 13: Toggle (themed switch)

**Files:**
- Create: `packages/proto-components/src/Toggle.tsx`

- [ ] **Step 1: Create `packages/proto-components/src/Toggle.tsx`**

```tsx
import { Switch, View } from 'react-native';
import { useAccent, useTheme } from './useTheme';
import { Text } from './Text';

export type ToggleProps = {
  label: string;
  value: boolean;
  onChange?: (value: boolean) => void;
};

export function Toggle({ label, value, onChange }: ToggleProps) {
  const theme = useTheme();
  const accent = useAccent();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.space.sm,
      }}
    >
      <Text size="body">{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.border.default, true: accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/proto-components/src/Toggle.tsx
git commit -m "feat(proto-components): add Toggle with themed switch"
```

---

## Task 14: Nav (bottom bar with glass)

**Files:**
- Create: `packages/proto-components/src/Nav.tsx`

- [ ] **Step 1: Create `packages/proto-components/src/Nav.tsx`**

```tsx
import { Platform, Pressable, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useTheme, useAccent } from './useTheme';
import { Text } from './Text';

export type NavTab = {
  icon: string;
  label: string;
  screen: string;
};

export type NavProps = {
  tabs: NavTab[];
  active?: string;
  onSelect?: (screen: string) => void;
};

export function Nav({ tabs, active, onSelect }: NavProps) {
  const theme = useTheme();
  const accent = useAccent();

  const content = (
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.md,
        borderTopWidth: 1,
        borderTopColor: theme.border.default,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.screen === active;
        return (
          <Pressable
            key={tab.screen}
            onPress={() => onSelect?.(tab.screen)}
            style={{ flex: 1, alignItems: 'center', gap: 2 }}
          >
            <Text size="label" style={{ color: isActive ? accent : theme.text.secondary }}>
              {tab.icon}
            </Text>
            <Text size="caption" style={{ color: isActive ? accent : theme.text.secondary }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (theme.blur.nav > 0) {
    return (
      <BlurView
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        blurType={Platform.OS === 'ios' ? 'light' : 'light'}
        blurAmount={theme.blur.nav}
        reducedTransparencyFallbackColor={theme.surface.nav}
      >
        {content}
      </BlurView>
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.surface.nav,
      }}
    >
      {content}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/proto-components/src/Nav.tsx
git commit -m "feat(proto-components): add Nav bottom bar with glass blur"
```

---

## Task 15: Modal (bottom sheet)

**Files:**
- Create: `packages/proto-components/src/Modal.tsx`

- [ ] **Step 1: Create `packages/proto-components/src/Modal.tsx`**

```tsx
import { Modal as RNModal, Pressable, View } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';
import { Text } from './Text';

export type ModalProps = {
  title: string;
  visible: boolean;
  onClose?: () => void;
  children?: ReactNode;
};

export function Modal({ title, visible, onClose, children }: ModalProps) {
  const theme = useTheme();
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            marginTop: 'auto',
            backgroundColor: theme.surface.primary,
            borderTopLeftRadius: theme.radius.modal,
            borderTopRightRadius: theme.radius.modal,
            padding: theme.space.lg,
            gap: theme.space.md,
          }}
        >
          <Text size="headline">{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/proto-components/src/Modal.tsx
git commit -m "feat(proto-components): add Modal bottom sheet"
```

---

## Task 16: Barrel export and final verification

**Files:**
- Create: `packages/proto-components/src/index.ts`

- [ ] **Step 1: Create `packages/proto-components/src/index.ts`**

```ts
export { Screen, type ScreenProps } from './Screen';
export { Stack, type StackProps } from './Stack';
export { Row, type RowProps } from './Row';
export { Text, type TextProps, type TextSize, type TextColor } from './Text';
export { Card, type CardProps } from './Card';
export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { Toggle, type ToggleProps } from './Toggle';
export { Divider } from './Divider';
export { Nav, type NavProps, type NavTab } from './Nav';
export { Modal, type ModalProps } from './Modal';
export { useTheme, useAccent } from './useTheme';
export type { Theme, ThemeName, ThemeOverrides, ProtoConfig } from './types';
```

- [ ] **Step 2: Final typecheck**

Run: `pnpm --filter proto-components typecheck`
Expected: PASS, zero errors, all exports resolve.

- [ ] **Step 3: Verify acceptance criteria from spec**

Open `docs/superpowers/specs/2026-05-20-proto-components-design.md` and confirm:
- All 10 components exported from `src/index.ts` ✓
- `liquidGlass.ts` and `materialYou.ts` match master doc §11 (already verified in tasks 3 + 4)
- `useTheme` falls back to `liquidGlass` when `config.theme` is missing or unknown (read `useTheme.ts` lines that handle the fallback)
- `useTheme` deep-merges `tokens` overrides (read `mergeTheme`)
- No raw RN primitive imports leak outside `proto-components/` (this codebase only contains proto-components so far — confirmed)

- [ ] **Step 4: Commit**

```bash
git add packages/proto-components/src/index.ts
git commit -m "feat(proto-components): add barrel export for all components and theme API"
```

- [ ] **Step 5: Push the proto-components work**

Run: `git push origin main`
Expected: clean push, no force needed.

---

## Out of scope reminders

- No tests in this package — RN components validated on device per CLAUDE.md.
- No `dist/` build — package consumed as source by `create-proto` template (Task in next plan) and as `.ts` source in workspace.
- No iOS 26 native Liquid Glass module — using `@react-native-community/blur` as the v1 implementation. Native module wiring is deferred to Phase 2 with the custom dev client.
- No expo-router wiring — `Nav` ships as a visual primitive only. Routing lives in the scaffolded project's `.proto/app/`.

## Self-review notes

- **Spec coverage:** Every spec section maps to a task. `Designer customisation surface` is implemented in Task 5 (`mergeTheme`) and Task 2 (`ThemeOverrides` type). Acceptance criteria checked in Task 16.
- **Placeholders:** none — every step has runnable code or a concrete command.
- **Type consistency:** `Theme`, `ThemeName`, `ThemeOverrides`, `ProtoConfig` defined in Task 2 and used identically across Tasks 3–16. Component prop type names (`ScreenProps`, `StackProps`, …) match the barrel exports in Task 16.
- **Known sharp edge:** the `Text` component lists two alternatives — use the simpler `TextStyle['fontWeight']` typing. The first variant is documented as a reference for why the cast is needed but the executor should use the second block.
