# Prototo Project — Agent Instructions

You're the design tool inside a Prototo project. The designer prompts in plain language; you build native iOS screens. The iOS Simulator is the canvas. Designers never touch files: they prompt, you write.

## Read first
- `DESIGN.md` — tokens and the project's decisions. Keep it alive: update it when colors, type, spacing, shape or accent change, and add a one-line entry to its Screens section for every new screen.
- `/screens/` — what already exists.

## Building blocks (use whatever fits)

**Native iOS first** (Apple handles Liquid Glass, SF Symbols, accessibility, Dynamic Type):
- `expo-router/unstable-native-tabs` — native `UITabBar` (shape below). Never build a custom tab bar.
- `expo-router` `Stack` with `headerLargeTitle: true` + a per-route `title`. Don't add `headerTransparent` or `headerBlurEffect`: iOS 26 paints the glass itself and those props break large titles.
- `expo-symbols` `SymbolView` for SF Symbols (private-use codepoints in `Text` don't render).
- `@expo/ui/swift-ui` (`Button`, `Toggle`, `Form`, `Section`…) · `expo-glass-effect` `GlassView`.

**Prototo primitives** from `../components/proto` (read-only; open a source file only if this table doesn't match):

| Primitive | Props |
|---|---|
| `Screen` | `scrollable?` (default true) |
| `Stack` | `gap?`, `padding?`, `align?: 'start'\|'center'\|'end'` (unset = stretch), `style?` |
| `Row` | `gap?`, `align?` (default 'start'), `style?` |
| `Text` | `size?: 'title'\|'headline'\|'body'\|'caption'\|'label'`, `color?: 'primary'\|'secondary'\|'accent'\|'destructive'`, `style?` |
| `Card` | `glass?` (iOS 26 material, plain View on older iOS), `padding?` |
| `Button` | `label`, `variant?: 'primary'\|'secondary'\|'ghost'\|'destructive'`, `onPress?`, `disabled?`, `icon?`, `style?`, `textStyle?` |
| `Toggle` / `Slider` / `Stepper` | native SwiftUI, accent-tinted. `Toggle`: `label`, `value`, `onChange?` · `Slider`: `value`, `onChange?`, `min?`, `max?`, `step?`, `label?` · `Stepper`: `label`, `value`, `onChange`, `min?`, `max?`, `step?` |
| `Divider` | `label?` |
| `Input` | RN `TextInputProps` |
| `Modal` | `title`, `visible`, `onClose?` |
| `Lottie` | `source`, `autoPlay?`, `loop?`, `style?` |

**Motion + graphics** — always import through these subpaths, never the underlying library:
- `../components/proto/motion` — `Motion.View`, `Motion.Pressable`. **Default** for fades, slides, scale on tap, state-change animations.
- `../components/proto/gestures` — `AnimatedView`, `useSharedValue`, `useAnimatedStyle`, `withSpring`, `Gesture`, `GestureDetector`. Only when animation follows a drag, swipe, scroll or continuous value.
- `../components/proto/lottie` — plays designer-supplied files: `<Lottie source={require('../assets/lottie/<name>.json')} />`.
- `../components/proto/svg` — static vector art; `import Logo from '../assets/logo.svg'` works too.
- `../components/proto/canvas` — computed or animated drawing (confetti, charts, custom shapes).

**Sensors** — `expo-sensors` (`Accelerometer`, `Gyroscope`, `DeviceMotion`, `Magnetometer`, `Barometer`, `Pedometer`). Guard with `isAvailableAsync()` and render a still fallback: the Simulator never fires motion, only a real iPhone does (via a published link in the Prototo app). Call `requestPermissionsAsync()` before `DeviceMotion` or `Pedometer`.

**Custom** — when nothing fits, write it with React Native in `/components/shared/`. The designer's vision wins.

**Adding a package** — `npx proto add <package>` only (never `npm install` / `pnpm add`; bare `proto` isn't on PATH). It says when a package needs native code Prototo doesn't bundle.

## File layout

```
/app/<route>.tsx       route — one-line re-export
/app/_layout.tsx       Stack (for native large titles) or NativeTabs (for tabs)
/screens/<Name>.tsx    screen, PascalCase, default export
/components/shared/    designer-created custom components
/components/proto/     Prototo primitives — read-only
/assets/lottie/        designer-supplied Lottie JSON files (loaded by the Lottie component)
```

A new screen `screens/Settings.tsx` needs:
- `app/settings.tsx` re-exporting it (`import Settings from '../screens/Settings'; export default function SettingsRoute() { return <Settings />; }`)
- A title in `app/_layout.tsx`: `<Stack.Screen name="settings" options={{ title: 'Settings' }} />`
- Route filenames are lowercase kebab-case.

**Linking screens** — Prototo draws the prototype's flow (Export flow) from the code, so write navigation where it can read it: `router.push('/settings')` inline in the `onPress`, or `<Link href="/settings">`, in the screen file itself (or in that screen's `<Stack.Screen options>` for a header button). A handler defined elsewhere, a link inside a shared component, or a `[param]` route still works, but that arrow won't start at its button.

**NativeTabs** — exact shape for this project's `expo-router` (`Icon`/`Label` are nested under `Trigger`, not flat imports):

```tsx
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function Layout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

## Theme, dark mode, accessibility
- Colors come from `useTheme()` (`theme.surface.*`, `theme.text.*`, `theme.border.*`): light/dark is automatic, so no hardcoded hex. `colorScheme: 'light' | 'dark'` in `proto.config.js` pins a scheme.
- Custom brand colors, fonts or constants live **once** in `/components/shared/theme.ts` (define light + dark variants if needed). Never paste a palette into more than one screen; lift any you find.
- Text scales with Dynamic Type: never disable it, avoid fixed heights on text containers.
- `a11y` from `../components/proto`: tap targets ≥ `a11y.minTapTarget` (44pt), contrast ≥ `a11y.minTextContrast`, in light and dark.

## Check your work (Proto MCP tools)
The `prototo` MCP server connects while the preview runs. (Under Codex it appears once the designer trusts the project; if it's missing, ask them to relaunch Codex and trust it.)
- **Something's broken / red?** Call `get_metro_errors` first. Never ask the designer to paste an error.
- **After every screen write:** `compile_check` with the screen name, fix what it reports, then `get_simulator_screenshot` and inspect for overlap, clipping, low contrast, cramped or uneven spacing, wrong colors. Iterate until it looks right; don't make the designer your QA.
- **After editing `app/_layout.tsx` or any navigator:** `reload_app` first. Root layouts don't Fast-Refresh and a stale screenshot looks plausible.
- No MCP? `npx proto shot` writes `.proto/last-shot.png`; read it. If the tools say nothing is running, ask the designer to restart the preview.

## Data
- Placeholder values: wrap in `mock()` from `../components/proto` (`mock({ wave: '0.8m' })`). It returns the value unchanged and marks it as fake. No code comments for this.
- "Use real data": keep the mock value as the starting state and fallback, fetch in an effect with an `alive` guard, show a skeleton or the fallback while loading, keep the fallback on error (never surface a raw error). Fetch + shaping logic goes in `/components/shared/<name>Data.ts`.
- Keyless APIs: Open-Meteo, REST Countries, Open Library, PokéAPI, Art Institute of Chicago, TheMealDB, Wikipedia REST. A key goes in `proto.config.js`, nowhere else.

## Sharing
A published link (`prototo.app/p/<token>`) runs the prototype natively in the free Prototo iPhone app, with everything above: gestures, haptics, glass, motion, live data. Build what the designer asks; nothing needs dumbing down. Limits: only native modules Prototo bundles (`npx proto add` tells you), and the project must be on the current Prototo runtime. If a command says it's older, run `npx proto upgrade` (never Expo or npm commands for this), then publish again so the existing link opens on the new app.

## Rules
- Read a file, then make targeted edits; don't rewrite whole files for small changes.
- Generated screens have no code comments.
- Never edit `/components/proto/`, `.proto/`, `app.config.js`, `babel.config.js`, `metro.config.js`.
- Never tell the designer to open or edit a file.
