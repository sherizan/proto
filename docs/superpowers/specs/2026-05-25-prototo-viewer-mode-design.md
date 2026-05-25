# Prototo App Viewer-Mode Handler — Design Spec

> Date: 2026-05-25. Status: design draft.
> Phase 3a sub-unit **E** from `2026-05-24-phase-3-decomposition.md`.
> Consumer of B+C (share-landing page + token routing service, spec at `2026-05-25-proto-share-design.md`'s referenced share-landing spec). Producer-side is D (`proto share` CLI, shipped as `@sherizan/proto-cli@0.3.0`).

## Goal

When a stakeholder taps a `prototo.app/p/<token>` link on iPhone, Prototo App opens directly (no Safari intermediate) and loads the designer's prototype natively via the cloudflared tunnel. Same Prototo App binary serves both creator mode (default landing, scans `proto start` QR) and viewer mode (handles share links). Stakeholder sees the real prototype with real Liquid Glass, real gestures, real haptics — zero Prototo chrome on top.

## Locked decisions

| Decision | Reason |
|---|---|
| **Bundle-loading mechanism**: `Linking.openURL('prototo://expo-development-client/?url=<tunnelUrl>')` | The only documented path. Mirrors how `proto start` works. expo-dev-client picks up the URL at the native layer (before expo-router sees it) and loads the bundle directly. No programmatic `loadApp()` API exists in expo-dev-client. |
| **Universal-link path**: `https://prototo.app/p/<token>` | Already what `proto share` generates and what B's AASA file routes. |
| **Scheme fallback path**: `prototo://p/<token>` | Symmetric — same path as the universal link, just different scheme. Both URL forms map to the same expo-router route `app/p/[token].tsx`. Used for sideload validation before F lands. |
| **Route file**: `app/p/[token].tsx` | expo-router convention. Receives token from `useLocalSearchParams`. |
| **Existing creator-mode UI stays at `app/index.tsx`** | Unchanged. `proto start` QR-scan flow continues to work exactly as today. |
| **New root layout `app/_layout.tsx`** | Required by expo-router to host multiple routes. Renders a `Stack` with `headerShown: false` so both creator and viewer modes are full-screen. |
| **Zero viewer chrome** — prototype takes the full screen | Master-doc promise: "sees the real native prototype." |
| **Three error states**: loading / expired / unreachable | All designer-friendly copy. One-tap "Try again" button on the error states. No stack traces, no internal URLs, no HTTP codes. |
| **AASA fix in sibling repo** | `/Users/sherizan/Public/prototo/public/.well-known/apple-app-site-association` — `appID` updated from `BEJ53HUAE7.com.sherizan.proto` → `BEJ53HUAE7.com.sherizan.prototo`. Pre-rebrand value currently blocks universal-link routing. |
| **Reuse `zod` for share-lookup validation** | Already a runtime dep added to proto-cli. Adding to Prototo App keeps schema definitions parallel + verifiable. |
| **No persistence of viewer mode across launches** | Reopening Prototo after viewing → back to creator-mode landing. Simpler. |
| **Two separate units in `lib/`**: `share-lookup.ts` + `viewer-redirect.ts` | Single-responsibility split: lookup is pure HTTP + zod, redirect is URL construction + Linking call. Both injectable for testing (same pattern as the proto-cli units D shipped). |
| **TDD scope**: TDD-strict for `lib/` units (logic + data); skip TDD for `app/p/[token].tsx` (visual states; validated on device per CLAUDE.md component rule) | Logic is testable; rendered Liquid Glass loading-state isn't. |
| **Cross-repo work**: viewer-mode code in `apps/prototo-app/` (this repo); AASA fix in `/Users/sherizan/Public/prototo/` (sibling website repo) | AASA file lives where it's served. Separate commit / push to the website repo. |

## Out of scope (explicit, deferred)

- TestFlight build pipeline for E
- iPhone-side error states for expo-dev-client's bundle-load failures (the 502 case when the tunnel is dead AFTER our redirect — expo-dev-client owns that error UI; we don't intercept)
- Viewer-mode persistence / "remember last viewed prototype"
- Comment-pin overlay in viewer mode (Phase 3c sub-unit P)
- Token-expiry countdown UI (zero-chrome decision)
- "Recently viewed" history
- Custom domain shares (Phase 3c)
- The not-installed-yet path (App Store install prompt for stakeholders without Prototo) — handled by B's share-landing page when iOS can't resolve the universal link to an installed app

