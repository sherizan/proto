# Proto

```
██████╗ ██████╗  ██████╗ ████████╗ ██████╗
██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔═══██╗
██████╔╝██████╔╝██║   ██║   ██║   ██║   ██║
██╔═══╝ ██╔══██╗██║   ██║   ██║   ██║   ██║
██║     ██║  ██║╚██████╔╝   ██║   ╚██████╔╝
╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝
```

**The prompt-native design environment for native iOS.**

Designers describe what they want; native iOS UI appears in the Simulator, with Apple's real Liquid Glass on iOS 26+. No canvas. No IDE. No engineering.

[![create-proto on npm](https://img.shields.io/npm/v/create-proto?label=create-proto)](https://www.npmjs.com/package/create-proto)
[![@sherizan/proto-cli on npm](https://img.shields.io/npm/v/@sherizan/proto-cli?label=%40sherizan%2Fproto-cli)](https://www.npmjs.com/package/@sherizan/proto-cli)
[![License MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Quick start

```bash
npm create proto@latest myapp
```

That's it. The iOS Simulator opens with a Welcome screen. In another terminal:

```bash
cd myapp && claude
```

Then describe what you want. Example:

```
> add a liquid glass bottom tab bar with Home, Explore, Library, Profile tabs
```

Claude Code generates `app/_layout.tsx` using Apple's native `UITabBar` (via `expo-router/unstable-native-tabs`). Metro hot-reloads. The Simulator updates instantly with a real refractive Liquid Glass tab bar and SF Symbol icons — no engineering needed.

## Prerequisites

| What | Why |
|---|---|
| **Xcode** (with iOS Simulator) | The iOS Simulator IS the canvas. Required to render your prototype. Install via the Mac App Store (large download — give it time). Run it once and accept the license before using Proto. |
| **macOS** | Xcode runs only on Mac. Windows / Linux not supported for Phase 2. |
| **Node.js 18+** | Runtime for Proto's CLI. Install via [nodejs.org](https://nodejs.org) or your package manager. |
| **Claude Code** | The design tool. Install with `npm i -g @anthropic-ai/claude-cli` and authenticate before using. |

iOS Simulator with **iOS 26+** is recommended — that's where Apple's native Liquid Glass material renders. Older iOS versions fall back to standard blur effects (still nice, just not the new material).

## The designer flow

```
┌──────────────────────────────────────────────────────────────────┐
│ Terminal 1 — Proto                                               │
│                                                                  │
│  $ npm create proto@latest myapp                                 │
│     [ASCII banner, scaffolding, install]                         │
│     [iOS Simulator launches → Welcome screen appears]            │
│                                                                  │
│  Open another terminal and run:                                  │
│    cd myapp && claude                                            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Terminal 2 — Claude Code                                         │
│                                                                  │
│  $ claude                                                        │
│  > add a settings screen with a dark mode toggle                 │
│                                                                  │
│  [Claude reads CLAUDE.md + DESIGN.md, writes screens/Settings.tsx│
│   and app/settings.tsx, Metro hot-reloads]                       │
└──────────────────────────────────────────────────────────────────┘

         ┌────────────────────────────────┐
         │  iOS Simulator (the canvas)    │
         │  Welcome screen → Settings     │
         │  Liquid Glass renders live     │
         └────────────────────────────────┘
```

The designer never touches a file. Every change is a prompt.

## What's in the box

When `create-proto` scaffolds your project, you get:

- **`DESIGN.md`** — your design system source of truth. Tokens (color, spacing, typography, radius), component library choice, and screen registry. Update it by prompting Claude.
- **`CLAUDE.md`** — instructions for Claude Code, scoped to this project. Tells Claude to prefer Apple's native components (UITabBar, SF Symbols, `@expo/ui`, GlassView) over wrappers. Includes the Proto component library reference.
- **`components/proto/`** — fallback primitives for things native iOS doesn't ship: layout helpers (`Screen`, `Stack`, `Row`), themed text, generic `Card` with Liquid Glass support, animated `Button`, `Toggle`, `Modal`, `Divider`. Read-only, managed by Proto.
- **`screens/Home.tsx`** — Welcome screen with a Liquid Glass hero card and instructions, designed to be the first thing the designer sees on device.
- **`app/`** — expo-router routing layer. Thin re-exports of `screens/`.
- **`proto.config.js`** — the only file designers may edit directly (theme, accent, app name, layout, motion preferences).
- Pre-configured for Expo SDK 55 with `expo-glass-effect`, `expo-blur`, `react-native-reanimated 4`, `react-native-worklets`, `@expo/ui`, `react-native-gesture-handler`.

## Commands

After install, inside your project:

```bash
npx proto start         # Boot Metro + open Simulator
npx proto new-screen    # Scaffold a new screen
npx proto reset         # Clear Metro + project caches
npx proto design        # Interactive: theme + accent + component library
npx proto help          # Show all commands
```

Designers typically only use `npx proto start` — everything else happens via Claude Code prompts.

## How it works

```
You ──prompt──► Claude Code
                    │
                    ▼ writes files
                screens/X.tsx + app/x.tsx
                    │
                    ▼ Metro detects change
                Hot reload
                    │
                    ▼ JS bundles
                iOS Simulator updates
                    │
                    ▼ renders
                Native iOS UI + Liquid Glass
```

Three principles drive the architecture:

1. **The iOS Simulator is the canvas.** Every change a designer makes appears in the Simulator within milliseconds via Metro hot reload. No build step, no preview render.
2. **Apple-native first.** Proto's `CLAUDE.md` tells Claude to use Apple's native components (UITabBar via `expo-router/unstable-native-tabs`, SF Symbols via `expo-symbols`, SwiftUI primitives via `@expo/ui/swift-ui`, Liquid Glass via `expo-glass-effect`) before any wrapper. This gets you real iOS fidelity for free.
3. **Designers never touch code.** All interaction is prompts in Claude Code. The CLI takes a single command (`proto start`) and does the right thing.

## Roadmap

| Phase | Status | What |
|---|---|---|
| Phase 1 — Scaffolding + preview | ✅ Shipped | `create-proto` scaffolds a project, `proto start` runs Metro + Simulator |
| Phase 2 — Prompt layer | ✅ Shipped | `CLAUDE.md` + `DESIGN.md` template, `proto design` interactive command, native-first component library |
| Phase 2.5 — Simulator-as-canvas MVP | ✅ Shipped | Auto-launch Simulator, ASCII banner, Expo Go auto-clean on SDK mismatch, drop custom `Nav` for native UITabBar |
| Phase 3 — Proto App (physical device) | 🚧 Scaffolded | Custom Expo dev client published as "Proto" for real-device Liquid Glass via QR. Built via EAS Build. Deferred until Phase 2.5 stabilizes. |
| Phase 3 — Web share (`proto.run`) | 📋 Planned | Share a QR code to a stakeholder, they run the prototype on their phone via the web companion. |

## Repo layout

```
.
├── apps/
│   └── proto-app/              Phase 3: custom dev client (deferred)
├── packages/
│   ├── create-proto/           npm `create-proto` — the scaffold CLI
│   ├── proto-cli/              `proto` command — Metro + Simulator wrapper
│   └── proto-components/       fallback component library (Card, Button, etc.)
└── docs/
    ├── proto-master.md         canonical product spec
    └── superpowers/
        ├── specs/              design docs
        └── plans/              implementation plans
```

## Packages

- [`create-proto`](https://www.npmjs.com/package/create-proto) — the `npm create proto@latest` entry point
- [`@sherizan/proto-cli`](https://www.npmjs.com/package/@sherizan/proto-cli) — the `proto` command inside scaffolded projects

## Contributing

This is an early-stage personal project. Issues and PRs welcome but unpredictable response time. See [`docs/proto-master.md`](docs/proto-master.md) for the product spec before proposing significant changes.

## License

[MIT](LICENSE) © 2026 Sherizan Sheikh
