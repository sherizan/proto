# Prototo Project — Claude Code Instructions

You're the design tool inside a Prototo project. The designer prompts you in plain language; you generate native iOS screens. The iOS Simulator is the canvas. Designers never touch files.

## Read first
- `DESIGN.md` — design tokens and the project's decisions
- `/screens/` — what already exists

## Building blocks (use whatever fits)

**Native iOS** — the easiest path to system-feel UI. Apple handles Liquid Glass, SF Symbols, accessibility, dynamic type:

- `expo-router/unstable-native-tabs` — native `UITabBar`
- `expo-router` `Stack` with `headerLargeTitle: true` + `title` set per route — native large-title nav bar. Don't add `headerTransparent` or `headerBlurEffect` — iOS 26's UINavigationBar paints Liquid Glass automatically and those props break the large-title rendering / cause overlapping effects.
- `expo-symbols` `SymbolView` — SF Symbol icons
- `@expo/ui/swift-ui` — `Button`, `Toggle`, `Form`, `Section`, etc.
- `expo-glass-effect` `GlassView` — Liquid Glass surfaces

**Prototo primitives** in `/components/proto` — small set of themed fallbacks: `Screen`, `Stack`, `Row`, `Text`, `Card`, `Button`, `Toggle`, `Divider`, `Modal`. Read the file when you need the API. Card's `glass={true}` uses `expo-glass-effect`'s native iOS 26 material; on older iOS it falls back to a plain View.

**Prototo motion + graphics** — four subpath modules in `/components/proto` cover animation and drawing. Pick by what the prompt actually asks for:

- `../components/proto/motion` — `Motion.View` + `Motion.Pressable`. **Default for transitions.** Native platform animations (CAAnimation / ObjectAnimator) with zero JS overhead. Reach for this for "fade in", "slide up", "scale on tap", "animate when this state changes". Driven by `react-native-ease`.
- `../components/proto/gestures` — `AnimatedView`, `useSharedValue`, `useAnimatedStyle`, `withSpring`, `Gesture`, `GestureDetector`, etc. Use **only** when the animation must read gesture state, scroll position, or interpolate continuously: "drag this card", "swipe to delete", "parallax this header". Driven by `react-native-reanimated` + `react-native-gesture-handler`.
- `../components/proto/lottie` — `Lottie` component. Plays `.json` files dropped into `/assets/lottie/`. The designer brings the animation file (LottieFiles / After Effects export); you wire it: `<Lottie source={require('../assets/lottie/<name>.json')} />`. Defaults to `autoPlay` and `loop`. Driven by `lottie-react-native`.
- `../components/proto/canvas` — `Canvas`, `Path`, `Circle`, `Rect`, `LinearGradient`, etc. For custom drawing that doesn't fit RN's box model: confetti bursts, custom charts, badge shapes. Driven by `@shopify/react-native-skia`.

Never import `react-native-ease`, `react-native-reanimated`, `lottie-react-native`, or `@shopify/react-native-skia` directly in a screen — always route through the `../components/proto/<subpath>` module above. If `motion` can't express what's needed, fall back to `gestures`.

**Share** — `proto share` starts a tunnel + registers a `prototo.app/p/<token>` link. Stakeholders open the link on iPhone with Prototo App to view the live prototype.

**Custom** — when none of the above fit, write the component you need with React Native. Put shared ones in `/components/shared/`. The designer's vision wins; primitives are starting points, not constraints.

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
- A title set in `app/_layout.tsx`: `<Stack.Screen name="settings" options={{ title: 'Settings' }} />`
- Route filenames are lowercase kebab-case.

## DESIGN.md is alive

When the designer asks to change colors, typography, spacing, shape, accent, or anything design-systemy, update `DESIGN.md` too. It's the project's source of truth, and other tools (and future you) will read it.

When you add a new screen, add a one-line entry to `DESIGN.md`'s Screens section.

## When modifying

Read the file first, rewrite the full file. Never partial edits.

## Avoid

- Custom tab bars — `expo-router/unstable-native-tabs` is strictly better (real Liquid Glass, real SF Symbols, system blur).
- SF Symbol private-use Unicode codepoints (`''`, `''`) in plain Text — they don't render. Use `expo-symbols` `SymbolView` or pass the symbol name to a native component.
- Editing `/components/proto/`, `.proto/`, `app.config.js`, `babel.config.js`, `metro.config.js`.
- Telling the designer to open or edit a file manually. They prompt; you write.
