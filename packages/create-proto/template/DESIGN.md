# DESIGN.md

> The design system for {{APP_NAME}}. Read by Claude Code before every change.
> Last updated: {{DATE}}

## How to update this file

You never edit this file directly. Tell Claude Code in plain language and it rewrites the relevant section. Examples:

- `update DESIGN.md, change accent to indigo and apply it everywhere`
- `make card corners tighter — radius 16 instead of 22`
- `switch to dark mode`
- `use Tamagui as the component library`

The tokens below become the actual colours, typography, and spacing in your screens. Never hardcoded.

## App
- Name: {{APP_NAME}}
- Theme: liquidGlass
- Platform: iOS 26+ (Liquid Glass renders natively; iOS < 26 falls back to standard blur)

## Component library
- Package: proto (built-in fallback)
- Import from: ../components/proto
- Fallback: proto

For native iOS surfaces (tab bars, SF Symbols, system buttons, toggles, forms, Liquid Glass), Claude reaches for Apple-native components first — see CLAUDE.md.

## Colour
- Accent: #007AFF
- Surface primary: rgba(255,255,255,0.72)
- Surface secondary: rgba(255,255,255,0.48)
- Surface card: rgba(255,255,255,0.60)
- Surface nav: rgba(255,255,255,0.82)
- Text primary: #000000
- Text secondary: rgba(0,0,0,0.5)
- Text tertiary: rgba(0,0,0,0.3)
- Destructive: #FF3B30

## Typography
- Title: 34px / bold / tracking -0.4
- Headline: 22px / semibold / tracking -0.4
- Body: 17px / regular
- Caption: 12px / regular / text-secondary
- Label: 13px / medium

## Spacing
- xs: 4 / sm: 8 / md: 16 / lg: 24 / xl: 32

## Shape
- Card radius: 22
- Button radius: 14
- Modal radius: 44
- Input radius: 12

## Effects
- Card blur: 20
- Nav blur: 40
- Modal blur: 60
- Border: rgba(255,255,255,0.4)

## Components in use

**Proto primitives** — Screen, Stack, Row, Text, Card, Button, Toggle, Modal, Divider.

**Native iOS** — UITabBar (via `expo-router/unstable-native-tabs`), SF Symbols (via `expo-symbols`), SwiftUI primitives (via `@expo/ui/swift-ui`), Liquid Glass surfaces (via `expo-glass-effect`).

## Screens
- Home (initial) — starter screen
