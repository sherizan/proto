# Onboarding Redesign — Design Spec

> Status: design locked, plan pending. Date: 2026-05-22.
> Sibling spec: Proto App custom dev client (parallel work, separate document).

## Goal

A designer goes from "I want to try this" to "my prototype is on my phone" in **one command, under 90 seconds, with zero engineer-coded copy**.

## The friction we're removing

From the validation session of 2026-05-21:

1. **Interactive prompt during scaffold.** Today's `create-proto` asks "What is your prototype called?" via clack. Designers don't want a question — they want speed.
2. **Two commands separated by `cd`.** Today: `npm create proto@latest myapp` then `cd myapp && proto start`. Two commands feels like two products.
3. **Expo Go arrives as a stranger.** Today: no mention of Expo Go anywhere until the designer realises they need an app to scan the QR. "Why am I being told to download a random app?" reads suss.
4. **No first-pixel narrative.** Today's spinner shows "Installing" with no sense of time, no progress, no "you're almost there".
5. **Welcome screen is flat.** Today: a card with "Welcome to Proto / Describe what you want to build." No celebration, no clear "you did it", no live-reload promise.
6. **Component library prompt in initial scaffold.** Not actually present today — but worth locking as a decision: it stays absent. Library choice belongs in `proto design` after the designer feels Proto working, not before.

## Decisions log

| Decision | Why |
|---|---|
| Onboarding ships first, Proto App ships right after | Two clean shippable units. Onboarding doesn't gate on App Store / TestFlight work. |
| Preview surface for v1: Expo Go, reframed as "${BRAND} Preview" in all copy | No new app to build, no App Store dependency. Trust problem is mostly a copy problem in v1. |
| One command (`npm create proto@latest myapp`) auto-starts Metro | Designer never types a second command for the first preview. |
| Zero interactive prompts during scaffold | Folder arg → name. If no arg, default to `my-prototype`. Never block on clack input. |
| Component library choice deferred to `proto design` | Initial scaffold uses Proto built-ins. Library variation is later, once the designer has reason to vary. |
| Welcome screen uses only existing Proto components | `Screen`, `Stack`, `Card` (glass + plain), `Text`, `Divider`. No new primitives. |
| Brand placeholder `${BRAND}` throughout | "Proto" may rename. Sed-replace at ship time once the name is final. |

## Section 1 — Shape

```
$ npm create proto@latest myapp
           │
           ▼
   Install + auto-start
           │
           ▼
   ┌────────────────────────────────┐
   │ Step 1 — Install Proto Preview │
   │ (one-time, scan App Store QR)  │
   └────────────────────────────────┘
           │
           ▼
   ┌────────────────────────────────┐
   │ Step 2 — Scan project QR       │
   │ in Proto Preview               │
   └────────────────────────────────┘
           │
           ▼
   Welcome screen renders. Next-step
   CTA shows the Claude prompt to run.
```

One command in, one screen out. The designer never edits a file, never `cd`s, never picks a library.

## Section 2 — Terminal output

```
$ npm create proto@latest myapp

▗ ▗ ▗   ${BRAND} v0.1.0
 ▗ ▗    Liquid Glass · iOS preview
▗ ▗ ▗   /private/tmp/myapp

●  Setting up myapp...
●  Installed in 47s

   Step 1 — Install ${BRAND} Preview (one-time)

   ┌─────────────────────────┐
   │   ▄▄▄▄▄ █ ▄  ▄ ▄▄▄▄▄    │
   │   █ ▄ █ ▀ ▄▀▀ █ ▄ █     │
   │   █▄▄▄█ █▄▀█▄ █▄▄▄█     │   App Store QR
   │   ▄▄▄▄▄▄▄ █▄█ ▄▄▄▄▄▄    │
   │   ▀▄▀█  ▀▀▀ █▀▄█  ▀█    │
   └─────────────────────────┘

   Open Camera on your phone, scan to install ${BRAND} Preview.
   It's published as Expo Go by Expo — the framework ${BRAND}
   runs on. Already installed? Skip to Step 2.

   Step 2 — Open your prototype

   ┌─────────────────────────┐
   │   ▄▄▄▄▄ █ ▄▄  █ ▄▄▄▄▄   │
   │   █ ▄ █ ▀▀█▀█ █ ▄ █     │
   │   █▄▄▄█ █▄▀ ▄ █▄▄▄█     │   Project QR (exp://...)
   │   ▄▄▄▄▄▄▄ █▄█ ▄▄▄▄▄▄    │
   │   █▀▀█▄▄▀▄▄ ▀▄▀█  ▀▀    │
   └─────────────────────────┘

   Open ${BRAND} Preview, scan. Loading takes 10–30s the first time.

   Next, in another terminal:
   → cd myapp
   → claude
   → Add liquid glass bottom toolbar with placeholder screens

Metro running. Press Ctrl+C to stop.
```

