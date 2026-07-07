# Viewer home redesign: recipient-first, one adaptive screen

**Date:** 2026-07-07 · **Status:** approved by Sheri (visual companion session)
**Scope:** `apps/prototo-app` only. Ships in the next App Store build after 1.0.2.

## Why

Two audiences use the App Store viewer: creators (well served) and stakeholders
(underserved: "Mine" is permanently empty for them, the sample prototype was
App-Review scaffolding, and the QR scanner has no UI entry point at all —
`SHOW_CONNECT_CARD` is false while docs.prototo.app tells people to "tap
Scan"). Direction set by Sheri: 1-2 actions done extremely well, no noise,
unconventional UI welcome. This absorbs three backlog items: sample removal,
scanner return, home rethink.

## Design decisions (from the brainstorm)

1. **Audience handling: infer from state.** One adaptive home; nobody picks a
   persona. Creator content appears only when the account has published shares.
2. **Hero action placement: thumb zone.** Bottom bar = tabs pill on the LEFT
   (Prototypes / Account), pink circular scan button ALONE on the bottom right.
   No hero buttons at the top of the screen.
3. **"Open a link" lives inside the scanner** (option 2 + refinement): the scan
   button is the single "get me in" portal. The scanner shows a clipboard
   banner when a Prototo link is detected; no separate paste button anywhere.
4. **App-open clipboard detection**: opening/foregrounding the app with a
   Prototo link copied prompts "Open <name>?" directly.
5. **Recents show owned prototypes too**, badged "Yours" (today's code filters
   them out of history).

## The screen

### Home (`app/home/index.tsx`, replacing the Mine/Shared layout)

- **Header**: Lottie logo (existing asset), app title treatment as today.
- **Body — "Recently viewed"**: cards from `open-history` (existing lib),
  newest first: prototype name, `Opened <relative time>`, `by <designer>`
  (designer name needs storing in history — see Data), and a small accent
  **"Yours"** badge when `useMyShares` contains the token. Tap → existing
  `/p/<token>` route (re-fetches, handles expiry with the existing error UI).
- **Body — "Yours" section** (creators only): rendered ABOVE recents when
  `useMyShares` is non-empty: name + `link live N more days` / `Expired ·
  shared <relative>` caption (data already available). Tap → `/p/<token>`.
- Shares but no history: "Yours" renders alone; the recents section is simply
  omitted (no empty recents placeholder).
- **Empty state** (no history, no shares): single dashed-border card:
  "Prototypes people share with you will appear here." + "Tap scan to open
  your first." Nothing else. **No sample prototype** (delete `lib/sample.ts`
  usage; keep the file removal clean).
- **Bottom bar**: custom, replaces the native tab bar: `app/home/_layout.tsx`
  drops the native tabs in favor of a shared custom bar component that
  navigates between the two existing routes (`home/index`, `home/profile`) —
  left pill with Prototypes / Account (Account keeps its existing screen),
  right circular scan FAB (accent bg, camera glyph) → `/connect`.
  Safe-area aware; matches the mock (`.p-tabs` + `.p-fab` composition).

### Scanner (`app/connect.tsx`, restyled not rewritten)

- Keep: camera permission flow, `CameraView`, existing QR handling
  (`parseShareLink` → `/p/<token>`; `parseConnectUrl` LAN guard → Metro load;
  DC-11 security posture unchanged).
- Add a bottom slot inside the scanner:
  - Clipboard has a Prototo link (`parseShareLink` passes) → white banner:
    "Link on your clipboard" + accent button "Open <appName>" (name via
    `fetchShare`, fallback label "Open link"). Tap → `/p/<token>`.
  - Otherwise → quiet hint text: "Copy a Prototo link and it appears here."
- Clipboard is only READ after `Clipboard.hasUrlAsync()` says a URL exists
  (avoids the iOS paste toast on every open; the toast on actual read is
  acceptable and truthful).

### App-open clipboard prompt (new, `components/ClipboardPrompt.tsx` mounted in `app/home/_layout.tsx`)

- On mount and on AppState active transitions: `hasUrlAsync()` → if true,
  `getStringAsync()` → `parseShareLink()` → if token: resolve name via
  `fetchShare` (silent fail = generic copy) and show a dialog: title
  "Open <name>?", body "You copied a Prototo link", actions Not now / Open.
- "Not now" remembers that token (in-memory + AsyncStorage key) so the same
  link never re-prompts; a NEW link prompts again.
- Suppressed while a prototype is mounted (shell isn't visible then anyway)
  and on the `/p/*` screen for the same token.

## Data

- `lib/open-history.ts`: `recordOpen` gains `designerName` (already available
  at the call site in `app/p/[token].tsx` from `fetchShare`). Old entries
  without it render without the "by <name>" line. Cap/ordering unchanged.
- No backend changes. No new endpoints.

## Out of scope (stays on the roadmap)

Comments on prototypes, viewing gestures, floating-overlay hide toggle,
Account screen changes, any website work.

## Testing / verification

- Unit: history record shape (designerName optional), clipboard-prompt token
  parsing + remember-decline logic, owned-badge derivation (token ∈ myShares).
- On-sim (`scripts/sim-e2e.sh` still green — routes unchanged) plus manual:
  - Fresh signed-in account → empty state renders, scan FAB opens camera.
  - Open a share → appears in recents; owned share shows the Yours badge
    (inject the owner session).
  - Copy a share link → open app → prompt appears; Not now → no re-prompt;
    copy a different link → prompts again.
  - Scanner: with link on clipboard → banner with name; without → hint.
  - Creator account (has shares) → "Yours" section above recents.
- Release gate: `docs/RELEASE-CHECKLIST.md` applies to the store cut.
