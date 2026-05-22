# Proto Project — Claude Code Instructions

You are working inside a Proto project. Proto is a prompt-native design environment for building native iOS prototypes. Follow these rules exactly.

## Your role
You are the design tool. The iOS Simulator is the canvas. Your job is to generate native screens and components that the designer describes in plain language, using the design system defined in DESIGN.md.

## Native iOS first
Prefer Apple's native iOS components over custom-built wrappers wherever a native one exists. Native components automatically get Liquid Glass, SF Symbols, system tints, haptics, accessibility, and dynamic type. Anything we wrap loses those for free benefits.

| Need | Use this — NOT a custom wrapper |
|---|---|
| Bottom tab bar | `expo-router/unstable-native-tabs` (real `UITabBar`, Liquid Glass on iOS 26+) |
| SF Symbol icon | `expo-symbols` `SymbolView`, or SF symbol name inside native components |
| Native action button (system style) | `@expo/ui/swift-ui` `Button` |
| Form / settings list | `@expo/ui/swift-ui` `Form` + `Section` |
| Native iOS Toggle | `@expo/ui/swift-ui` `Toggle` (when designer wants iOS system look) |
| Live blur / Liquid Glass surface | `expo-glass-effect` `GlassView` directly (no wrapper) |

Proto's `/components/proto/` library is for things native doesn't ship: layout helpers, generic surfaces, custom buttons with animation. **Don't use Proto primitives to rebuild what Apple already provides natively.**

## Before every task
1. Read DESIGN.md — this is the design system. All tokens come from here.
2. Read the Component Library section of DESIGN.md — this tells you which library to import from and what the import path is.
3. Check /screens/ to understand what screens already exist.
4. Check /components/proto/index.ts to see what Proto fallback components are available.

## Component library
- Read the Component Library section of DESIGN.md before generating any screen
- If a library is specified (e.g. Tamagui, Gluestack): import from that library using its correct package name and import paths
- Use that library's component names, props, and patterns exactly as documented
- If a specific component doesn't exist in the specified library, fall back to Proto primitives from '../components/proto' — never use raw React Native
- If Package is "proto" or no library is specified: use Proto primitives only
- Never import directly from 'react-native' regardless of library choice

## Writing screens
- All new screens go in /screens/<ScreenName>.tsx
- Screen names are always PascalCase (e.g. Settings, UserProfile, OrderDetail)
- Always export a default function matching the screen name exactly
- Never add TypeScript interfaces, types, or type annotations in screen files
- Never add comments to generated screen files
- Never hardcode colour, spacing, radius, or typography values — always use token values from DESIGN.md

## Available Proto fallback components
Import from '../components/proto' when the specified library doesn't cover a need:

Screen       — base wrapper. Props: title (string), scrollable (bool)
Stack        — vertical layout. Props: gap (number), padding (number)
Row          — horizontal layout. Props: gap (number), align ('start'|'center'|'end')
Text         — typography. Props: size ('title'|'headline'|'body'|'caption'|'label'), color ('primary'|'secondary'|'accent'|'destructive')
Card         — surface container. Props: glass (bool), padding (number)
               When glass={true}: renders Apple's native Liquid Glass on iOS 26+
               (expo-glass-effect GlassView), falls back to expo-blur on iOS < 26
               and Android. Detection is automatic — designer just says "glass card".
Button       — action. Props: label (string), variant ('primary'|'secondary'|'ghost'|'destructive'), onPress
               Custom Pressable with animation. Use this for non-system action buttons.
               For iOS system-style buttons, use @expo/ui/swift-ui Button instead.
Toggle       — switch. Props: label (string), value (bool), onChange
               Uses themeable RN Switch (track color from accent token).
               For iOS native system toggle, use @expo/ui/swift-ui Toggle instead.
Divider      — separator. No props.
Modal        — bottom sheet. Props: title (string), visible (bool)

## Bottom navigation — always use native UITabBar via expo-router
For tab bars, use `expo-router/unstable-native-tabs`. This bridges Apple's `UITabBar` to React Native, which means:
- Real Liquid Glass on iOS 26+ automatically (no manual GlassView wrapping)
- Real SF Symbols (set per tab with default + selected variants like `house` → `house.fill`)
- Correct system tints, scroll-edge effects, haptics
- Safe-area insets and accessibility for free

Pattern (in `app/_layout.tsx`):

```tsx
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function Layout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore">
        <Icon sf={{ default: 'safari', selected: 'safari.fill' }} />
        <Label>Explore</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

Each trigger's `name` maps to an existing `app/<route>.tsx`. Use real SF Symbol names (search developer.apple.com for valid names). Add `.fill` variants for the selected state where one exists.

Do NOT build custom tab bars with View + Pressable + GlassView. Apple's UITabBar is strictly better.

## Writing shared components
- Shared components go in /components/shared/<ComponentName>.tsx
- Same library rules apply — use specified library, fall back to Proto
- When a shared component is created, update all screens that use it

## Routing
- expo-router reads `/app/`. Every screen needs a matching route there.
- For a screen at `/screens/<Name>.tsx`, create `/app/<route>.tsx` with this exact shape:
  ```tsx
  import <Name> from '../screens/<Name>';

  export default function <RouteName>() {
    return <<Name> />;
  }
  ```
- The home screen lives at `/app/index.tsx`, wrapping `/screens/Home.tsx`.
- Route filenames are lowercase kebab-case (`user-profile.tsx` for `UserProfile`).
- Route files are thin wrappers only — never put screen logic in `/app/`.
- For apps with tab navigation, create `/app/_layout.tsx` with `<NativeTabs>` (see Bottom navigation section above).

## Modifying existing screens
- Always rewrite the full file — never partial edits or diffs
- Read the current file first, then rewrite with the change applied

## After adding a new screen
- Create a matching route file at `/app/<route>.tsx` that re-exports the screen
- Add the screen name and a one-line description to the Screens section of DESIGN.md

## Updating the design system
- When the designer asks to update colour, spacing, typography, or shape: update DESIGN.md with the new values
- When the designer asks to change the component library: update the Component Library section of DESIGN.md with the new package and import path
- If asked to regenerate screens after a design system or library update: rewrite the affected screen files using the updated DESIGN.md values

## Never do these things
- Never import directly from 'react-native' — always use the specified library, native iOS components (per "Native iOS first" table), or Proto fallback
- Never create new components outside /screens/ or /components/shared/
- Never put screen logic in /app/ — those files are routing-only thin re-exports
- Never edit files in /components/proto/ — this is the Proto component library
- Never edit Proto-managed config: .proto/, app.config.js, babel.config.js, metro.config.js
- Never add a build step, a config change, or a dependency
- Never suggest the designer open a file or edit code manually
- Never add a point-and-click or visual editing interface
- Never build custom tab bars — always use `expo-router/unstable-native-tabs`
- Never use SF Symbol private-use Unicode codepoints in plain Text — use `expo-symbols` `SymbolView` or native components that take SF Symbol names
- All interaction is prompts only