**Header bar** is fixed three lines, matches Claude Code's style: mark + tool/version, mark + theme/target, mark + cwd. Reads version from package.json, theme from `proto.config.js`.

**Step copy** never says "Expo Go" in the lead — only in the absorbing parenthetical. Reframes the App Store install as Proto's own dependency, not an outside ask.

**Footer** says "Metro running" not "Proto is ready" — emphasises the terminal is now a long-running process.

## Section 3 — Welcome screen on the phone

```
┌─────────────────────────────────┐
│                                 │
│  ${BRAND}                        │
│                                 │
│  ┌───────────────────────────┐  │
│  │   (glass blur surface)    │  │
│  │                           │  │
│  │   You're in.              │  │
│  │                           │  │
│  │   Every change you make   │  │
│  │   appears here instantly  │  │
│  │   — no refresh, no        │  │
│  │   waiting.                │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  Next                           │
│                                 │
│  Open a new terminal and run    │
│                                 │
│   ┌───────────────────────┐    │
│   │  claude               │    │
│   └───────────────────────┘    │
│                                 │
│  Then describe what you want    │
│                                 │
│   ┌───────────────────────┐    │
│   │  Add liquid glass     │    │
│   │  bottom toolbar with  │    │
│   │  placeholder screens  │    │
│   └───────────────────────┘    │
│                                 │
│  ─────────────                  │
│                                 │
│  ${BRAND} reads DESIGN.md        │
│  before every change.           │
│                                 │
└─────────────────────────────────┘
```

**Copy rules:**

- "You're in." — past-tense success, not "Welcome" (passive) or "It works" (apologetic).
- Hero sub-copy never mentions files, paths, or refreshing. The designer's mental model: change → appears. The next-step card supplies the *how*.
- "Every change you make appears here instantly — no refresh, no waiting." — the line that lands the magic.
- Two command cards: `claude`, then the prompt. Each card visually distinct so the designer parses "this is something to type", not "this is body text".
- Footer caption plants the DESIGN.md mental model: "${BRAND} reads DESIGN.md before every change." Not a tutorial — a one-line proof that the system is doing something coherent.

**Animation:** Hero card fades up 600ms on mount with ease-out, using Reanimated 4's `useSharedValue` + `withTiming` (same pattern as Phase 1's `Button.tsx` press animation). Translate-Y from 12px → 0 with opacity 0 → 1. Only the hero animates; the rest is static. No confetti, no checkmarks, no theme-specific celebration.

**Components used:** `Screen`, `Stack`, `Card` (glass for hero, plain for command cards), `Text` (title / headline / body / caption sizes; primary / secondary / accent colors), `Divider`. All exist in `packages/proto-components` already.

## Section 4 — Implementation shape

### File changes

| File | Change |
|---|---|
| `packages/create-proto/src/cli.ts` | Drop the interactive `text()` name prompt. Name = folder arg, default `my-prototype` if missing. After install completes, spawn `proto start` in the new project's directory (via `child_process.spawn` with inherited stdio) before exiting. |
| `packages/create-proto/src/messages.ts` | New copy: install narrative with live-elapsed integer seconds (`Installed in 47s`, computed as `Math.round((Date.now() - startMs) / 1000)`), step-numbered output, "${BRAND} Preview" branding throughout. Remove the prompt question. |
| `packages/proto-cli/src/commands/start.ts` | Rewrite terminal output to the Section 2 mockup: header bar, Step 1 with App Store QR + reframed copy, Step 2 with project QR, next-step block, footer. |
| `packages/proto-cli/src/header.ts` | **New file.** Pure renderer for the 3-line header (Option D mark + version + theme + cwd). Reads version from `package.json`, theme from `proto.config.js`. Snapshot-tested. |
| `packages/proto-cli/src/render-qr.ts` | Extend with App Store URL QR path. Keep the project-QR path. |
| `packages/create-proto/template/screens/Home.tsx` | Rewrite to Section 3 design: hero glass card with "You're in." + Reanimated fade-up; sub-copy mentions instant updates; the two command cards (`claude` and the liquid-glass-toolbar prompt); caption footer. |
| `docs/proto-master.md` | Update Welcome screen example (§10) to match new Home.tsx. |