## Architecture

### Flow diagram

```
Stakeholder's iPhone                              prototo.app                       Designer's Mac
─────────────────────────────                     ─────────────────────             ──────────────────
[Camera scans QR or taps link]
  https://prototo.app/p/xk92m
            │
            │ (1) iOS Universal Link routing
            │     (when AASA file resolves + Prototo App installed)
            ▼
        ┌─────────────────────────┐
        │ Prototo App opens at    │
        │ app/p/[token].tsx       │
        │ (zero chrome, loading…) │
        └─────────────────────────┘
            │
            │ (2) GET /api/share/xk92m ────────────►│ Edge runtime
            │                                       │   read KV
            │                              ◄────────│ 200 { tunnelUrl, ... }
            │
            │ (3) Linking.openURL(
            │       'prototo://expo-development-client/?url=' +
            │       encodeURIComponent(tunnelUrl)
            │     )
            │
            │ (4) iOS routes the prototo:// URL back to Prototo App
            │     expo-dev-client picks it up natively (before expo-router)
            │
            │ (5) expo-dev-client fetches the bundle from
            │     <tunnelUrl> via cloudflared ──────────────────────────►│ Metro on :8081
            │                                                              │   serves the JS bundle
            │                                                  ◄───────────│ <bundle response>
            │
            │ (6) Bundle JS replaces the current JS context.
            │     Designer's prototype renders.
            ▼
        ┌─────────────────────────┐
        │ Designer's prototype    │
        │ (Liquid Glass, gestures,│
        │  haptics — fullscreen)  │
        └─────────────────────────┘


Fallback paths handled by THIS spec:
  Token expired or never existed → /api/share/xk92m returns 404 →
    viewer-mode renders expired-token error state with "Try again" button.

  Network failure between iPhone and prototo.app → fetch rejects →
    viewer-mode renders unreachable-tunnel error state with "Try again" button.

Fallback paths NOT in this spec's scope (handled elsewhere):
  Stakeholder has no Prototo App → iOS surfaces "Open in Safari" → prototo.app/p/xk92m page
    renders (State 2/3 of B's share-landing page, App Store CTA when F is live).

  AASA file not yet propagated → iOS opens in Safari → same as above.

  Tunnel is dead (designer Ctrl+C'd) → /api/share/xk92m returns 200 with stale tunnelUrl →
    Linking.openURL succeeds → expo-dev-client fetches bundle → 502 from cloudflared →
    expo-dev-client's own error UI shows. We can't intercept that easily; documented
    as a known limit (Open Risk #2).
```

### File structure inside `apps/prototo-app/`

**New:**

| Path | Responsibility | LOC est. |
|---|---|---|
| `app/_layout.tsx` | Root `Stack` with `headerShown: false`. Hosts both routes. | ~15 |
| `app/p/[token].tsx` | Viewer-mode entry. Reads token from `useLocalSearchParams`. Calls `lookupShare(token)` → on success, calls `redirectToDevClient(tunnelUrl)`. Renders loading / expired / unreachable states. | ~100 |
| `lib/share-lookup.ts` | `lookupShare(token, { fetch }) → { tunnelUrl, designerName, appName }`. Zod-validated fetch wrapper. Throws `ShareLookupError` with `kind: 'expired' \| 'unreachable'`. Injects `fetch` for testability. | ~50 |
| `lib/share-lookup.test.ts` | 4 cases: 200 happy → returns parsed body; 404 → `expired`; 5xx → `unreachable`; fetch reject → `unreachable`. | ~50 |
| `lib/viewer-redirect.ts` | `redirectToDevClient(tunnelUrl, { linking? }) → Promise<void>`. Constructs `prototo://expo-development-client/?url=<encoded tunnelUrl>` and calls `Linking.openURL`. Injects `linking` for testability. | ~25 |
| `lib/viewer-redirect.test.ts` | 3 cases: URL construction correct; encoded tunnel URL; throws if `Linking.openURL` rejects. | ~40 |

**Modified:**

| Path | Change |
|---|---|
| `apps/prototo-app/package.json` | Add `zod@^3.23.8` to deps. Bump version `0.1.0` → `0.2.0` (minor — additive feature). |

**Unchanged (verified):**

