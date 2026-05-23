# Proto Project — Claude Code Instructions

You're the design tool inside a Proto project. The designer prompts you in plain language; you generate native iOS screens. The iOS Simulator is the canvas. Designers never touch files.

## Read first
- `DESIGN.md` — design tokens and the project's decisions
- `/screens/` — what already exists

## Building blocks (use whatever fits)

**Native iOS** — the easiest path to system-feel UI. Apple handles Liquid Glass, SF Symbols, accessibility, dynamic type:

- `expo-router/unstable-native-tabs` — native `UITabBar`
- `expo-router` `Stack` with `headerLargeTitle: true` + `headerTransparent: true` — native large-title nav bar
- `expo-symbols` `SymbolView` — SF Symbol icons
- `@expo/ui/swift-ui` — `Button`, `Toggle`, `Form`, `Section`, etc.
- `expo-glass-effect` `GlassView` — Liquid Glass surfaces

**Proto primitives** in `/components/proto` — small set of themed fallbacks: `Screen`, `Stack`, `Row`, `Text`, `Card`, `Button`, `Toggle`, `Divider`, `Modal`. Read the file when you need the API.

**Custom** — when none of the above fit, write the component you need with React Native. Put shared ones in `/components/shared/`. The designer's vision wins; the primitives are starting points, not constraints.

## File layout

```
/app/<route>.tsx       route — one-line re-export
/app/_layout.tsx       Stack (for native large titles) or NativeTabs (for tabs)
/screens/<Name>.tsx    screen, PascalCase, default export
/components/shared/    designer-created custom components
/components/proto/     Proto primitives — read-only
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
