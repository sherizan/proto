# Proto — Phase 2 Handoff Prompt
> Paste this into Claude Code at the start of a fresh session.
> Start a new session — do not continue from a Phase 1 session.

---

```
We have completed Phase 1 of Proto successfully. The plan has been updated 
before Phase 2. Read this carefully before touching anything.

---

## What was built in Phase 1

- create-proto CLI (npm create proto@latest)
- proto start — starts Metro, opens iOS Simulator, suppresses raw output
- proto new-screen — scaffolds screens with 5 templates (home, list, detail, form, modal)
- proto reset — clears cache, restarts cleanly
- Proto component library (Screen, Stack, Row, Text, Card, Button, Toggle,
  Nav, Modal, Divider) with Liquid Glass and Material You token sets
- Friendly error translation layer (no raw Metro errors shown to designer)

Phase 1 is complete and working. Do not modify anything Phase 1 built 
unless a Phase 2 deliverable explicitly requires it.

---

## Core insight that changed the Phase 2 plan

With Proto CLI running and the iOS Simulator open, Claude Code CLI is 
already the perfect prompt interface. There is no canvas. No IDE. The 
designer describes what they want in Claude Code, it writes to /screens/, 
Metro hot-reloads, the Simulator updates. That loop is the entire product.

Building a secondary prompt layer (Express server, proto add command, 
in-app FAB) would reinvent what Claude Code already does. All of that 
is cancelled.

Proto's job is to be the best possible environment that Claude Code writes 
into — not to be an AI tool itself.

---

## What Phase 2 builds — four deliverables in order

---

### Deliverable 1 — DESIGN.md template

Create: create-proto/template/DESIGN.md

This file is copied into every new Proto project at install time. It is 
the single source of truth for the design system. Claude Code reads it 
before every generation. Engineers read it at handoff.

Use {{APP_NAME}} as a placeholder — substituted with the actual project 
name at scaffold time by create-proto.

Full file contents:

---
# DESIGN.md
> Source of truth for {{APP_NAME}}'s design system.
> Update by prompting Claude Code: "update DESIGN.md, [what to change]"
> Last updated: {{DATE}}

## App
- Name: {{APP_NAME}}
- Theme: liquidGlass
- Platform: iOS

## Component Library
- Package: proto (built-in)
- Import from: ../components/proto
- Fallback: proto

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
- Screen, Stack, Row, Text, Card, Button, Toggle, Nav, Modal, Divider

## Screens
- Home (initial) — starter screen
---

---

### Deliverable 2 — CLAUDE.md template (most important file in Phase 2)

Create: create-proto/template/CLAUDE.md

This file is copied into every new Proto project at install time. When 
Claude Code is opened inside a Proto project, it reads CLAUDE.md 
automatically and becomes Proto-aware. No configuration needed.

Copy this file exactly — do not paraphrase or shorten. It is read 
verbatim by Claude Code.

Full file contents:

---
# Proto Project — Claude Code Instructions

You are working inside a Proto project. Proto is a prompt-native design 
environment for building native iOS prototypes. Follow these rules exactly.

## Your role
You are the design tool. The iOS Simulator is the canvas. Your job is to 
generate native screens and components that the designer describes in plain 
language, using the design system defined in DESIGN.md.

## Before every task
1. Read DESIGN.md — this is the design system. All tokens come from here.
2. Read the Component Library section of DESIGN.md — this tells you which
   library to import from and what the import path is.
3. Check /screens/ to understand what screens already exist.
4. Check /components/proto/index.ts to see what Proto fallback components are available.

## Component library
- Read the Component Library section of DESIGN.md before generating any screen
- If a library is specified (e.g. Tamagui, Gluestack): import from that library
  using its correct package name and import paths
- Use that library's component names, props, and patterns exactly as documented
- If a specific component doesn't exist in the specified library, fall back to
  Proto primitives from '../components/proto' — never use raw React Native
- If Package is "proto" or no library is specified: use Proto primitives only
- Never import directly from 'react-native' regardless of library choice

## Writing screens
- All new screens go in /screens/<ScreenName>.tsx
- Screen names are always PascalCase (e.g. Settings, UserProfile, OrderDetail)
- Always export a default function matching the screen name exactly
- Never add TypeScript interfaces, types, or type annotations in screen files
- Never add comments to generated screen files
- Never hardcode colour, spacing, radius, or typography values — always use
  token values from DESIGN.md

## Available Proto fallback components
Import from '../components/proto' when the specified library doesn't cover a need:

Screen       — base wrapper. Props: title (string), scrollable (bool)
Stack        — vertical layout. Props: gap (number), padding (number)
Row          — horizontal layout. Props: gap (number), align ('start'|'center'|'end')
Text         — typography. Props: size ('title'|'headline'|'body'|'caption'|'label'),
               color ('primary'|'secondary'|'accent'|'destructive')
Card         — surface container. Props: glass (bool), padding (number)
Button       — action. Props: label (string),
               variant ('primary'|'secondary'|'ghost'|'destructive'), onPress
Toggle       — switch. Props: label (string), value (bool), onChange
Divider      — separator. No props.
Nav          — bottom nav. Props: tabs ([{ icon, label, screen }])
Modal        — bottom sheet. Props: title (string), visible (bool)

## Writing shared components
- Shared components go in /components/shared/<ComponentName>.tsx
- Same library rules apply — use specified library, fall back to Proto
- When a shared component is created, update all screens that use it

## Modifying existing screens
- Always rewrite the full file — never partial edits or diffs
- Read the current file first, then rewrite with the change applied

## After adding a new screen
- Add the screen name and a one-line description to the Screens section of DESIGN.md

## Updating the design system
- When the designer asks to update colour, spacing, typography, or shape:
  update DESIGN.md with the new values
- When the designer asks to change the component library:
  update the Component Library section of DESIGN.md with the new package and import path
- If asked to regenerate screens after a design system or library update:
  rewrite the affected screen files using the updated DESIGN.md values

## Never do these things
- Never import directly from 'react-native' — always use the specified library or Proto fallback
- Never create new components outside /screens/ or /components/shared/
- Never edit files in /components/proto/ — this is the Proto component library
- Never edit files in .proto/ — this is managed by the Proto CLI
- Never add a build step, a config change, or a dependency
- Never suggest the designer open a file or edit code manually
- Never add a point-and-click or visual editing interface
- All interaction is prompts only
---

---

### Deliverable 3 — proto design command

Add a new command to proto-cli: proto design

This generates or updates DESIGN.md interactively.

Flow using clack:
1. "Which theme?" — select: Liquid Glass / Material You / Base
2. "Accent colour?" — text input, default #007AFF (LG) / #6750A4 (MY) / #000000 (Base)
3. "Component library?" — select:
     Proto (built-in) — no install
     Tamagui          — installs @tamagui/core
     Gluestack UI     — installs @gluestack-ui/themed
     React Native Paper — installs react-native-paper
     NativeWind       — installs nativewind
     Custom           — ask for package name + optional docs URL, print install command
4. "App name?" — text input

On completion:
- Write DESIGN.md to project root using full structure (all sections above)
- Component Library section: use selected library's package + import path
- For known libraries: run pnpm add <package> silently (spinner, no output)
- Use theme-appropriate defaults for all token fields
- If DESIGN.md already exists: ask "Update existing design system? (y/n)"

Known library values to write into DESIGN.md:
  Tamagui:
    Package: @tamagui/core
    Import from: @tamagui/core
    Docs: https://tamagui.dev/docs/components
    Fallback: proto
  Gluestack UI:
    Package: @gluestack-ui/themed
    Import from: @gluestack-ui/themed
    Docs: https://ui.gluestack.io/docs
    Fallback: proto
  React Native Paper:
    Package: react-native-paper
    Import from: react-native-paper
    Docs: https://callstack.github.io/react-native-paper
    Fallback: proto
  NativeWind:
    Package: nativewind
    Import from: nativewind
    Docs: https://www.nativewind.dev/docs
    Fallback: proto

Success output:
◆ Proto
│
◇ Design system ready
│ Open Claude Code and start designing.
│ Try: "add a settings screen with a dark mode toggle"
│
└

Also add proto design update subcommand that prints:
"Tell Claude Code what to change, e.g. 'update DESIGN.md, change accent to indigo'"
Does not open any editor.

---

### Deliverable 4 — Update create-proto scaffolding

Modify create-proto to:
1. Copy DESIGN.md from template into the new project (substitute {{APP_NAME}} 
   and {{DATE}} at copy time)
2. Copy CLAUDE.md from template into the new project (no substitutions)
3. Create /components/shared/ folder with .gitkeep
4. Ensure both DESIGN.md and CLAUDE.md appear at the project root, not inside 
   any subdirectory

Verify by running: npm create proto@latest test-project
The resulting folder should contain:
  DESIGN.md          ← at root, app name substituted
  CLAUDE.md          ← at root, unchanged from template
  screens/           ← with Home.tsx
  components/proto/  ← component library
  components/shared/ ← empty, with .gitkeep
  .proto/            ← managed config

---

## Build order

1. Create create-proto/template/DESIGN.md
2. Create create-proto/template/CLAUDE.md
3. Update create-proto scaffolding to copy both + create components/shared/
4. Build proto design command in proto-cli
5. Test: npm create proto@latest test-app → verify DESIGN.md, CLAUDE.md, 
   components/shared/ all present at root
6. Test: open test-app in Claude Code → verify it reads CLAUDE.md on start
7. Test: proto design → verify DESIGN.md is generated for all three themes 
   and all five library options
8. Test: in a project with Tamagui selected, prompt Claude Code to add a screen 
   → verify it imports from @tamagui/core not ../components/proto

Do not move to the next item until the current one passes.

---

## What does not change from Phase 1

- All Proto components (Screen, Stack, Row, Text, Card, Button, Toggle,
  Nav, Modal, Divider) — unchanged
- proto start — unchanged
- proto new-screen — unchanged
- proto reset — unchanged
- Token files (liquidGlass.ts, materialYou.ts, base.ts) — unchanged
- Error translation layer — unchanged
- .proto/ hidden folder structure — unchanged
```