| Path | State |
|---|---|
| `app/index.tsx` | Existing creator-mode welcome screen. No edits. |
| `app.json` | Already has `scheme: "prototo"`, `associatedDomains: ["applinks:prototo.app"]`, `MinimumOSVersion: "26.0"`. Verified during D's work. |
| `eas.json` | No changes; build/submit profiles already wired. |

### File structure inside `/Users/sherizan/Public/prototo/` (sibling website repo)

| Path | Change |
|---|---|
| `public/.well-known/apple-app-site-association` | `appID` from `BEJ53HUAE7.com.sherizan.proto` → `BEJ53HUAE7.com.sherizan.prototo`. One-line JSON edit. Vercel auto-deploys on push. |

That's the only change in the website repo. Page rendering (B's State 2 with App Store CTA when no app installed) already works.

### Lifecycle inside `app/p/[token].tsx`

```
mount
  │
  ▼
read token from useLocalSearchParams()
  │
  ▼
useEffect: async
  ├─ fetch /api/share/<token>
  │     - 200 → got tunnelUrl
  │     - 404 → setError('expired')
  │     - other → setError('unreachable')
  │     - throw → setError('unreachable')
  │
  ├─ if success:
  │     - construct prototo://expo-development-client/?url=<encoded tunnelUrl>
  │     - Linking.openURL(devClientUrl)
  │     - (after this, the JS context will be replaced by the loaded bundle — render state doesn't matter)
  │
  ▼
render based on state:
  loading      → centered "Loading [Designer]'s prototype…" with a small Liquid Glass card
  error expired → centered "This share link expired. Ask the designer for a new one." + "Try again" (refetches)
  error unreachable → centered "Can't reach the designer's Mac. They may have stopped sharing." + "Try again"
```

### Why we don't use expo-router's automatic Linking for the dev-client redirect

`expo-router` listens for incoming URLs and routes them via path-matching. When Prototo App receives `prototo://expo-development-client/?url=...` (the redirect E issues), expo-router would naively try to map that to `app/expo-development-client.tsx` — which doesn't exist. The good news: expo-dev-client intercepts that exact URL pattern at the native iOS layer, BEFORE JS, and handles it directly. So expo-router never sees it. Same mechanism as `proto start` → QR scan.

### Why an in-app retry button instead of pull-to-reload

The token may have been valid moments ago but the tunnel just died. "Try again" re-fetches `/api/share/<token>` — if the designer restarted `proto share`, they got a new token (so the old link 404s and the stakeholder needs a new link entirely). If the tunnel is briefly flaky, the retry might succeed. Either way: refresh-from-the-app surfaces the right state without making the stakeholder go back-and-tap-again.

## Definition of done

- [ ] `app/_layout.tsx` exists, renders a `Stack` with `headerShown: false` for all routes
- [ ] `app/p/[token].tsx` exists, reads `token` from URL params, kicks off lookup + redirect on mount
- [ ] `lib/share-lookup.ts` exports `lookupShare(token, { fetch }) → { tunnelUrl, designerName, appName }` with zod validation + designer-friendly error kinds (`expired`, `unreachable`)
- [ ] `lib/share-lookup.test.ts` covers happy + 404 + 5xx + network paths
- [ ] `lib/viewer-redirect.ts` exports `redirectToDevClient(tunnelUrl, { linking })` that constructs `prototo://expo-development-client/?url=<encoded>` and calls `Linking.openURL`
- [ ] `lib/viewer-redirect.test.ts` covers URL construction + encoding + Linking.openURL rejection
- [ ] `apps/prototo-app/package.json` version bumped `0.1.0` → `0.2.0`; `zod@^3.23.8` added to deps
- [ ] `pnpm --filter prototo-app test` passes (new tests + any existing ones)
- [ ] `pnpm --filter prototo-app exec tsc -p tsconfig.json --noEmit` exits 0
- [ ] `eas build --platform ios --profile development` produces a fresh binary that includes the new routes
- [ ] Sideloaded build on Sheri's iPhone (UDID-registered, same as Task 13 of the dev-client work)
- [ ] **Scheme path validated** (always works on sideloaded build): from a running `proto share`, manually paste `prototo://p/<token>` into iMessage (to yourself) and tap it → confirm Prototo opens directly and the prototype renders
- [ ] **Manual viewer flow ergonomics**: loading state renders briefly; on a deliberately killed `proto share` (Ctrl+C before opening on iPhone), the unreachable error state renders cleanly
- [ ] **AASA file** in `/Users/sherizan/Public/prototo/` updated to `BEJ53HUAE7.com.sherizan.prototo`, committed, pushed; Vercel deploys; `curl -fsSL https://prototo.app/.well-known/apple-app-site-association` confirms the new appID
- [ ] **Universal-link path validated** *(deferred until F lands and Prototo is App-Store-installed)*: with a fresh App-Store install of Prototo, paste `https://prototo.app/p/<token>` in iMessage, tap it → Prototo opens directly without Safari intermediate. Until F lands, this DoD item stays unchecked with a "deferred" annotation, like D's iPhone-bundle-load item.
- [ ] Implementation footnotes section in this spec updated with E's commits if the build surfaces any deviations from this design