### Edge cases handled

- **Folder arg missing.** Default name = `my-prototype`. Print "Using name: my-prototype (pass a name as the first argument to override)."
- **Folder already exists.** Error: "That folder exists. Pick a different name: `npm create proto@latest <name>`." No clack input — the error message is the recovery instruction.
- **`pnpm install` fails.** Existing translation in `install-deps.ts` handles network / permission / disk-space. On failure, do NOT auto-start Metro. Recovery hint: "Try `cd <folder> && pnpm install && proto start` once your environment is ready."
- **Port 8081 in use during auto-start.** Already handled — `proto start` auto-kills (commit `e146611`). Keep that. Surface the existing "Stopped a previous Proto session" log.
- **Ctrl+C during install.** Clean up the half-scaffolded folder; print "Cancelled. Folder removed."
- **Ctrl+C during Metro.** Clean exit (existing behaviour).
- **Phone can't reach App Store.** Not our problem to solve. The App Store QR is rendered locally from a static URL — no network needed at render time.

### Out of scope

- **Proto App custom dev client.** Separate spec, parallel timeline. This spec assumes Expo Go (reframed). When Proto App lands, only the App Store QR + branding copy changes — the rest of this redesign holds.
- **Renaming.** `${BRAND}` placeholder. Sed-replace at ship time.
- **iOS Simulator support.** Power-user fallback via future `proto start --simulator` flag. Not in this spec.
- **Per-theme welcome screen variants.** Same screen, same copy across all three themes — the theme tokens are the only differentiator.
- **Telemetry / install-funnel analytics.** No data collection in v1.
- **Onboarding to Claude Code.** Proto onboards Proto. If the designer doesn't have `claude` installed, that's Claude Code's onboarding problem. We can optionally add a one-line "Don't have Claude Code? `npm i -g @anthropic-ai/claude-cli`" but I'd hold the line.
- **Windows support.** Phase 2 was macOS-first; no change.

### Testing

- **`header.ts`** — snapshot test for the 3-line output given mocked package.json + proto.config.js. Cover all three themes (Liquid Glass / Material You / Base) for the second-line copy.
- **`messages.ts`** — string tests for new keys, including the `Installed in ${n}s` format.
- **`create-proto/cli.ts`** — keep existing tests; add (1) "no folder arg → uses my-prototype default", (2) "folder arg used directly without prompt", (3) "auto-start spawns proto start in the new project's directory".
- **`render-qr.ts`** — extend with App Store URL case. Both QRs render distinct ASCII output for distinct inputs.
- **Welcome screen `Home.tsx`** — no unit test. RN components validated on device, not in vitest (matches Phase 1 pattern).
- **End-to-end smoke** — scaffold a fresh project headlessly (call `copyTemplate` directly), boot Metro, verify both QRs are emitted in stdout, verify Home.tsx has the new copy. Same shape as Phase 2's Task 8.

## What this spec does not change

- All Phase 1 + Phase 2 commands (`proto new-screen`, `proto reset`, `proto design`) keep their current behaviour.
- The Proto component library is unchanged — Welcome screen uses only existing primitives.
- Token files (`liquidGlass`, `materialYou`) are unchanged.
- `app.config.js`, `babel.config.js`, `metro.config.js`, `proto.config.js`, `.npmrc` at project root: unchanged (all confirmed working in the 2026-05-21 device validation).

## Definition of done

- A fresh `npm create proto@latest myapp` invocation:
  - Takes ≤ 90 seconds from command issued to "Welcome screen visible on a real phone via Expo Go" on a warm network.
  - Requires zero typed input from the designer after the initial command.
  - Produces terminal output matching Section 2 byte-for-byte (with `${BRAND}` resolved and live values substituted).
  - Renders the Welcome screen matching Section 3 on first scan.
- Phase 1 + Phase 2 tests still pass.
- New tests in Section 4 pass.
- End-to-end smoke (scaffold → install → Metro boot → both QRs emitted → Home.tsx has new copy) passes on a clean tmpdir.
