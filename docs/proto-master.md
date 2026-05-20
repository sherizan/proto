# Proto — Master Product Document
> Native prototype tool for designers. No engineering background required.
> Last updated: May 2026 | Build target: Claude Code

---

## Table of Contents

1. [Product Brief](#1-product-brief)
2. [PRD — Product Requirements](#2-prd)
3. [Tech Stack](#3-tech-stack)
4. [Architecture](#4-architecture)
5. [Folder & File Scaffolding](#5-folder--file-scaffolding)
6. [Phase 1 — Scaffolding + Preview](#6-phase-1--scaffolding--preview)
7. [Phase 2 — Prompt Layer + Proto App](#7-phase-2--prompt-layer--proto-app)
8. [Phase 3 — Share + Scale](#8-phase-3--share--scale)
9. [CLI Design](#9-cli-design)
10. [Prompt-to-Component System](#10-prompt-to-component-system)
11. [Design Token System](#11-design-token-system)
12. [Error Handling Philosophy](#12-error-handling-philosophy)
13. [Custom Dev Client Plan](#13-custom-dev-client-plan)
14. [Distribution & GTM](#14-distribution--gtm)
15. [Claude Code Prompts](#15-claude-code-prompts)
16. [Open Questions & Risks](#16-open-questions--risks)

---

## 1. Product Brief

### Vision
The missing tool between Figma Make and production. A prompt-driven native prototyping environment that runs on a real device with zero engineering knowledge required.

### The Gap
| Tool | Designer-friendly | Genuinely native | Prompt-driven | Zero config |
|---|---|---|---|---|
| Figma Make | ✓ | ✗ (webview) | partial | ✓ |
| **Proto** | **✓** | **✓** | **✓** | **✓** |
| Expo | ✗ | ✓ | ✗ | ✗ |
| SwiftUI | ✗ | ✓ | ✗ | ✗ |

### Target user
A product designer at a mid-to-large company. Has Figma proficiency. Ships interaction design. Wants to prototype in native fidelity — real gestures, real haptics, Liquid Glass, actual scroll physics — without waiting for an engineer or learning React Native. No terminal anxiety tolerance. No Xcode. No Metro errors.

### North star metric
Time from `npm create proto@latest` to a prototype running on a real device. Target: under 90 seconds.

### Positioning statement
Proto is the native prototype sketchpad for product designers. It runs on your phone, responds to prompts, and has no engineering concepts on the surface.

---

## 2. PRD

### Goals
- A designer with zero React Native knowledge can install, preview, and interact with a native prototype in one session
- Prompt input generates real native components on device (not webview rendering)
- Liquid Glass and iOS 26 design language are first-class presets at launch
- Sharing a prototype requires no accounts, no dashboards, just a QR code
- Errors are never surfaced in engineering language

### Non-goals (v1)
- No authentication flows or backend integration
- No production build pipeline (EAS, TestFlight, Play Store upload)
- No collaborative real-time editing
- No Figma plugin or import
- No web preview (mobile-only for now)
- Not a replacement for production code — prototypes only

### User stories

**Install**
- As a designer, I run one command and my prototype environment is ready
- As a designer, I never see a config file, a dependency list, or a package version conflict

**Preview**
- As a designer, I scan a QR code and my prototype runs on my actual phone
- As a designer, the preview updates instantly when I make changes — no build step, no wait

**Prompt**
- As a designer, I describe a screen or component in plain language and it appears on my device
- As a designer, I can specify a design system preset (Liquid Glass, Material You) and it's applied correctly
- As a designer, I can swap between screens with realistic transitions

**Share**
- As a designer, I can send a QR code to a stakeholder and they can run my prototype without installing anything (Phase 3)

### Success metrics — Phase 1
- Install to QR scan < 90 seconds on a clean machine
- 5 non-technical designers complete install without assistance
- Zero raw engineering errors surfaced to user during normal use

### Success metrics — Phase 2
- Prompt to rendered native component < 10 seconds
- Designer can build a 5-screen prototype in < 30 minutes using prompts only

### Constraints
- Must work on macOS (primary), Windows support in Phase 2
- iOS preview primary, Android in Phase 1 via Expo Go
- Node.js 18+ required (only hidden prerequisite)
- Claude API key required for prompt layer (Phase 2) — but not for Phase 1

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
- **Framework:** Expo SDK 53 (latest) — hidden from designer
- **Navigation:** expo-router (file-based, abstracted behind Proto screen primitives)
- **Animation:** react-native-reanimated 3
- **Gestures:** react-native-gesture-handler
- **Safe area:** react-native-safe-area-context
- **Blur / Glass effects:** `@react-native-community/blur`
- **Haptics:** expo-haptics

### AI Layer (Phase 2)
- **Model:** `claude-sonnet-4-20250514`
- **SDK:** `@anthropic-ai/sdk`
- **Prompt server:** Local Node.js server running alongside Metro (port 3001)
- **Hot reload trigger:** Writes generated files to disk → Metro picks up

### Preview
- **Phase 1:** Expo Go
- **Phase 2:** Custom dev client — white-labelled as "Proto" on App Store / Play Store

### Share Layer (Phase 3)
- **Hosting:** `proto.run` — Vercel-hosted Next.js app
- **Tunnel:** `expo-tunnel` or custom ngrok wrapper for QR sharing
- **Database:** Supabase (prototype metadata, share tokens)

---

## 4. Architecture

### System overview

```
Designer
    │
    ▼
proto CLI
    ├── Scaffolds project (one-time)
    ├── Starts dev server (Metro + Proto server)
    └── Accepts prompt commands

Proto Dev Server (port 3001)
    ├── Receives prompts from CLI or in-app UI (Phase 2)
    ├── Calls Claude API with component generation prompt
    ├── Writes generated .tsx to /screens/
    └── Metro hot-reloads automatically

Metro (hidden, managed)
    └── Serves bundle to device

Expo Go / Proto App (device)
    └── Renders native components
        ├── Phase 1: Expo Go
        └── Phase 2+: Proto custom dev client
```

### Data flow — prompt to device

```
1. Designer types:  "add a settings screen with a toggle list"
2. CLI/UI sends:    POST http://localhost:3001/generate
3. Proto server:    Calls Claude API with system prompt + designer input
4. Claude returns:  Valid React Native JSX (Screen component)
5. Server writes:   /screens/Settings.tsx
6. Metro detects:   File change → hot reload
7. Device updates:  New screen appears, no restart
```

### Key design decision — no runtime eval

Generated components are written to disk and picked up by Metro. This avoids the complexity of runtime JSX evaluation in React Native, keeps the bundle clean, and means generated code is inspectable by engineers at handoff.

---

## 5. Folder & File Scaffolding

### What `npm create proto@latest my-app` creates

```
my-app/
│
├── proto.config.js          ← ONLY file designers should touch
│
├── screens/                 ← Generated screens live here
│   ├── Home.tsx             ← Starter screen (seeded by CLI)
│   └── .gitkeep
│
├── assets/
│   ├── icon.png
│   └── splash.png
│
├── components/              ← Shared Proto components (pre-built)
│   └── proto/
│       ├── Screen.tsx       ← Base screen wrapper
│       ├── Stack.tsx        ← Navigation primitive
│       ├── Nav.tsx          ← Bottom nav primitive
│       ├── Modal.tsx        ← Modal primitive
│       └── tokens/
│           ├── liquidGlass.ts
│           └── materialYou.ts
│
├── .proto/                  ← Managed by Proto CLI, never touch
│   ├── app/                 ← expo-router app dir (hidden from designer)
│   │   ├── _layout.tsx
│   │   └── (proto)/
│   │       └── [...screen].tsx
│   ├── server/              ← Local prompt server
│   │   └── index.js
│   ├── expo-config/
│   │   ├── app.json
│   │   ├── babel.config.js
│   │   └── metro.config.js
│   └── .gitignore
│
├── package.json             ← Pre-configured, designer doesn't edit
└── .gitignore
```

### `proto.config.js` — the designer's only surface

```javascript
// proto.config.js
// This is the only file you need to touch.

export default {
  name: "My App",           // Your prototype name
  theme: "liquidGlass",     // "liquidGlass" | "materialYou" | "base"
  accentColor: "#007AFF",   // Primary colour
  screens: {
    initial: "Home",        // Which screen loads first
  },
};
```

### Starter `screens/Home.tsx` (seeded by CLI)

```tsx
import { Screen, Text, Stack } from '../components/proto';

export default function Home() {
  return (
    <Screen title="Home">
      <Stack gap={16}>
        <Text size="title">Welcome to Proto</Text>
        <Text size="body" color="secondary">
          Describe what you want to build using the prompt panel.
        </Text>
      </Stack>
    </Screen>
  );
}
```

---

## 6. Phase 1 — Scaffolding + Preview

### Goal
Designer runs one command, scans QR, and has a native prototype on their phone. No prompt layer yet. Just the scaffold, the shell, and reliable preview.

### Deliverables

**1. `create-proto` CLI package**
- `npm create proto@latest <name>` scaffolds the project
- Uses `clack` for a clean terminal experience with friendly copy
- Installs dependencies silently (spinner, no npm output shown)
- Opens QR code in terminal automatically on first run
- All Metro output suppressed by default (`proto start --verbose` to see it)

**2. Proto component library** (`components/proto/`)
- `<Screen>` — safe area aware, handles scroll, applies theme
- `<Stack>` — vertical layout primitive (flex column + gap)
- `<Row>` — horizontal layout primitive
- `<Text>` — themed typography (title, headline, body, caption, label)
- `<Nav>` — bottom navigation bar (2–5 tabs)
- `<Modal>` — sheet modal primitive
- `<Card>` — surface container with optional glass effect
- `<Button>` — primary, secondary, ghost variants
- `<Toggle>` — iOS-native switch
- `<Divider>`

**3. `proto start` command**
- Wraps `expo start` but suppresses raw Metro output
- Shows only: `Proto running → Scan QR to preview`
- QR rendered in terminal
- Friendly error layer active (see Section 12)

**4. `proto new-screen <name>` command**
- Scaffolds a new empty screen in `/screens/`
- Adds it to the navigation automatically
- Prints: `Screen "Profile" created → it's live on your device`

**5. 5 screen templates**
Pre-built, usable out of the box:
- `Home` — hero + card grid layout
- `List` — grouped list with icons
- `Detail` — header image + content
- `Form` — input fields + submit
- `Modal` — bottom sheet with actions

Generated with: `proto new-screen Profile --template list`

### Phase 1 acceptance criteria
- [ ] `npm create proto@latest my-app` works on a clean macOS machine with Node 18+
- [ ] QR appears in terminal within 45 seconds
- [ ] Prototype opens in Expo Go on iOS without errors
- [ ] Hot reload works when a screen file is saved
- [ ] `proto new-screen` creates a navigable screen
- [ ] No raw engineering errors visible to user during happy path

---

## 7. Phase 2 — Prompt Layer + Proto App

### Goal
Designer types a description, it appears as a native component on their device. And Expo Go is replaced by the Proto custom dev client on the App Store.

### Deliverables

**1. Prompt server** (`.proto/server/index.js`)
- Express server on port 3001, started by `proto start`
- `POST /generate` — receives prompt, calls Claude API, writes file to disk
- `POST /modify` — receives prompt + target screen name, modifies existing file
- `GET /screens` — lists current screens
- `DELETE /screens/:name` — removes a screen

**2. In-terminal prompt panel**
Phase 2a — the prompt lives in the terminal, not the device. Designer types:
```
proto add "a settings screen with a toggle for notifications, dark mode,
and a sign out button in destructive red"
```
Proto calls Claude, writes `screens/Settings.tsx`, Metro reloads. Done.

**3. In-app prompt overlay** (Phase 2b)
A floating FAB (bottom-right) inside the running prototype. Tapping opens a native bottom sheet with a text input. Submitting POSTs to the local prompt server. The screen updates without leaving the device.

This is the magic moment — the designer is holding the phone, taps a button, describes what they want, and watches it appear.

**4. Token-aware generation**
Claude API system prompt is constructed dynamically from:
- Current `proto.config.js` theme
- Available components in `components/proto/`
- Current screen list
- A strict "Proto component library only" constraint (no raw RN primitives)

**5. Proto App — custom dev client**
See Section 13 for full plan. Replaces Expo Go. Designer downloads "Proto" from the App Store. Identical scan-QR experience but:
- Custom branding (not Expo)
- Supports native modules Expo Go can't run
- Required for Liquid Glass (iOS 26 native APIs)
- Required for advanced haptics patterns

### Phase 2 acceptance criteria
- [ ] `proto add "..."` generates a valid, renderable screen in < 10 seconds
- [ ] Generated screen uses Proto component library only (no raw View/Text)
- [ ] Design tokens from `proto.config.js` are applied automatically
- [ ] In-app FAB opens prompt overlay
- [ ] Proto app available on TestFlight for beta
- [ ] Liquid Glass preset renders correctly on iOS 26 device

---

## 8. Phase 3 — Share + Scale

### Goal
A prototype can be shared with a stakeholder in one tap. No account. No setup. Just a link or QR.

### Deliverables

**1. `proto share` command**
- Starts a tunnel to the local server (via custom ngrok wrapper)
- Generates a `proto.run/p/<token>` URL
- Prints QR code to terminal
- Stakeholder scans QR → downloads Proto app if not installed → prototype loads

**2. `proto.run` — hosted share platform**
- Next.js app on Vercel
- Stores prototype metadata + deep link token
- Landing page per share token: `proto.run/p/<token>`
  - Shows: prototype name, creator, device frame preview (static screenshot)
  - CTA: "Open in Proto" (deep link)
- No account required to view
- Creator account required to share (free, email-only signup)

**3. Prototype snapshots**
- `proto snapshot "v1 — stakeholder review"` — saves the current screen set as a named version
- Snapshots are locally stored, shareable via `proto share --snapshot "v1"`

**4. Comment layer (Phase 3b)**
- Stakeholder can tap anywhere on the running prototype to drop a comment pin
- Comments sync to creator's `proto.run` dashboard
- No real-time, async only — like Figma share links

**5. Handoff export**
- `proto export` — bundles all `/screens/` as clean, commented React Native files
- Output in `/export/` with a `HANDOFF.md` explaining what each screen does
- Intended for engineers to use as a starting reference, not production code

---

## 9. CLI Design

### Command structure

```bash
# Create new prototype project
npm create proto@latest <name>

# Start dev server + Metro + prompt server
proto start

# Add a new screen (empty)
proto new-screen <name>

# Add a new screen from template
proto new-screen <name> --template [home|list|detail|form|modal]

# Generate a screen from prompt (Phase 2)
proto add "<natural language description>"

# Modify an existing screen (Phase 2)
proto edit <screen-name> "<what to change>"

# Remove a screen
proto remove <screen-name>

# Take a named snapshot
proto snapshot "<name>"

# Share prototype via tunnel (Phase 3)
proto share

# Export screens for engineer handoff (Phase 3)
proto export

# Show verbose Metro/server logs
proto start --verbose

# Reset if something breaks
proto reset
```

### Terminal UX design

All output uses `clack` with these principles:
- Never show stack traces
- Never show package names or version numbers
- Use plain verbs: "Starting...", "Done.", "Something went wrong."
- Spinners for anything over 1 second
- Success state shows only what the designer needs: the QR, the screen name, or "Done"

Example output for `proto add`:
```
◆ Proto
│
◇ Generating your screen...
│
◇ Settings screen created
│ Your device is updating
│
└ Done in 7s
```

Example output for an error:
```
◆ Proto
│
▲ Something went wrong with your last prompt
│ Try being more specific, or run: proto reset
│
└ Still stuck? proto.run/help
```

---

## 10. Prompt-to-Component System

### System prompt structure

The Claude API call is constructed from three parts:

**Part 1 — Role + constraints (static)**
```
You are a React Native component generator for Proto, a native prototyping tool for designers.

Rules:
- Only use components from the Proto component library (listed below)
- Never import raw React Native components (View, Text, TouchableOpacity, etc.)
- Never add comments to the generated code
- Never add TypeScript types or interfaces
- Always export a default function
- The function name must match the screen name exactly
- Generated code must be complete and renderable — no placeholders
```

**Part 2 — Component library (dynamic, from components/proto/)**
```
Available Proto components:
- Screen: base wrapper. Props: title (string), scrollable (bool)
- Stack: vertical layout. Props: gap (number), padding (number)
- Row: horizontal layout. Props: gap (number), align ("start"|"center"|"end")
- Text: typography. Props: size ("title"|"headline"|"body"|"caption"), color ("primary"|"secondary"|"accent"|"destructive")
- Card: surface container. Props: glass (bool), padding (number)
- Nav: bottom navigation. Props: tabs ([{icon, label, screen}])
- Button: action. Props: label (string), variant ("primary"|"secondary"|"ghost"|"destructive"), onPress
- Toggle: switch input. Props: label (string), value (bool)
- Divider: separator (no props)
- Modal: bottom sheet. Props: title (string), visible (bool)
```

**Part 3 — Context + designer input (dynamic)**
```
Current theme: liquidGlass
Accent color: #007AFF
Existing screens: Home, Profile

Designer request: "<designer's prompt here>"

Generate a single React Native screen component.
```

### Response handling

Claude returns a single JSX file. The server:
1. Extracts the code block
2. Validates it has a default export
3. Sanitises the function name to match the screen name (PascalCase)
4. Writes to `/screens/<ScreenName>.tsx`
5. If `expo-router` navigation needs updating, patches `.proto/app/(proto)/_layout.tsx`
6. Returns `{ screen: "Settings", path: "/screens/Settings.tsx" }` to the CLI

### Prompt modification (edit existing screen)

For `proto edit Settings "make the sign out button red and move it to the bottom"`:
1. Server reads current `/screens/Settings.tsx`
2. Passes it to Claude as context along with the modification instruction
3. Claude returns the full modified file (not a diff)
4. Server overwrites the file

Full-file rewrite is simpler and more reliable than diffing for this use case.

---

## 11. Design Token System

### Theme structure

`components/proto/tokens/liquidGlass.ts`

```typescript
export const liquidGlass = {
  // Surfaces
  surface: {
    primary: 'rgba(255, 255, 255, 0.72)',
    secondary: 'rgba(255, 255, 255, 0.48)',
    card: 'rgba(255, 255, 255, 0.6)',
    nav: 'rgba(255, 255, 255, 0.82)',
  },
  // Typography
  text: {
    primary: '#000000',
    secondary: 'rgba(0, 0, 0, 0.5)',
    tertiary: 'rgba(0, 0, 0, 0.3)',
    destructive: '#FF3B30',
  },
  // Blur
  blur: {
    nav: 40,
    card: 20,
    modal: 60,
  },
  // Borders
  border: {
    default: 'rgba(255, 255, 255, 0.4)',
    strong: 'rgba(255, 255, 255, 0.7)',
  },
  // Radius
  radius: {
    card: 22,
    button: 14,
    nav: 0,
    modal: 44,
  },
  // Spacing
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};
```

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

### Token resolution

`components/proto/useTheme.ts` — reads `proto.config.js` at runtime and returns the correct token set. All Proto components call `useTheme()` internally. Designer never touches tokens directly.

---

## 12. Error Handling Philosophy

### The rule
No error message shown to a designer should require engineering knowledge to interpret.

### Error translation layer

Wrap Metro's stderr output and translate before showing. Common cases:

| Metro error | Proto message |
|---|---|
| `Unable to resolve module` | `A component couldn't be found. Run proto reset to fix it.` |
| `SyntaxError: ...` | `The last generated screen has an issue. Run proto edit <screen> "fix any errors"` |
| `EADDRINUSE` | `Proto is already running in another window. Close it first.` |
| `SDK version mismatch` | `Proto needs to update. Run proto update.` |
| `Network request failed` | `Can't reach your device. Make sure your phone and computer are on the same WiFi.` |
| Any unmatched error | `Something went wrong. Run proto reset to start fresh, or visit proto.run/help` |

### `proto reset` command

The designer's escape hatch. Does the following silently:
1. Clears Metro cache (`expo start --clear`)
2. Reinstalls node_modules if package.json hash changed
3. Restarts the dev server
4. Prints: `Proto restarted. Scan the QR again.`

### In verbose mode only

`proto start --verbose` shows the raw Metro output for engineers debugging generated code. This flag is never shown in designer-facing documentation.

---

## 13. Custom Dev Client Plan

### What it is
An Expo custom dev client is a React Native app compiled once with your native modules baked in. It looks and behaves like Expo Go but is published as "Proto" on the App Store. Under the hood: Expo infrastructure. On the surface: entirely Proto-branded.

### Why it's required for Phase 2
- Expo Go cannot load `@react-native-community/blur` in its sandbox — required for Liquid Glass
- Expo Go cannot load custom haptic engines
- Expo Go branding breaks the Proto product story
- iOS 26 Liquid Glass uses native UIKit APIs that require a compiled native module

### Build process
1. Add `expo-dev-client` to Proto's template `package.json`
2. Create `eas.json` with a development build profile (hidden in `.proto/`)
3. Configure `app.json` with Proto branding, bundle ID `com.proto.app`, icons
4. Run `eas build --profile development --platform ios` (one-time)
5. Submit to App Store as "Proto" (free app, category: Developer Tools)
6. Submit to Play Store as "Proto" (free app)

### Designer experience stays identical
- `proto start` → QR appears
- Designer opens "Proto" app (not Expo Go) → scans QR → prototype loads
- Everything else identical to Phase 1

### App Store metadata
- **Name:** Proto — Native Prototyping
- **Subtitle:** Design on your device
- **Category:** Developer Tools
- **Description:** Run native prototypes on your phone. Made for designers, not engineers.
- **Screenshots:** Show the QR scan flow, a Liquid Glass prototype, the prompt overlay

### Timeline
- Build + TestFlight: 1 week (engineering time)
- App Store review: ~3 days
- Plan for 2 weeks total from starting the build to public availability

---

## 14. Distribution & GTM

### npm package
- Package: `create-proto` on npm
- Install: `npm create proto@latest`
- Initial publish: Phase 1 complete
- Versioning: semver, `proto update` command to bump

### Open source strategy
- Core runtime and CLI: MIT licensed, public GitHub repo
- `proto.run` share platform: closed source
- Monetisation: `proto.run` Pro plan (more share links, comment layer, version history)

### Launch sequencing
1. **Phase 1 launch** — GitHub repo + npm publish + `proto.run` landing page (waitlist)
   - Launch hook: "The native prototype tool Figma Make can't be"
   - Target: Design Twitter/X, Figma Community, Layers.to
   - Design AI Stack article: Build-in-public launch post

2. **Phase 2 launch** — Proto App on TestFlight + prompt layer
   - Launch hook: "Prompt → native screen on your phone in 7 seconds"
   - Timing: iOS 26 / Liquid Glass release window
   - Target: Product Hunt, design Twitter, WWDC adjacent conversation

3. **Phase 3 launch** — `proto.run` public + share layer
   - Launch hook: "Share your native prototype like a Figma link"

### Design AI Stack connection
Every build decision gets documented as a Design AI Stack article. The flywheel:
- Design AI Stack drives Proto installs
- Proto is the example in every Playbook about AI-assisted prototyping
- Proto's GitHub repo links to Design AI Stack
- Each launch is a newsletter issue

---

## 15. Claude Code Prompts

Use these prompts directly in Claude Code. Each one is scoped to a single buildable unit.

---

### Prompt 1 — Initialise the repo

```
Create a new Node.js monorepo for a CLI tool called "Proto". 

Structure:
packages/
  create-proto/     ← the npm create package (CLI scaffolding)
  proto-cli/        ← the proto start/add/edit commands
  proto-components/ ← the React Native component library
apps/
  proto-app/        ← the Expo custom dev client (Phase 2, stub for now)

Root package.json with workspaces. Use pnpm workspaces.
Each package has its own package.json with correct name fields:
- create-proto
- proto-cli  
- proto-components

Add a root README.md with: project name, one-line description, and 
"npm create proto@latest <name>" as the install command.

Use Node 18+. TypeScript throughout. ESM modules.
```

---

### Prompt 2 — Build the create-proto scaffolding CLI

```
Build the create-proto package. This is what runs when a designer types:
  npm create proto@latest my-app

Requirements:
- Use the `clack` package for terminal UI (prompts, spinners, styled output)
- Ask one question: "What's your prototype called?" (defaults to folder name)
- Copy a /template folder into the target directory
- Run `pnpm install` silently (no output shown, just a spinner)
- Print a QR code to the terminal after install using the `qrcode-terminal` package
  (hardcode a placeholder URL for now: http://localhost:8081)
- Success message: "Proto is ready. Scan the QR to preview on your device."

Never show:
- npm/pnpm output
- File paths
- Error stack traces

Template folder to create (inside create-proto/template/):
- proto.config.js (as shown in the architecture doc below)
- screens/Home.tsx (starter screen)
- assets/ (empty with .gitkeep)
- components/proto/ (empty, will be filled by proto-components package)
- package.json (pre-configured with expo, reanimated, gesture-handler deps)
- .gitignore

proto.config.js:
export default {
  name: "My App",
  theme: "liquidGlass",
  accentColor: "#007AFF",
  screens: { initial: "Home" },
};

Home.tsx:
import { Screen, Stack, Text } from '../components/proto';
export default function Home() {
  return (
    <Screen title="Home">
      <Stack gap={16}>
        <Text size="title">Welcome to Proto</Text>
        <Text size="body" color="secondary">
          Describe what you want to build.
        </Text>
      </Stack>
    </Screen>
  );
}
```

---

### Prompt 3 — Build the Proto component library

```
Build the proto-components package. This is a React Native component library 
used inside Expo prototypes. All components read from a theme context.

Components to build:

1. ThemeProvider + useTheme hook
   - Reads proto.config.js at runtime
   - Returns token set based on theme: "liquidGlass" | "materialYou" | "base"
   - Token types: surface, text, blur, border, radius, space

2. Screen
   - Props: title (string), scrollable (bool, default true)
   - Wraps content in SafeAreaView + optional ScrollView
   - Applies background from theme surface.primary
   - Shows title in navigation header area

3. Stack
   - Props: gap (number), padding (number)
   - Flex column layout

4. Row  
   - Props: gap (number), align ("start"|"center"|"end")
   - Flex row layout

5. Text
   - Props: size ("title"|"headline"|"body"|"caption"|"label"), 
             color ("primary"|"secondary"|"accent"|"destructive")
   - Maps size to fontSize + fontWeight from theme

6. Card
   - Props: glass (bool), padding (number, default 16)
   - If glass=true: use BlurView from @react-native-community/blur
   - Applies theme.radius.card and theme.border.default

7. Button
   - Props: label (string), variant ("primary"|"secondary"|"ghost"|"destructive"), 
             onPress (function)
   - Applies correct colours from theme per variant
   - Uses Pressable with scale animation via reanimated on press

8. Toggle
   - Props: label (string), value (bool), onChange (function)
   - Uses native Switch component styled with theme

9. Divider
   - 1px line, theme.border.default colour, full width

10. Nav
    - Props: tabs ([{ icon: string, label: string, screen: string }])
    - Fixed bottom bar
    - Glass blur background from theme.surface.nav

Include liquidGlass and materialYou token files exactly as specified.

Export everything from a single index.ts.
Use TypeScript. No runtime dependencies beyond Expo SDK packages.
```

---

### Prompt 4 — Build the proto-cli start command

```
Build the `proto start` command in the proto-cli package.

This command:
1. Reads proto.config.js from the current directory
2. Starts an Express server on port 3001 (the prompt server — stub for now, 
   just needs to respond to GET /health with { status: "ok" })
3. Starts Expo Metro server via child_process.spawn("expo", ["start"])
4. Captures Metro stdout/stderr
5. Suppresses all Metro output by default
6. When Metro prints the QR code URL (detect "exp://"), display it 
   with qrcode-terminal in the terminal
7. Print: "Proto running → Scan the QR to preview"

Error translation layer:
Map these Metro stderr patterns to friendly messages:
- /Unable to resolve module/ → "A component couldn't be found. Run: proto reset"
- /SyntaxError/ → "A screen has an error. Run: proto edit <screen-name> 'fix any errors'"
- /EADDRINUSE/ → "Proto is already running. Close the other window first."
- /Network request failed/ → "Can't reach your device. Check you're on the same WiFi."
- anything else → "Something went wrong. Run: proto reset"

Add --verbose flag that passes Metro output through unfiltered.

Use clack for all terminal output.
```

---

### Prompt 5 — Build the proto add command (Phase 2)

```
Build the `proto add` command. This is the core prompt-to-component feature.

Usage: proto add "a settings screen with notification and dark mode toggles"

Steps:
1. Read proto.config.js for theme + accentColor + existing screen names
2. Read components/proto/index.ts to get available component names and props
3. Build a Claude API prompt (see structure below)
4. Call Claude API using @anthropic-ai/sdk
   - Model: claude-sonnet-4-20250514
   - Max tokens: 1000
   - API key from PROTO_API_KEY env variable
5. Extract the JSX code from the response
6. Derive screen name: PascalCase the first noun in the prompt 
   (e.g., "settings screen" → "Settings")
7. Write to screens/<ScreenName>.tsx
8. Print: "Settings screen created → your device is updating"

Claude API system prompt:
"""
You are a React Native screen generator for Proto.
Only use these components (imported from '../components/proto'):
Screen, Stack, Row, Text, Card, Button, Toggle, Divider, Nav, Modal

Rules:
- Output ONLY the JSX code. No explanation, no markdown, no backticks.
- Always start with the import line
- Always export a default function named exactly: {SCREEN_NAME}
- Apply this theme: {THEME}
- Apply this accent colour: {ACCENT_COLOR}
- Use only the listed components. Never use raw React Native components.
"""

User message:
"""
Create a screen called {SCREEN_NAME} that: {DESIGNER_PROMPT}
"""

Error handling:
- If API key missing: "Add your Anthropic API key: export PROTO_API_KEY=your-key"
- If Claude returns invalid JSX: "Couldn't generate that screen. Try describing it 
  differently."
- If file write fails: "Something went wrong saving the screen. Run: proto reset"

Use clack for spinner and output.
```

---

### Prompt 6 — Build the proto new-screen command

```
Build the `proto new-screen` command.

Usage: 
  proto new-screen Profile               ← empty screen
  proto new-screen Profile --template list  ← from template

Templates to support (hardcoded, not files):
- home: Screen with Stack containing a large Text title and two Card components
- list: Screen with a Stack of 5 Toggle components and a Divider between each
- detail: Screen with a Card (glass=true) at top and Text blocks below
- form: Screen with Stack of Text inputs styled as Cards and a primary Button
- modal: A Modal component wrapping a Stack with Text and two Buttons

Steps:
1. Convert name to PascalCase (e.g., "my profile" → "MyProfile")
2. Generate screen file from template or empty scaffold
3. Write to screens/<Name>.tsx
4. Print: "<Name> screen created → it's live on your device"

Empty screen scaffold:
import { Screen, Stack, Text } from '../components/proto';
export default function {NAME}() {
  return (
    <Screen title="{NAME}">
      <Stack gap={16}>
        <Text size="headline">{NAME}</Text>
      </Stack>
    </Screen>
  );
}
```

---

### Prompt 7 — Build the proto reset command

```
Build the `proto reset` command.

This is the designer's escape hatch when something breaks.

Steps (all silent, show only a spinner):
1. Kill any running Metro process on port 8081 (lsof + kill)
2. Kill proto prompt server on port 3001
3. Delete .expo/ cache folder if it exists
4. Delete node_modules/.cache if it exists  
5. Run `expo start --clear` to restart with clean cache
6. Re-display the QR code

Output:
- Spinner: "Resetting Proto..."
- On success: "Proto restarted. Scan the QR again."
- On failure: "Reset failed. Try closing this window and running proto start again."

Never show what commands are being run internally.
Use clack throughout.
```

---

## 16. Open Questions & Risks

### Technical

| Question | Current thinking |
|---|---|
| How does in-app prompt overlay communicate with the local server? | POST to localhost:3001 — works on same WiFi, fails on mobile data. Document the WiFi requirement clearly. |
| Can generated screens import from each other? | Phase 1: No. All screens are standalone. Phase 2: Allow shared components in /components/shared/ |
| How to handle navigation between generated screens? | expo-router handles this automatically via file name in .proto/app/(proto)/. Proto patches the layout file on new screen creation. |
| Windows support? | Metro runs on Windows. create-proto CLI should work. QR terminal rendering may differ — test on Phase 1 release. |
| What if the designer's prompt generates a screen that references a component that doesn't exist? | Claude system prompt constrains to known components. Add validation step: parse imports in generated JSX, reject if unknown import found. |

### Product

| Question | Current thinking |
|---|---|
| Is `PROTO_API_KEY` too engineering-facing for Phase 2? | Yes. Phase 2 needs an onboarding flow: `proto login` that stores the key in keychain. Designer never sees the raw key. |
| Should Proto support Figma import (import a frame as a starting point)? | Not Phase 1 or 2. Potential Phase 3+ feature. Figma's API gives you design data, not a screen — the generation challenge is significant. |
| How do we prevent prompt abuse (someone using `proto add` to generate malicious code)? | Proto runs locally. The generated code is only on the designer's machine. Risk is low for Phase 1. Rate limiting on Claude API via user's own key. |
| What's the path from Proto prototype to production code? | Phase 3: `proto export` outputs clean React Native files with a HANDOFF.md. Engineer opens it, understands the screens, rebuilds in the production codebase. Proto is not a code generator for production. |

### GTM

| Question | Current thinking |
|---|---|
| When is the right moment to announce? | After Phase 1 is stable and tested with 5 non-technical designers. Don't announce until the 90-second install promise is real. |
| Should Proto be a Design AI Stack product or its own brand? | Own brand, with Design AI Stack as the distribution channel. Proto can outlive any single publication. |
| Pricing model for proto.run? | Free: 3 share links, 7-day expiry. Pro ($12/mo): unlimited links, 30-day expiry, comment layer, version history. |

---

## Appendix — Key decisions log

| Decision | Rationale |
|---|---|
| Expo under the hood, not bare RN | Expo's managed workflow means Proto doesn't need to manage native builds. Custom dev client gives us the escape hatch when we need native modules. |
| Full-file rewrite vs diff for prompt edits | Diffs are fragile with LLM output. Full file rewrites are reliable and Metro hot-reloads regardless. The files are small enough that this is never a performance concern. |
| Write to disk vs runtime eval | Runtime JSX eval in React Native requires custom bundler config and is fragile. Disk writes + Metro hot reload is stable, inspectable, and lets engineers read the output at handoff. |
| clack for terminal UI | Most polished terminal UI library available. Used by Vite, Astro, and other tools designers encounter. Familiar output patterns. |
| Own branding in Phase 2, not Phase 1 | App Store review takes time. Phase 1 validation is more important than the app name on the homescreen. Ship fast, rebrand when the product is proven. |
| No Figma import in v1 | The complexity of parsing Figma's API output into a renderable screen is high. The prompt layer is a better investment for designer empowerment at this stage. |
