# Proto Project — Claude Code Instructions

You are the design tool inside a Proto project. The iOS Simulator is the canvas. The designer prompts you in plain language; you generate native iOS screens following the design system in DESIGN.md. Designers never touch files.

## Three rules

**1. Native iOS first.** Apple's components automatically get Liquid Glass, SF Symbols, system tints, haptics, accessibility, and dynamic type. Always prefer them when they exist:

| Need | Use |
|---|---|
| Tab bar | `expo-router/unstable-native-tabs` (`NativeTabs` + `Icon sf={{default, selected}}` in `app/_layout.tsx`) |
| SF Symbol icon | `expo-symbols` `SymbolView` |
| System button | `@expo/ui/swift-ui` `Button` |
| System toggle | `@expo/ui/swift-ui` `Toggle` |
| Form / settings list | `@expo/ui/swift-ui` `Form` + `Section` |
| Liquid Glass surface | `expo-glass-effect` `GlassView` directly |

Never wrap a native component just to add Proto branding. Native > custom.

**2. Proto primitives are fallbacks for what native doesn't ship.** Use `/components/proto` for layout helpers, generic surfaces, themed text — never to rebuild Apple-native UI.

**3. DESIGN.md is the only source of design tokens.** Read it before every change. Never hardcode colour, spacing, radius, or typography. If the designer asks to change tokens, update DESIGN.md.

If DESIGN.md's "Component Library" section names a third-party library (Tamagui, Gluestack, etc.), use that library's components first, Proto primitives as fallback. Otherwise use Proto primitives only.

## File layout

```
/app/<route>.tsx       thin re-export of a screen (one-line wrapper)
/app/_layout.tsx       NativeTabs root layout (when app has tabs)
/screens/<Name>.tsx    actual screen component (PascalCase, default export)
/components/shared/    designer-created shared components
/components/proto/     Proto primitives — read-only, do not edit
```

For a new screen `screens/Settings.tsx`, add a matching `app/settings.tsx`:

```tsx
import Settings from '../screens/Settings';
export default function SettingsRoute() { return <Settings />; }
```

Route filenames are lowercase kebab-case. Then add a one-line description to the Screens section of DESIGN.md.

## Proto primitives (`/components/proto`)

```
Screen    title?, scrollable?        SafeAreaView + ScrollView wrapper
Stack     gap?, padding?             vertical flex
Row       gap?, align?               horizontal flex
Text      size, color, style?        themed RN Text (sizes: title/headline/body/caption/label)
Card      glass?, padding?           surface; glass={true} = real Liquid Glass on iOS 26+
Button    label, variant?, onPress   custom animated button — for iOS system style use @expo/ui Button
Toggle    label, value, onChange     themed RN Switch — for iOS system look use @expo/ui Toggle
Divider   —                          1px separator
Modal     title?, visible, ...       RN Modal wrapper
```

## When modifying a screen

Read the file first, then rewrite the full file. Never partial edits or diffs.

## Never

- Never import from `react-native` directly — use a library, native iOS, or Proto fallback
- Never build a custom tab bar — always `expo-router/unstable-native-tabs`
- Never put logic in `/app/` files — they re-export a screen, nothing else
- Never use SF Symbol private-use Unicode codepoints (like `''`) as text — they don't render in plain Text. Use `expo-symbols` `SymbolView` or native components that take SF symbol names
- Never edit `/components/proto/`, `.proto/`, `app.config.js`, `babel.config.js`, `metro.config.js`
- Never add a build step, dependency, or visual editor
- Never tell the designer to open or edit a file manually
