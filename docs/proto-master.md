# Proto — Master Product Document
> The first prompt-native design environment. No canvas. No IDE. No engineering concepts.
> Last updated: May 2026 | Build target: Claude Code

---

## Table of Contents

1. [Product Brief](#1-product-brief)
2. [PRD — Product Requirements](#2-prd)
3. [Tech Stack](#3-tech-stack)
4. [Architecture](#4-architecture)
5. [Folder & File Scaffolding](#5-folder--file-scaffolding)
6. [Phase 1 — Scaffolding + Preview](#6-phase-1--scaffolding--preview)
7. [Phase 2 — DESIGN.md + Proto Skills + Proto App](#7-phase-2--designmd--proto-skills--proto-app)
8. [Phase 3 — Share + Scale](#8-phase-3--share--scale)
9. [CLI Design](#9-cli-design)
10. [DESIGN.md System](#10-designmd-system)
11. [Proto Skills for Claude Code](#11-proto-skills-for-claude-code)
12. [Component Library Registry](#12-component-library-registry)
13. [Design Token System](#13-design-token-system)
14. [Error Handling Philosophy](#14-error-handling-philosophy)
15. [Custom Dev Client Plan](#15-custom-dev-client-plan)
16. [Distribution & GTM](#16-distribution--gtm)
17. [Claude Code Prompts](#17-claude-code-prompts)
18. [Open Questions & Risks](#18-open-questions--risks)

---

## 1. Product Brief

### Vision
The first prompt-native design environment. The canvas is gone. The IDE is gone. The designer describes what they want in plain language, and it appears on their device. That's the entire interaction model.

### The Paradigm Shift
Every design tool today is canvas-based — you move things on a 2D surface and AI is layered on top of that model. Proto removes the canvas entirely.

```
Old model:   Prompt → canvas → adjust → device
Proto model: Prompt → device
```

The iOS Simulator is the canvas. Claude Code CLI is the design tool. The designer never touches a file.

### The Gap
| Tool | Designer-friendly | Genuinely native | Prompt-only | No IDE | No canvas |
|---|---|---|---|---|---|
| Figma Make | ✓ | ✗ (webview) | ✗ | ✓ | ✗ |
| RapidNative | partial | partial | ✗ | ✗ | ✗ |
| Origami Studio | partial | ✓ | ✗ | ✗ | ✗ |
| **Proto** | **✓** | **✓** | **✓** | **✓** | **✓** |
| Expo | ✗ | ✓ | ✗ | ✗ | ✗ |
| SwiftUI | ✗ | ✓ | ✗ | ✗ | ✗ |

### Target user
A product designer at a mid-to-large company. Has Figma proficiency. Ships interaction design. Wants to prototype in native fidelity — real gestures, real haptics, Liquid Glass, actual scroll physics — without waiting for an engineer or learning React Native. Comfortable enough to open a terminal and run one command. Everything after that is prompts.

### North star metric
Time from `npm create proto@latest` to a working prototype running in the iOS Simulator. Target: under 90 seconds.

### Positioning statement
Proto is the first design environment with no canvas. You describe what you want. It appears on your device. Claude Code is the brush. The Simulator is the sketchbook. Your team's component library is the paint.

---

## 2. PRD

### Goals
- A designer installs Proto with one command and has a native prototype running in the Simulator in under 90 seconds
- DESIGN.md is the single source of truth for all design decisions — tokens, typography, colour, spacing, and component library
- Every prompt Claude Code runs inside a Proto project produces native output that inherits DESIGN.md automatically
- Teams with an existing component library (Tamagui, Gluestack, etc.) can prototype in their actual production components — the prototype feels like the real product because it uses the real product's parts
- Errors are never surfaced in engineering language
- Sharing a prototype requires no accounts, no dashboards, no additional tooling

### Non-goals (v1 + v2)
- No point-and-click visual editor — all changes are prompts
- No in-app prompt overlay — Claude Code CLI is the only prompt surface
- No custom Express prompt server — Claude Code handles generation entirely
- No authentication flows or backend integration
- No production build pipeline (EAS, TestFlight, Play Store upload)
- No collaborative real-time editing
- No Figma plugin or import
- No web preview — mobile Simulator and physical device only
- Not a replacement for production code — prototypes only

### User stories

**Install**
- As a designer, I run one command and my prototype environment is ready with a Simulator open
- As a designer, I never see a config file, a dependency list, or a package version conflict

**Design system**
- As a designer, I run `proto design` and answer three questions — theme, accent colour, app name — and my design system is set up
- As a designer, when I prompt Claude Code to add a screen, it already knows my colours, typography, and spacing without me repeating them
- As a designer, I update my design system with a prompt: "change the accent to indigo and update DESIGN.md" and all components reflect it
- As a designer using my team's component library, I add the repo to DESIGN.md once and every screen Claude Code generates uses the correct components and import paths automatically

**Prompt**
- As a designer, I describe a screen in plain language via Claude Code CLI and it appears in the Simulator
- As a designer, I describe a visual tweak — "make the card corners tighter" — and it updates without touching a file
- As a designer, I can describe interactions: "when the user taps the card, push a detail screen" and it works

**Share**
- As a designer, I can send a QR code to a stakeholder and they can run my prototype on their phone (Phase 3)

### Success metrics — Phase 1
- Install to Simulator running < 90 seconds on a clean macOS machine with Node 18+
- 5 non-technical designers complete install without assistance
- Zero raw engineering errors surfaced during normal use

### Success metrics — Phase 2
- Claude Code generates a valid, on-brand screen from a natural language prompt in < 15 seconds
- DESIGN.md tokens are applied correctly to 100% of generated screens without manual correction
- Designer can build a 5-screen prototype in < 30 minutes using Claude Code prompts only
- When a component library is specified in DESIGN.md, Claude Code uses that library's import paths with zero manual correction

### Constraints
- macOS primary (iOS Simulator requirement), Windows Phase 3
- iOS Simulator primary for Phase 1 + 2, physical device via Expo Go / Proto App
- Node.js 18+ required — the only prerequisite
- Claude Code installed — required for Phase 2 prompt workflow

---

## 3. Tech Stack

### CLI
- **Runtime:** Node.js 18+
- **Package name:** `create-proto` on npm
- **Command:** `npm create proto@latest <project-name>`
- **Scaffolding base:** Custom (not create-expo-app — too much exposed config)
- **Terminal UI:** `clack` (clean prompts, spinners, styled output)
- **File generation:** `fs-extra`

### Prototype Runtime
- **Framework:** Expo SDK 54 — hidden from designer
- **Navigation:** expo-router (file-based, abstracted behind Proto screen primitives)
- **Animation:** react-native-reanimated 4 + react-native-worklets
- **Gestures:** react-native-gesture-handler
- **Safe area:** react-native-safe-area-context
- **Liquid Glass (iOS 26+):** `expo-glass-effect` (`GlassView`) + `@expo/ui/swift-ui` (`Toggle`, modifiers) — Apple-sanctioned native Liquid Glass via SwiftUI bridge, MIT-licensed, ships with Expo SDK 54
- **Blur fallback (iOS <26, Android):** `expo-blur`
- **Haptics:** expo-haptics

### AI Layer (Phase 2)
- **Prompt interface:** Claude Code CLI — no custom server required
- **Context source:** DESIGN.md + CLAUDE.md (Proto Skills) in project root
- **Generation target:** Writes to `/screens/` using Proto component library only
- **Hot reload:** Metro picks up file changes written by Claude Code automatically

> **What changed from v1:** There is no custom Express prompt server. No port 3001. No in-app prompt overlay. Claude Code is the prompt layer. Proto's job is to be the best possible environment Claude Code writes into — not to reinvent the AI tooling.

### Preview
- **Phase 1:** iOS Simulator (primary) + Expo Go on device
- **Phase 2:** Custom dev client — white-labelled as "Proto" on App Store / Play Store

### Share Layer (Phase 3)
- **Hosting:** `proto.run` — Vercel-hosted Next.js app
- **Tunnel:** Custom ngrok wrapper for QR sharing
- **Database:** Supabase (prototype metadata, share tokens)

---

## 4. Architecture

### System overview

```
Designer
    │
    ├── proto CLI
    │     ├── Scaffolds project (one-time)
    │     ├── Generates DESIGN.md via proto design (one-time per project)
    │     └── Starts Metro (hidden, managed)
    │
    └── Claude Code CLI  ←── The design tool
          ├── Reads DESIGN.md (design system context)
          ├── Reads CLAUDE.md (Proto Skills — component rules)
          ├── Generates screen .tsx files to /screens/
          └── Updates DESIGN.md when design system changes

Metro (hidden, managed)
    └── Detects file changes → hot reloads

iOS Simulator / Proto App  ←── The canvas
    └── Renders native components
```

### Data flow — prompt to device

```
1. Designer types in Claude Code:
   "add a settings screen with notification and dark mode toggles"

2. Claude Code reads:
   DESIGN.md     → theme: liquidGlass, accent: #007AFF, radius: 22px...
   CLAUDE.md     → use only Proto components, write to /screens/, never raw RN

3. Claude Code writes:
   /screens/Settings.tsx  (uses Screen, Stack, Toggle — all token-aware)

4. Metro detects file change → hot reloads bundle

5. iOS Simulator updates — new screen appears, no restart needed

Total time: ~10 seconds
```

### Design system update flow

```
1. Designer types in Claude Code:
   "change accent colour to indigo, update DESIGN.md"

2. Claude Code updates:
   DESIGN.md → accentColor: "#5856D6"

3. Designer types:
   "regenerate the Home screen to reflect the updated design tokens"

4. Claude Code rewrites:
   /screens/Home.tsx with new accent applied

5. Simulator updates instantly
```

### Key design decisions

**No runtime eval.** Generated components are written to disk and picked up by Metro. Stable, inspectable at handoff, no bundler complexity.

**Full-file rewrite over diff.** When modifying a screen, Claude Code rewrites the entire file. Diffs are fragile with LLM output. Full rewrites are reliable and Metro hot-reloads regardless — screen files are small.

**Claude Code as the sole prompt surface.** No in-app overlay, no secondary CLI prompt command. One prompt tool, one output surface. The paradigm stays clean — designers do not context-switch between surfaces.

**DESIGN.md as source of truth.** Not proto.config.js, not a tokens file, not a theme object. DESIGN.md is human-readable, Claude Code-readable, and engineer-readable at handoff. It is the bridge between design intent and generated code.

---

## 5. Folder & File Scaffolding

### What `npm create proto@latest my-app` creates

```
my-app/
│
├── DESIGN.md                ← Design system source of truth. Claude Code reads this first.
├── CLAUDE.md                ← Proto Skills. Tells Claude Code how to work in this project.
│
├── screens/                 ← All screens live here. Claude Code writes here.
│   ├── Home.tsx             ← Starter screen (seeded by CLI)
│   └── .gitkeep
│
├── components/
│   └── proto/               ← Proto component library. Never edited manually.
│       ├── index.ts
│       ├── Screen.tsx
│       ├── Stack.tsx
│       ├── Row.tsx
│       ├── Text.tsx
│       ├── Card.tsx
│       ├── Button.tsx
│       ├── Toggle.tsx
│       ├── Nav.tsx
│       ├── Modal.tsx
│       ├── Divider.tsx
│       ├── useTheme.ts
│       └── tokens/
│           ├── liquidGlass.ts
│           ├── materialYou.ts
│           └── base.ts
│
├── assets/
│   ├── icon.png
│   └── splash.png
│
├── .proto/                  ← Managed by Proto CLI. Designer never touches this.
│   ├── app/                 ← expo-router app dir
│   │   ├── _layout.tsx
│   │   └── (proto)/
│   │       └── [...screen].tsx
│   └── expo-config/
│       ├── app.json
│       ├── babel.config.js
│       └── metro.config.js
│
├── package.json             ← Pre-configured. Designer never edits.
└── .gitignore
```

### DESIGN.md — seeded at install, refined via `proto design`

```markdown
# DESIGN.md
> Source of truth for this prototype's design system.
> Edit by prompting Claude Code: "update DESIGN.md, change the accent to indigo"

## App
- Name: My App
- Theme: liquidGlass
- Platform: iOS

## Component Library
- Package: proto (built-in)
- Import from: ../components/proto
- Fallback: proto

## Colour
- Accent: #007AFF
- Surface primary: rgba(255,255,255,0.72)
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
- xs: 4
- sm: 8
- md: 16
- lg: 24
- xl: 32

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

## Screens
- Home (initial)
```

### CLAUDE.md — Proto Skills, auto-generated at install

See Section 11 for full contents.

### Starter `screens/Home.tsx`

```tsx
import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Screen, Stack, Text, Card, Divider } from '../components/proto';

export default function Home() {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) });
  }, [opacity, translateY]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Screen title="Proto" scrollable>
      <Stack gap={24} padding={20}>
        <Animated.View style={heroStyle}>
          <Card glass padding={24}>
            <Stack gap={12}>
              <Text size="title">You're in.</Text>
              <Text size="body" color="secondary">
                Every change you make appears here instantly — no refresh, no waiting.
              </Text>
            </Stack>
          </Card>
        </Animated.View>

        <Stack gap={12}>
          <Text size="headline">Next</Text>
          <Text size="body">Open a new terminal and run</Text>
          <Card padding={16}>
            <Text size="body" color="accent">claude</Text>
          </Card>
          <Text size="body">Then describe what you want</Text>
          <Card padding={16}>
            <Text size="body" color="accent">
              Add liquid glass bottom toolbar with placeholder screens
            </Text>
          </Card>
        </Stack>

        <Divider />

        <Text size="caption" color="secondary">
          Proto reads DESIGN.md before every change.
        </Text>
      </Stack>
    </Screen>
  );
}
```

---

## 6. Phase 1 — Scaffolding + Preview

### Goal
Designer runs one command, iOS Simulator opens, native prototype is running. No AI layer yet. The install experience is the product. Get this right before anything else.

### Status
✅ Built. Phase 1 is complete.

### What shipped

**`create-proto` CLI**
- `npm create proto@latest <name>` scaffolds the project
- `clack` for clean terminal experience
- Dependencies install silently (spinner, no npm output)
- Simulator opens automatically on first run
- Metro output suppressed by default

**Proto component library** (`components/proto/`)
- `Screen`, `Stack`, `Row`, `Text`, `Card`, `Button`, `Toggle`, `Nav`, `Modal`, `Divider`
- All token-aware via `useTheme()`
- Liquid Glass and Material You token sets included

**`proto start`**
- Starts Metro, suppresses raw output
- Shows only: `Proto running → Simulator open`
- Friendly error translation layer active

**`proto new-screen <name>`**
- Scaffolds empty screen in `/screens/`
- Navigation picks it up automatically

**5 screen templates**
- `home`, `list`, `detail`, `form`, `modal`
- Available via: `proto new-screen Profile --template list`

### Phase 1 acceptance criteria
- [x] `npm create proto@latest my-app` works on clean macOS + Node 18+
- [x] Simulator opens within 90 seconds
- [x] Hot reload works when a screen file is saved
- [x] `proto new-screen` creates a navigable screen
- [x] No raw engineering errors visible during happy path

---

## 7. Phase 2 — DESIGN.md + Proto Skills + Proto App

### Goal
The designer opens Claude Code inside their Proto project and the AI already knows the design system, the component library, and the rules. Every prompt produces native, on-brand output in the Simulator. No configuration, no repeating context, no touching code.

### What changed from original plan

| Original Phase 2 | Revised Phase 2 |
|---|---|
| Custom Express server (port 3001) | Removed — Claude Code handles generation |
| In-app FAB + prompt overlay | Removed — Claude Code CLI is the only prompt surface |
| `proto add "..."` command | Removed — `claude` command in Claude Code replaces this |
| Token-aware prompt construction in server | Moved to DESIGN.md + CLAUDE.md read by Claude Code |
| PROTO_API_KEY env variable + proto login | Removed — Claude Code uses its own auth |

### Deliverables

**1. DESIGN.md system**

The most important Phase 2 feature. A human-readable, Claude Code-readable design brief that lives at the project root and is the single source of truth for every design decision.

- Seeded at install with sensible defaults based on chosen theme
- Refined interactively via `proto design` command
- Updated via Claude Code prompts: "update DESIGN.md, tighten the card radius to 16"
- Claude Code reads DESIGN.md before every generation automatically (via CLAUDE.md instruction)
- Covers: colour, typography, spacing, shape, effects, screen inventory
- Also serves as the engineer-facing handoff document

**2. CLAUDE.md — Proto Skills**

A CLAUDE.md file at the project root that turns Claude Code into a Proto-aware design tool the moment it's opened in the project. Full contents in Section 11.

What it instructs Claude Code to do:
- Always read DESIGN.md before generating any screen
- Only use components from `components/proto/` — never raw React Native primitives
- Write new screens to `/screens/<ScreenName>.tsx`
- Update `DESIGN.md` screens list when adding a new screen
- Full-file rewrite when modifying existing screens (no diffs)
- Use tokens from DESIGN.md — never hardcode colour, spacing, or radius values
- Never create TypeScript interfaces or types in screen files
- Never add code comments to generated screens

**3. `proto design` command**

Interactive CLI setup for DESIGN.md. Run once per project, or re-run to change the design system.

```
◆ Proto Design Setup
│
◇ Which theme?
│ ● Liquid Glass  ○ Material You  ○ Base
│
◇ Accent colour? (hex)
│ #007AFF
│
◇ Component library?
│ ● Proto (built-in)
│ ○ Tamagui
│ ○ Gluestack UI
│ ○ React Native Paper
│ ○ NativeWind
│ ○ Custom (enter package name)
│
◇ App name?
│ My App
│
◇ Generating your design system...
│
└ DESIGN.md created. Claude Code is ready.
```

For known libraries (Tamagui, Gluestack, React Native Paper, NativeWind), `proto design` automatically runs `pnpm add <package>` to install the dependency. For Custom, it asks for the package name and an optional docs URL, writes both to DESIGN.md, and lets Claude Code handle the rest.

Generates a complete DESIGN.md from the answers. All other values are theme defaults.

**4. `proto design update` command**

Shortcut that opens DESIGN.md and instructs the designer to ask Claude Code to make changes. Prints:

```
◆ Proto
│
◇ Tell Claude Code what to change:
│ e.g. "update DESIGN.md, change accent to indigo and tighten card radius to 16"
│
└ DESIGN.md is your design system. All changes go through prompts.
```

**5. Proto App — custom dev client (Phase 3, optional)**

Originally required for Liquid Glass — that requirement is gone since Expo SDK 54 ships `@expo/ui/swift-ui` + `expo-glass-effect`, which render Apple's native Liquid Glass inside stock Expo Go without any custom native module. Phase 2 ships against Expo Go entirely.

Proto App remains a Phase 3 nice-to-have, purely for branding (Proto on the home screen, not Expo Go). No technical blocker requires it.

See Section 15 for the (now-optional) build plan.

**6. Shared components layer**

Claude Code can now generate shared components that multiple screens use. Lives in `/components/shared/` — also a Claude Code write target, never manually edited.

Example prompt: "create a shared UserAvatar component with initials fallback and use it in both Home and Profile screens"

Claude Code writes `/components/shared/UserAvatar.tsx`, then updates both screen files to import it.

### Phase 2 acceptance criteria
- [ ] DESIGN.md is generated correctly by `proto design` for all three themes
- [ ] Component Library section is written correctly to DESIGN.md for all five library options
- [ ] Known libraries are installed automatically by `proto design` without designer running any extra commands
- [ ] Claude Code reads DESIGN.md automatically when opened in a Proto project
- [ ] Generated screens use the specified component library — no Proto primitives when a library is set
- [ ] When a component doesn't exist in the specified library, Claude Code falls back to Proto primitives silently
- [ ] All token values (colour, spacing, radius) come from DESIGN.md — no hardcoded values
- [ ] DESIGN.md screens list stays in sync as screens are added
- [ ] Physical device preview works via Proto App (TestFlight)
- [ ] Liquid Glass renders correctly on iOS 26 device via Proto App

---

## 8. Phase 3 — Share + Scale

### Goal
A prototype can be shared with a stakeholder in one tap. No account. No setup. Just a link or QR. And the handoff to engineers is already done — DESIGN.md and `/screens/` together are the spec.

### Deliverables

**1. `proto share` command**
- Starts a tunnel (custom ngrok wrapper)
- Generates a `proto.run/p/<token>` URL
- Prints QR code to terminal
- Stakeholder scans QR → downloads Proto App if not installed → prototype loads

**2. `proto.run` — hosted share platform**
- Next.js app on Vercel
- Share page per token shows: prototype name, creator, device frame screenshot, DESIGN.md summary (theme, accent, screen count), "Open in Proto" deep link CTA
- No account to view
- Free account (email only) to generate share links

**3. Prototype snapshots**
- `proto snapshot "v1 — settings review"` — saves current screen set as named version
- `proto share --snapshot "v1"` — shares a specific version

**4. DESIGN.md in share page**

When a designer shares a prototype, the share page on `proto.run` surfaces the design system alongside the device preview:
- Theme, accent colour, screen count
- Typography scale
- Component list in use

Stakeholders and engineers see the design decisions, not just the visual output. This makes Proto shares more useful than Figma links for native design review — they show what it feels like and what decisions drove it.

**5. Engineer handoff — already done**

The original plan had `proto export` as a dedicated handoff step. Revised: the handoff is already in the project.

- DESIGN.md = the design system spec
- `/screens/*.tsx` = the screen implementation in readable Proto components
- `/components/shared/*.tsx` = shared components

An engineer opens the Proto project, reads DESIGN.md, reads the screens, and has a complete picture. `proto export` still exists as a clean packaging command but it's not doing heavy lifting — it bundles `/screens/`, `/components/shared/`, and DESIGN.md into an `/export/` folder with a `HANDOFF.md` that explains the structure.

**6. Comment layer (Phase 3b)**
- Stakeholder taps anywhere in the running prototype → drops a comment pin
- Comments sync to creator's `proto.run` dashboard
- Async only — like Figma share links, not real-time

---

## 9. CLI Design

### Command structure

```bash
# Create new prototype project
npm create proto@latest <name>

# Start Metro + open Simulator
proto start

# Interactive design system setup → generates DESIGN.md
proto design

# Add empty screen
proto new-screen <name>

# Add screen from template
proto new-screen <name> --template [home|list|detail|form|modal]

# Remove a screen
proto remove <screen-name>

# Take a named snapshot
proto snapshot "<name>"

# Share prototype via tunnel (Phase 3)
proto share

# Share a specific snapshot (Phase 3)
proto share --snapshot "<name>"

# Export screens for engineer handoff (Phase 3)
proto export

# Show verbose Metro logs
proto start --verbose

# Reset if something breaks
proto reset
```

### What's removed from CLI

`proto add "..."` — removed. Claude Code handles screen generation.
`proto edit <screen> "..."` — removed. Claude Code handles screen modification.
`proto login` — removed. Claude Code handles AI auth.

### Terminal UX principles
- Never show stack traces, package names, or version numbers
- Plain verbs only: "Starting...", "Done.", "Something went wrong."
- Spinners for anything over 1 second
- Success state shows only what the designer needs

### Example outputs

`proto design`:
```
◆ Proto Design Setup
│
◇ Which theme? Liquid Glass
◇ Accent colour? #007AFF
◇ App name? My App
◇ Writing DESIGN.md...
│
└ Done. Open Claude Code and start designing.
```

`proto new-screen Profile`:
```
◆ Proto
│
◇ Creating Profile screen...
│
└ Profile created → it's live in the Simulator
```

Error:
```
◆ Proto
│
▲ Something went wrong
│ Run: proto reset
│ Still stuck? proto.run/help
│
└
```

---

## 10. DESIGN.md System

### Philosophy

DESIGN.md serves three audiences simultaneously:
1. **Claude Code** — reads it before every generation to stay on-brand automatically
2. **Designer** — updates it via prompts to evolve the design system
3. **Engineer** — reads it at handoff to understand the design decisions

It is not a code file. It is not a JSON config. It is a structured markdown document written in human language that Claude Code also happens to understand perfectly.

### Full DESIGN.md structure

```markdown
# DESIGN.md
> Source of truth for [App Name]'s design system.
> Update by prompting Claude Code: "update DESIGN.md, [what to change]"
> Last updated: [date]

## App
- Name: [App Name]
- Theme: liquidGlass | materialYou | base
- Platform: iOS | Android | both

## Component Library
- Package: proto | @tamagui/core | @gluestack-ui/themed | react-native-paper | nativewind | [custom]
- Import from: [import path — e.g. @tamagui/core]
- Docs: [optional URL]
- Fallback: proto

## Colour
- Accent: #hex
- Surface primary: value
- Surface secondary: value
- Surface card: value
- Surface nav: value
- Text primary: value
- Text secondary: value
- Text tertiary: value
- Destructive: value

## Typography
- Title: size / weight / tracking
- Headline: size / weight / tracking
- Body: size / weight
- Caption: size / weight / color-role
- Label: size / weight

## Spacing scale
- xs: 4 / sm: 8 / md: 16 / lg: 24 / xl: 32

## Shape
- Card radius: value
- Button radius: value
- Modal radius: value
- Input radius: value

## Effects (Liquid Glass only)
- Card blur: value
- Nav blur: value
- Modal blur: value
- Border: value

## Components in use
- [list of components used — from specified library or Proto fallback]

## Screens
- [ScreenName] (initial) — [one line description]
- [ScreenName] — [one line description]
```

### How Claude Code uses DESIGN.md

CLAUDE.md (Section 11) instructs Claude Code to:
1. Read DESIGN.md at the start of any screen generation task
2. Extract the relevant tokens for the screen being built
3. Pass tokens through `useTheme()` — never hardcode values
4. Add the new screen name and description to the Screens section of DESIGN.md after creating it

This means DESIGN.md is always up to date and always accurate. It self-maintains as Claude Code generates.

### Updating the design system

Designer prompts Claude Code:
```
"Update DESIGN.md — change the accent colour to #5856D6 and tighten 
card radius to 16. Then regenerate the Home and Settings screens 
to reflect the changes."
```

Claude Code:
1. Updates DESIGN.md (accent + card radius values)
2. Rewrites `screens/Home.tsx` with new values via `useTheme()`
3. Rewrites `screens/Settings.tsx` with new values via `useTheme()`
4. Metro hot-reloads — Simulator updates

The designer sees the change on screen in ~15 seconds. No file was manually edited.

---

## 11. Proto Skills for Claude Code

### What this is

A `CLAUDE.md` file at the Proto project root. When Claude Code is opened inside a Proto project, it reads CLAUDE.md automatically and becomes a Proto-aware design tool. No configuration, no setup, no repeating instructions.

### Full CLAUDE.md contents (auto-generated at `npm create proto@latest`)

```markdown
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
- Never mix raw React Native into a screen regardless of library choice

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
```

---

## 12. Component Library Registry

### Supported libraries at launch

| Library | Package | Import path | Install |
|---|---|---|---|
| Proto (default) | built-in | ../components/proto | none |
| Tamagui | @tamagui/core | @tamagui/core | pnpm add @tamagui/core |
| Gluestack UI v2 | @gluestack-ui/themed | @gluestack-ui/themed | pnpm add @gluestack-ui/themed |
| React Native Paper | react-native-paper | react-native-paper | pnpm add react-native-paper |
| NativeWind | nativewind | nativewind | pnpm add nativewind |
| Custom | user-defined | user-defined | pnpm add [package] |

### How library selection works

**Step 1 — Designer picks a library in `proto design`**
They select from the list above or enter a custom package name. Proto writes the library details to DESIGN.md and installs the package automatically for known libraries.

**Step 2 — DESIGN.md records the choice**
```markdown
## Component Library
- Package: @tamagui/core
- Import from: @tamagui/core
- Docs: https://tamagui.dev/docs/components
- Fallback: proto
```

**Step 3 — CLAUDE.md routes imports accordingly**
Claude Code reads the Component Library section before every generation and uses the correct import path. For Tamagui it uses `@tamagui/core`. For Gluestack it uses `@gluestack-ui/themed`. For Proto it uses `../components/proto`.

**Step 4 — Fallback is always Proto**
If the specified library doesn't have a component that covers the need (e.g. Tamagui doesn't have a drop-in for Proto's `Screen` safe area wrapper), Claude Code falls back to the Proto primitive silently. The designer never sees this — screens just work.

### Why this matters for handoff

When a team prototypes using their actual production component library (e.g. Tamagui), the screens Claude Code generates aren't throwaway prototypes — they are close to production code. An engineer opens `/screens/Settings.tsx`, sees familiar Tamagui imports and patterns, and can move that file directly into the production codebase with minimal rework.

The gap between prototype and production collapses from weeks to hours.

### Custom library example

Designer prompts:
```
"Update DESIGN.md — set the component library to our internal design system.
Package is @acme/mobile-components, import from @acme/mobile-components"
```

Claude Code updates DESIGN.md:
```markdown
## Component Library
- Package: @acme/mobile-components
- Import from: @acme/mobile-components
- Docs: (none)
- Fallback: proto
```

Designer then runs: `pnpm add @acme/mobile-components`

From that point, every screen Claude Code generates uses `@acme/mobile-components` imports. Claude Code already knows the library if it's well-documented in its training data. For proprietary libraries, the designer can add component examples to DESIGN.md and Claude Code will follow the pattern.

### Adding components examples for custom libraries

For proprietary or less-known libraries, add an `## Examples` section to DESIGN.md:

```markdown
## Examples
// Primary button
import { Button } from '@acme/mobile-components';
<Button variant="primary" onPress={handler}>Label</Button>

// Card surface
import { Surface } from '@acme/mobile-components';
<Surface elevated padding="md">content</Surface>
```

Claude Code reads these examples and follows the exact API pattern when generating screens. Two or three examples cover the entire library — Claude Code extrapolates the rest.

---

## 13. Design Token System

### How tokens work

All Proto components call `useTheme()` internally. `useTheme()` reads the theme from `proto.config.js` (still present, single field: `theme`) and returns the correct token set. DESIGN.md holds the human-readable version of these same tokens. When Claude Code generates a screen, it uses `useTheme()` to access tokens — never hardcodes values.

### Liquid Glass token set

`components/proto/tokens/liquidGlass.ts`

```typescript
export const liquidGlass = {
  surface: {
    primary: 'rgba(255,255,255,0.72)',
    secondary: 'rgba(255,255,255,0.48)',
    card: 'rgba(255,255,255,0.60)',
    nav: 'rgba(255,255,255,0.82)',
  },
  text: {
    primary: '#000000',
    secondary: 'rgba(0,0,0,0.5)',
    tertiary: 'rgba(0,0,0,0.3)',
    destructive: '#FF3B30',
  },
  blur: {
    nav: 40,
    card: 20,
    modal: 60,
  },
  border: {
    default: 'rgba(255,255,255,0.4)',
    strong: 'rgba(255,255,255,0.7)',
  },
  radius: {
    card: 22,
    button: 14,
    modal: 44,
    input: 12,
  },
  space: {
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
  },
  type: {
    title:    { fontSize: 34, fontWeight: '700', letterSpacing: -0.4 },
    headline: { fontSize: 22, fontWeight: '600', letterSpacing: -0.4 },
    body:     { fontSize: 17, fontWeight: '400' },
    caption:  { fontSize: 12, fontWeight: '400' },
    label:    { fontSize: 13, fontWeight: '500' },
  },
};
```

### Material You token set

`components/proto/tokens/materialYou.ts`

```typescript
export const materialYou = {
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
  blur: { nav: 0, card: 0, modal: 0 },
  border: { default: '#CAC4D0', strong: '#79747E' },
  radius: { card: 12, button: 20, modal: 28, input: 4 },
  space: {
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
  },
  type: {
    title:    { fontSize: 32, fontWeight: '400', letterSpacing: 0 },
    headline: { fontSize: 24, fontWeight: '400' },
    body:     { fontSize: 16, fontWeight: '400' },
    caption:  { fontSize: 12, fontWeight: '400' },
    label:    { fontSize: 14, fontWeight: '500' },
  },
};
```

---

## 14. Error Handling Philosophy

### The rule
No error shown to a designer requires engineering knowledge to interpret.

### Error translation layer

| Metro error | Proto message |
|---|---|
| `Unable to resolve module` | `A component couldn't be found. Run: proto reset` |
| `SyntaxError` | `A screen has an error. Ask Claude Code: "fix any errors in the [ScreenName] screen"` |
| `EADDRINUSE` | `Proto is already running. Close the other window first.` |
| `SDK version mismatch` | `Proto needs to update. Run: proto update` |
| `Network request failed` | `Can't reach your device. Check you're on the same WiFi.` |
| Anything else | `Something went wrong. Run: proto reset` |

### `proto reset`

Silently:
1. Kills Metro on port 8081
2. Clears `.expo/` and `node_modules/.cache`
3. Restarts with `expo start --clear`
4. Prints: `Proto restarted. Simulator is updating.`

### On Claude Code errors

If Claude Code generates invalid JSX or references a non-existent component, Metro will error. The error translation layer catches it and responds:

`A screen has an error. Ask Claude Code: "fix any errors in the [ScreenName] screen"`

The designer pastes this into Claude Code. Claude Code reads the file, identifies the issue, rewrites it. Metro hot-reloads. Resolved without the designer ever seeing the underlying error.

---

## 15. Custom Dev Client Plan (Phase 3, optional)

> **Status:** Demoted from Phase 2 requirement to Phase 3 nice-to-have on 2026-05-22 after the Expo SDK 54 pivot. Liquid Glass works in stock Expo Go via `@expo/ui/swift-ui` + `expo-glass-effect` — no custom native module needed.

### What it is
An Expo custom dev client compiled once with Proto's brand baked in. Published as "Proto" on the App Store. Identical scan-QR experience to Expo Go — but Proto-branded.

### Why it's optional now
- Liquid Glass: handled by `expo-glass-effect` `GlassView` and `@expo/ui/swift-ui` modifiers, both part of Expo SDK 54, both run inside Expo Go.
- The remaining motivation is purely brand: designers see "Proto" on the home screen instead of "Expo Go". Worth doing once Proto has traction; not blocking.

### Build process
1. Add `expo-dev-client` to Proto's template `package.json`
2. Configure `app.json` with Proto branding — name, bundle ID `com.proto.app`, icons
3. Run `eas build --profile development --platform ios` (one-time)
4. Submit to App Store as "Proto — Native Prototyping" (free, category: Developer Tools)
5. Submit to Play Store as "Proto" (free)

### Designer experience — identical to Phase 1
- `proto start` → QR appears in terminal
- Designer opens "Proto" app → scans QR → prototype loads on device
- Everything else unchanged

### App Store metadata
- **Name:** Proto — Native Prototyping
- **Subtitle:** Design on your device
- **Category:** Developer Tools
- **Description:** Run native prototypes on your phone. No Xcode. No setup. Made for designers.

### Timeline
- Build + TestFlight: 1 week
- App Store review: ~3 days
- Buffer: 2 weeks total end-to-end

---

## 16. Distribution & GTM

### npm package
- Package: `create-proto` on npm
- Initial publish: Phase 1 complete ✅
- Versioning: semver, `proto update` bumps the version

### Open source strategy
- CLI + component library + CLAUDE.md: MIT licensed, public GitHub
- `proto.run` share platform: closed source
- Monetisation: Pro plan on `proto.run`

### Launch sequencing

**Phase 1 launch** ✅ (or imminent)
- GitHub repo + npm publish + `proto.run` landing page (waitlist)
- Hook: "The native prototype tool Figma Make can't be"
- Channels: Design Twitter/X, Figma Community, Layers.to
- Design AI Stack: build-in-public launch article

**Phase 2 launch — Liquid Glass timing**
- Hook: "Describe it. Watch it appear on your phone."
- Secondary hook: "The only tool that renders Liquid Glass without Xcode"
- Timing: aligned with iOS 26 broad adoption / WWDC post-announcement
- Channels: Product Hunt, design Twitter, WWDC-adjacent conversation
- Design AI Stack: "How I built a prompt-native design environment" — practitioner article

**Phase 3 launch — proto.run public**
- Hook: "Share your native prototype like a Figma link"
- Monetisation begins: proto.run Pro

### Pricing model (proto.run)
| Tier | Price | Limits |
|---|---|---|
| Free | $0 | 3 active share links, 7-day expiry |
| Pro | $12/mo | Unlimited links, 30-day expiry, comment layer, version history |
| Team | $29/mo | Everything in Pro, team dashboard, password-protected shares |

### Design AI Stack flywheel
- Every build decision → Design AI Stack article
- Proto is the living example in every Playbook guide about AI-assisted native prototyping
- GitHub repo links to Design AI Stack for the backstory
- Each Proto launch = a newsletter issue = subscriber growth

---

## 17. Claude Code Prompts

Use these directly in Claude Code. Each one is scoped to a single buildable unit. Phase 1 prompts are complete. Phase 2 prompts are what to build next.

---

### Prompt 1 — Initialise the monorepo ✅ Phase 1

```
Create a new Node.js monorepo for a CLI tool called "Proto".

Structure:
packages/
  create-proto/     ← npm create package (CLI scaffolding)
  proto-cli/        ← proto start/design/new-screen/reset commands
  proto-components/ ← React Native component library
apps/
  proto-app/        ← Expo custom dev client (Phase 2, stub for now)

Root package.json with pnpm workspaces.
Each package has its own package.json with correct name fields.
Use Node 18+. TypeScript throughout. ESM modules.
```

---

### Prompt 2 — Build the create-proto scaffolding CLI ✅ Phase 1

```
Build the create-proto package. Runs when a designer types:
  npm create proto@latest my-app

Requirements:
- Use clack for terminal UI
- Ask: "What's your prototype called?" (defaults to folder name)
- Copy /template folder into target directory
- Run pnpm install silently (spinner only, no output)
- Open iOS Simulator via: open -a Simulator
- Run expo start --ios automatically
- Success: "Proto is ready. Simulator is opening."

Template folder (create-proto/template/):
- DESIGN.md (seeded with liquidGlass defaults, app name from CLI input)
- CLAUDE.md (full Proto Skills — see Section 11 of master doc)
- screens/Home.tsx (starter screen)
- components/proto/ (symlink to proto-components, or copied at install)
- assets/ (.gitkeep)
- package.json (pre-configured with expo, reanimated, gesture-handler, blur, haptics)
- .gitignore

Never show: npm/pnpm output, file paths, error stack traces.
```

---

### Prompt 3 — Build the Proto component library ✅ Phase 1

```
Build the proto-components package. React Native component library 
used inside Expo Proto projects. All components read from a theme context.

Components: Screen, Stack, Row, Text, Card, Button, Toggle, Nav, Modal, Divider
ThemeProvider + useTheme hook — reads proto.config.js, returns token set

Token files:
- liquidGlass.ts (exact values from master doc Section 12)
- materialYou.ts (exact values from master doc Section 12)
- base.ts (system defaults, no blur effects)

All components:
- Use useTheme() for all token values — never hardcode
- TypeScript throughout
- No runtime dependencies beyond Expo SDK packages

Export everything from a single index.ts.
```

---

### Prompt 4 — Build proto start ✅ Phase 1

```
Build the proto start command in proto-cli.

Steps:
1. Read proto.config.js from current directory
2. Spawn: expo start --ios
3. Capture Metro stdout/stderr
4. Suppress all Metro output by default
5. Print: "Proto running → Simulator is open"

Error translation (stderr pattern matching):
- /Unable to resolve module/ → "A component couldn't be found. Run: proto reset"
- /SyntaxError/ → "A screen has an error. Ask Claude Code to fix it."
- /EADDRINUSE/ → "Proto is already running. Close the other window first."
- /Network request failed/ → "Can't reach your device. Check WiFi."
- Anything else → "Something went wrong. Run: proto reset"

--verbose flag passes Metro output through unfiltered.
Use clack throughout.
```

---

### Prompt 5 — Build proto new-screen ✅ Phase 1

```
Build proto new-screen command.

Usage:
  proto new-screen Profile
  proto new-screen Profile --template list

Templates (hardcoded):
- home: Screen > Stack > Text (title) + two Card components
- list: Screen > Stack of 5 Toggle + Divider between each
- detail: Screen > Card (glass=true) at top + Text blocks below
- form: Screen > Stack of Card-wrapped inputs + primary Button
- modal: Modal wrapping Stack with Text and two Buttons

Steps:
1. PascalCase the name
2. Generate from template or empty scaffold
3. Write to screens/<Name>.tsx
4. Print: "<Name> screen created → it's live in the Simulator"

Empty scaffold uses Screen + Stack + Text only.
```

---

### Prompt 6 — Build proto reset ✅ Phase 1

```
Build proto reset command. Designer's escape hatch.

Steps (silent, spinner only):
1. Kill Metro on port 8081 (lsof + kill)
2. Delete .expo/ cache
3. Delete node_modules/.cache
4. Run expo start --ios --clear
5. Print: "Proto restarted. Simulator is updating."

Never show internal commands. Use clack.
```

---

### Prompt 7 — Build proto design ✅ Phase 2

```
Build the proto design command. Interactive setup that generates or updates DESIGN.md.

Flow using clack:
1. "Which theme?" — select: Liquid Glass / Material You / Base
2. "Accent colour? (hex)" — text input, default #007AFF (LG) / #6750A4 (MY)
3. "Component library?" — select:
     Proto (built-in)
     Tamagui
     Gluestack UI
     React Native Paper
     NativeWind
     Custom (enter package name)
   If Custom: additional text input for package name, and optional docs URL
4. "App name?" — text input

On completion:
- Generate DESIGN.md using full structure from master doc Section 10
- Component Library section uses selected library's package + import path
- For known libraries: run pnpm add <package> silently (spinner, no output)
- For Proto (built-in): no install step
- Use theme-appropriate defaults for all other fields
- If DESIGN.md already exists: ask "Update existing design system? (y/n)"
- If yes: overwrite. If no: exit without changes.

Output: "DESIGN.md created. Open Claude Code and start designing."

Known library install map:
  Tamagui         → pnpm add @tamagui/core
  Gluestack UI    → pnpm add @gluestack-ui/themed
  RN Paper        → pnpm add react-native-paper
  NativeWind      → pnpm add nativewind

Also add proto design update subcommand:
- Prints instructions for updating via Claude Code prompt
- Does not open any editor
```

---

### Prompt 8 — Generate DESIGN.md and CLAUDE.md templates ✅ Phase 2

```
Create two template files used by create-proto scaffolding:

1. template/DESIGN.md
   Full DESIGN.md with liquidGlass defaults.
   App name replaced by {{APP_NAME}} placeholder (substituted at install).
   All sections from master doc Section 10.

2. template/CLAUDE.md
   Full Proto Skills as defined in master doc Section 11.
   Copy the CLAUDE.md contents exactly — this file must not be 
   paraphrased or shortened. It is read verbatim by Claude Code.

Both files are copied into the designer's project at install time by create-proto.
CLAUDE.md is never shown to the designer — it is infrastructure.
```

---

### Prompt 9 — Build proto remove and proto snapshot 🔲 Phase 2/3

```
Build two commands:

proto remove <screen-name>
- Delete /screens/<ScreenName>.tsx
- Remove the screen entry from DESIGN.md Screens section
- Print: "<Name> screen removed."

proto snapshot "<name>"
- Copy /screens/ contents to /.proto/snapshots/<timestamp>-<slugified-name>/
- Write a snapshot manifest: { name, date, screens: [] }
- Print: "Snapshot saved: <name>"

proto snapshots (list command)
- List all snapshots with name and date
- Print as a simple numbered list
```

---

### Prompt 10 — Build Proto App custom dev client 🔲 Phase 3 (optional, branding only)

> Demoted from Phase 2 requirement on 2026-05-22. Liquid Glass is now solved by `@expo/ui/swift-ui` + `expo-glass-effect` inside Expo Go. Custom dev client is now purely a branding play.

```
Set up the proto-app Expo custom dev client.

In apps/proto-app/:
1. Initialise an Expo bare workflow app
2. Install expo-dev-client
3. (Liquid Glass already works via expo-glass-effect — no extra blur dep needed)
4. Install expo-haptics
5. Configure app.json:
   - name: "Proto"
   - slug: "proto-app"
   - bundleIdentifier: "com.proto.app"
   - package: "com.proto.app"
   - version: "1.0.0"
   - orientation: portrait
   - icon: ./assets/icon.png
   - splash: standard config

6. Create eas.json with development build profile:
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    }
  }
}

7. Add build instructions to apps/proto-app/README.md:
   - How to build for TestFlight (eas build --profile development --platform ios)
   - How to install on device from TestFlight
   - How to use with proto start (scan QR, same as Expo Go)

Do not build the native binary — just set up the project correctly 
so it can be built with: eas build --profile development --platform ios
```

---

### Prompt 11 — Component library switching via Claude Code 🔲 Phase 2

```
This is not a CLI command — it is a Claude Code workflow test.

Verify that when a designer prompts Claude Code to switch component 
libraries, the correct behaviour happens end to end.

Test scenario:
1. Proto project has DESIGN.md with Package: proto (built-in)
2. Designer prompts Claude Code:
   "Switch the component library to Tamagui. Update DESIGN.md and 
   regenerate the Home screen using Tamagui components."
3. Claude Code should:
   a. Update DESIGN.md Component Library section:
        Package: @tamagui/core
        Import from: @tamagui/core
        Docs: https://tamagui.dev/docs/components
        Fallback: proto
   b. Rewrite screens/Home.tsx using Tamagui imports (@tamagui/core)
      instead of Proto primitives (../components/proto)
   c. Use correct Tamagui component names and props
   d. Fall back to Proto Screen wrapper if Tamagui equivalent not available

Write a test screen for Home.tsx that:
- Uses YStack or XStack from @tamagui/core for layout
- Uses Text from @tamagui/core for typography  
- Uses Card from @tamagui/core for surfaces
- Falls back to Screen from ../components/proto for the root wrapper
  (since Tamagui doesn't have a safe-area screen equivalent)

Verify Metro hot-reloads and Simulator shows the updated screen.

If the test fails because @tamagui/core is not installed, note that 
the designer should have run proto design to install it first, or 
run: pnpm add @tamagui/core manually as a one-time setup.
```

### Technical

| Question | Current thinking |
|---|---|
| Can generated screens import from each other? | Phase 2: Yes, via /components/shared/. Claude Code creates the shared component and updates all consumers. |
| How does navigation between generated screens work? | expo-router handles this automatically via file name. Proto patches .proto/app/(proto)/_layout.tsx on screen creation/removal. |
| Windows support? | Metro runs on Windows but iOS Simulator does not. Windows users can use physical device via Expo Go / Proto App + QR. Document this clearly. Phase 3: consider Windows + Android Simulator path. |
| What if Claude Code generates a screen with a non-existent Proto component? | CLAUDE.md lists all available components explicitly. Claude Code constrained to that list. If it still errors, Metro catches it and surfaces the friendly error with the fix prompt. |
| Does DESIGN.md drift over time as Claude Code makes changes? | CLAUDE.md instructs Claude Code to update DESIGN.md every time it adds a screen. Monitor this in Phase 2 testing. Add `proto design validate` command if drift is observed in practice. |
| What happens when a custom library has components Claude Code doesn't know? | Designer adds 2-3 component examples to a `## Examples` section in DESIGN.md. Claude Code reads these and follows the exact API pattern. Two or three examples cover most of the library — Claude Code extrapolates the rest. |
| Should proto design auto-install the component library package? | Yes for known libraries (Tamagui, Gluestack, Paper, NativeWind). For Custom: print the install command and let the designer run it. Auto-install of unknown packages is risky. |

### Product

| Question | Current thinking |
|---|---|
| Should designers be able to describe interactions (tap → navigate) in prompts? | Yes. This is core to Phase 2. CLAUDE.md should include navigation patterns: "when the user taps X, navigate to Y screen using expo-router's router.push()". Add this to CLAUDE.md in Phase 2. |
| What if a designer wants to tweak a very specific visual detail that's hard to describe? | This is the only real friction in the prompt-only model. Mitigation: Proto component props are descriptive (glass, variant, size, color) so most visual intent is expressible. For pixel-level control, the answer is: describe it more precisely. The model handles this better than expected. |
| Should Proto support importing a Figma frame as a starting screen? | Not Phase 1 or 2. Phase 3+ exploration. Figma's API returns design data, not a screen — the generation challenge is significant. |
| Is DESIGN.md enough for complex design systems with many variants? | For prototyping: yes. Prototypes don't need a full design system — they need enough to look coherent. DESIGN.md covers that. For teams with an established design system, Phase 3 could support importing a design token JSON (e.g. from Style Dictionary) into DESIGN.md format. |

### GTM

| Question | Current thinking |
|---|---|
| When to announce Phase 2? | After DESIGN.md + CLAUDE.md are stable and tested. The "describe it, watch it appear" moment needs to work reliably before a public demo. |
| Should Proto be a Design AI Stack product or its own brand? | Own brand. Design AI Stack is distribution, not ownership. Proto outlives any publication. |
| What's the relationship between Proto and Claude Code? | Proto is not an Anthropic product. It's a tool built for Claude Code by a designer. The positioning is honest: "Proto works with Claude Code." Not a partnership — an integration. |
| Pricing for proto.run Pro? | Free: 3 share links, 7-day expiry. Pro: $12/mo, unlimited, comment layer, version history. Team: $29/mo, team dashboard, password-protected shares. |

---

## Appendix — Key decisions log

| Decision | Rationale |
|---|---|
| Expo under the hood, not bare RN | Expo's managed workflow means Proto doesn't need to manage native builds. Custom dev client is the escape hatch for native modules. |
| Claude Code as prompt layer, not custom server | Reinventing a prompt interface when Claude Code already exists is wasted work. Proto's job is to be the best target environment for Claude Code — not to be an AI tool itself. |
| DESIGN.md over proto.config.js for design tokens | DESIGN.md is human-readable, Claude Code-readable, and engineer-readable. A JavaScript config file is none of these for a non-technical designer. |
| CLAUDE.md for Proto Skills | CLAUDE.md is the standard mechanism for giving Claude Code project-specific instructions. Using it means zero custom tooling — Proto Skills work automatically when Claude Code opens the project. |
| No in-app prompt overlay | Breaks the paradigm. If Claude Code CLI is the design tool, a second prompt surface creates confusion. One tool, one surface. Keep it clean. |
| Full-file rewrite over diff | LLM diffs are fragile. Full file rewrites are reliable. Metro hot-reloads regardless. Screen files are small enough that this is never a performance concern. |
| DESIGN.md self-maintains via Claude Code | Instructing Claude Code to update the Screens section of DESIGN.md after every generation means the file stays accurate without a separate sync step. |
| Simulator-first for Phase 1+2, physical device in Phase 2 | Simulator has zero setup. Physical device requires Expo Go (Phase 1) or Proto App (Phase 2). Getting the Simulator experience right first means faster iteration and no device dependency in early testing. |
| Component library as a DESIGN.md field, not a config option | The library choice belongs in DESIGN.md because it is a design decision, not a build decision. CLAUDE.md reads it automatically. Engineers see it at handoff. One source of truth for everything. |
| Proto as default fallback, not hard requirement | Making Proto primitives the fallback rather than the only option means teams with existing design systems can use Proto immediately without rebuilding their component vocabulary. Adoption friction drops significantly. |
| No point-and-click editor, ever | The paradigm is prompt-only. Adding a visual editor would pull the product toward Figma and away from the thing that makes it different. Resist this even when it feels like a missing feature. |
| Write to disk, not runtime eval | Runtime JSX evaluation in React Native requires custom bundler config and is fragile. Disk writes + Metro hot reload is stable, inspectable, and lets engineers read the output at handoff. |
| clack for terminal UI | Most polished terminal UI library available. Used by Vite, Astro, and similar tools designers encounter. Familiar output patterns. Keeps Proto feeling like a modern tool. |
| Phase 2 shipped 2026-05-21 | DESIGN.md + CLAUDE.md templates, `proto design` interactive command, library catalog, scaffold substitutions. Reality fixes during device validation: align template to Expo SDK 54 (`react-native 0.81`, `react-native-worklets 0.5.1`); root-level `babel.config.js` / `metro.config.js` / `app.config.js` (Phase 1's `.proto/` hiding broke Metro discovery); `expo-blur` instead of `@react-native-community/blur` (Fabric); CommonJS `proto.config.js` (Hermes can't reparse ESM); `node-linker=hoisted` `.npmrc` (Expo's recommendation for pnpm); `expo start` inherits the terminal (TTY needed for QR). End-to-end validated on real iOS device via Expo Go. |
| Liquid Glass via `@expo/ui/swift-ui` + `expo-glass-effect` (2026-05-22) | Apple's native SwiftUI `glassEffect` modifier exposed to React Native through `@expo/ui/swift-ui`. `expo-glass-effect` provides a `GlassView` React Native component that wraps arbitrary RN children and auto-falls-back to a regular View on iOS <26 / Android. Both ship with Expo SDK 54, MIT-licensed, work in stock Expo Go — no custom native module required. Replaces the old `@react-native-community/blur` path entirely. |
| Custom dev client demoted to Phase 3 (2026-05-22) | No longer a technical requirement now that Liquid Glass works in stock Expo Go via Expo SDK 54. Remaining motivation is purely brand (Proto on the home screen). Worth doing once Proto has traction; not blocking. |
| `expo-blur` as the iOS <26 + Android fallback | Same Expo SDK origin, MIT-licensed, consistent with the rest of the stack. Card and Nav use `isLiquidGlassAvailable()` to pick between `GlassView` and `BlurView` at runtime — designer always writes `<Card glass>`, the platform decision is internal. |
| SwiftUI `Toggle` via `@expo/ui/swift-ui` (2026-05-22) | Proto's `Toggle` wraps the native SwiftUI `Toggle` inside `<Host>` on iOS for authentic platform feel; falls back to RN `Switch` on Android. Proto's public API (`label`, `value`, `onChange`) is unchanged from the designer / Claude Code perspective. |