## Open risks

1. **Universal-link propagation lag.** After updating the AASA file and installing Prototo via TestFlight/App Store, iOS may cache the previous AASA for up to 24h. **Mitigation:** scheme path remains functional in the meantime. Universal-link path "starts working within 24h of F approval + AASA push." Tracked in `docs/RISKS.md`.

2. **expo-dev-client's bundle-load error UI is owned by Expo, not us.** If the tunnel returns 502 after our redirect, the stakeholder sees Expo's default error screen — not our designer-friendly copy. **Mitigation:** acceptable for Phase 3a; B's share-landing page is the primary surface for stakeholders who can't connect. Tracked in `docs/RISKS.md`.

3. **`Linking.openURL('prototo://expo-development-client/?url=...')` is technically opening the same app via a URL.** iOS may show a brief "Open in Prototo?" confirmation depending on iOS version + user settings. **Mitigation:** on iOS 26, same-app redirects appear to be silent based on D's testing. Document; revisit if real users hit the confirmation prompt.

4. **Sideload-installed Prototo with `associatedDomains`** may still not route universal links because Apple's swcutil only validates AASA for App-Store-signed binaries with universal links fully provisioned. **Mitigation:** Use scheme path for sideload validation. Universal links become fully functional only once F lands. Already an accepted risk in `docs/RISKS.md` (SH-03).

5. **Token race**: stakeholder taps a link 10 seconds after designer Ctrl+C's their `proto share`. The KV record is still alive (7-day TTL), but the tunnel URL is dead. Our `share-lookup` returns 200 with a stale tunnel URL → redirect succeeds → expo-dev-client tries to fetch the bundle → 502 → Expo error UI. **Mitigation:** documented above. Phase 3b hosted-snapshots fix this entirely.

6. **Linking.openURL re-entrant routing**: after the redirect, expo-router doesn't see the URL (expo-dev-client intercepts first at the native layer). But if expo-dev-client's interception breaks in a future major version, expo-router would try to navigate to `app/expo-development-client.tsx` and fail loudly. **Mitigation:** Will only manifest if expo-dev-client's interception breaks (e.g., in a future major). Accept the risk; add a fallback `app/expo-development-client.tsx` later if needed.

7. **AASA file's `paths` glob** is currently `["/p/*"]` which matches `/p/xk92m` but NOT `/p/xk92m/` (trailing slash) or `/p/xk92m?utm=...` (query params). **Mitigation:** Verify with `curl` after deploy + adjust the glob if needed. Likely fine — current QR format doesn't add trailing slash or query.

## Build sequence (for the implementation plan)

1. `lib/share-lookup.ts` + tests — pure HTTP + zod, easiest to unit-test first
2. `lib/viewer-redirect.ts` + tests — pure URL construction + Linking call
3. `app/_layout.tsx` — root layout
4. `app/p/[token].tsx` — viewer entry, ties the two units together + renders the 3 states
5. `apps/prototo-app/package.json` — version bump + zod dep
6. `pnpm install` + tests + typecheck
7. AASA fix in `/Users/sherizan/Public/prototo/` — commit, push, verify with `curl`
8. `eas build --platform ios --profile development` — fresh Prototo App binary
9. Sideload on test iPhone via EAS install URL
10. End-to-end validation: scheme path first (universal-link path waits for F)
11. Commit + push as a feature branch, PR-review, merge
12. Update `docs/RISKS.md` with new entries (universal-link AASA cache, expo-dev-client error UI ownership, token race)
13. Bump Prototo App display version after E ships if there's an App Store build in flight

Estimated effort: **1–2 days** with focused work. The orchestration is small; most of the time goes to the EAS build cycle + on-device validation.
