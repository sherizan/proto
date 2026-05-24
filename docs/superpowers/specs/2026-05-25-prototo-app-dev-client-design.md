# Prototo App — Custom Dev Client Spec (refined)

> Date: 2026-05-25. Status: design draft.
> Supersedes `2026-05-22-proto-app-dev-client-design.md`.
> Related: `2026-05-22-onboarding-redesign-design.md` (two-QR Step-1/Step-2 model is replaced by the single-QR model in this spec); `2026-05-24-share-landing-and-token-router-design.md` (universal-link entitlement declared here, viewer-mode handler lives there); `2026-05-24-phase-3-decomposition.md` (sub-unit F — App Store submission — gates designer rollout).

## Goal

A custom Expo dev client — published as **Prototo** — that designers install once from the App Store and that becomes the canvas for `proto start`. It renders real Apple Liquid Glass on iOS 26 devices and serves as both creator-mode dev client (Phase 2/3) and viewer-mode share runtime (Phase 3 share-landing spec).

A designer scans one QR from `proto start`, Prototo opens, the prototype loads with real Liquid Glass. No Expo Go anywhere in the flow.

## Why this refinement supersedes the 2026-05-22 spec

Three things changed between 2026-05-22 and 2026-05-25:

1. **Brand rename.** Product is now "Prototo" (commit `f750aec`), domain `prototo.app`. Old spec's `Proto` / `com.sherizan.proto` / `proto://` strings are stale.
2. **Onboarding collapsed to one QR.** The 2026-05-22 onboarding spec's two-QR model (Step 1 install Proto Preview, Step 2 scan project) was simplified to a single QR emitted by Metro. The dev-client spec needs to match.
3. **Install distribution decision.** Old spec routed designers through EAS internal sideload. New decision: designers install Prototo only from the App Store; the EAS internal path becomes a maintainer-only pre-launch testing tool.

## Locked decisions

| Decision | Reason |
|---|---|
| Folder `apps/prototo-app/` (was `apps/proto-app/`) | Match product brand |
| Bundle ID `com.sherizan.prototo` (was `com.sherizan.proto`) | Match brand. Fresh App Store Connect claim. |
| URL scheme `prototo://` (was `proto://`) | Match brand |
| Display name "Prototo" (was "Proto") | Match brand |
| EAS slug `prototo-app` | Match folder |
| `MinimumOSVersion: 26.0` | Guaranteed Liquid Glass support; intentional positioning bet |
| `associatedDomains: ["applinks:prototo.app"]` declared here | Universal-link handler is implemented in share-landing sub-unit E; entitlement must exist in the binary from launch |
| Single QR from `proto start` | Onboarding architecture (replaces two-QR Step-1/Step-2 model) |
| QR opens Prototo App via standard Expo dev-client URL (`prototo://expo-development-client/?url=...`) | Approach 1 — standard Expo path; we don't fight the framework |
| Template's `app.json` `scheme: "prototo"` (was per-project `{{name}}`) | All Prototo projects share Prototo App as runtime, same way all Expo projects share Expo Go |
| `proto start` runs `expo start --dev-client --ios` (was `expo start --ios`) | Tells Expo to generate the custom-scheme URL and target the dev client, not Expo Go |
| Designer install path: **App Store only** | No TestFlight, no EAS sideload, no public install URL. Maintainer pre-launch testing uses EAS `development` profile + UDID-registered sideload, but that path is not designer-facing. |
| Simulator: Prototo App simulator binary, auto-installed by proto-cli first run | Replaces `ensureExpoGoMatchesProject` with `ensurePrototoAppMatchesProject`; tarball + manifest fetched from a stable URL keyed by Expo SDK major |
| Distribution: EAS Build (hosted), profiles `development`, `development-simulator`, `production` | Hosted toolchain; no Xcode 26 download required on dev machine |

**Implication for ship order:** the dev client cannot reach designers until Prototo App is on the App Store. Per the Phase 3 decomp doc, F (App Store) is the long-pole and starts in parallel. This spec describes the build and the wiring; first designer-visible release lands when F completes.

## Out of scope (explicit, deferred)

- TestFlight beta channel — App Store-only per the install decision
- OTA updates via `expo-updates` — every native change requires App Store update
- Android — Material You / Jetpack Compose story is its own future spec
- Auth, accounts, telemetry inside Prototo App
- Custom native modules beyond Expo SDK 55 bundled set
- Viewer-mode runtime (sub-unit E in Phase 3 decomp) — Prototo App declares the universal-link entitlement here, but the actual viewer code lands in sub-unit E
- Comment pins, version history (Phase 4)

## Architecture

### Flow diagram

```
Designer's Mac                               Designer's iPhone / Simulator
─────────────────────────────────────        ──────────────────────────────────
$ proto start
  │
  ├─ ensurePrototoAppMatchesProject()
  │   - reads project's Expo SDK major
  │   - if booted simulator AND installed
  │     Prototo App's major mismatch (or missing):
  │       download Prototo.app.tar.gz from stable URL
  │       xcrun simctl install booted <unpacked .app>
  │   - cached in ~/.prototo/cache/
  │     keyed by SDK major + hash
  │
  ├─ expo start --dev-client --ios
  │   - Expo dev server starts on :8081
  │   - prints QR encoding:
  │       prototo://expo-development-client/
  │         ?url=exp://<lan>:8081
  │
  ├─ Simulator boots → Prototo opens          [Simulator: bundle auto-loads]
  │   the URL automatically (--ios flag)
  │
  └─ Designer scans QR with Camera            [iPhone: prototo:// handler]
                                              └─ Prototo opens
                                              └─ Loads Metro bundle from LAN
                                              └─ Renders prototype with
                                                  real Liquid Glass
```

### Why standard Expo dev-client (not custom proxy / not universal-link)

Three approaches were considered:

1. **Standard Expo dev-client** *(chosen)*. Project + Prototo App both declare `scheme: "prototo"`. `expo start --dev-client` generates `prototo://expo-development-client/?url=...` natively. Minimal custom code; we don't fight Expo's URL conventions.
2. **Custom QR proxy** — proto-cli scrapes Metro stdout and synthesises its own QR. Rejected: brittle if Expo CLI output format changes; only buys per-project scheme namespacing, which designers don't need (they don't deep-link between prototypes).
3. **Universal links via prototo.app** (`https://prototo.app/dev?host=<lan>`) — Rejected for the dev-client path: couples local dev to prototo.app availability and adds round-tripping for what is a LAN handoff. Universal links *are* the right tool for the share-landing flow (stakeholder receiving a hosted snapshot link), but that's a separate flow handled by the share-landing spec.

### Why the simulator-binary-via-CDN piece

Simulator can't use App Store (no App Store on Simulator). Three options considered:

1. Vendor the `.app` inside `proto-cli` — bloats the npm package by ~50MB. Rejected.
2. **Fetch on first run from a stable URL** *(chosen)*. Small artifact, version-pinned by Expo SDK major. proto-cli verifies hash, caches in `~/.prototo/cache/`. Survives offline use after first run.
3. Require maintainer to run a build script per dev machine — Rejected: breaks "one command" promise.

Option 2 means each `pnpm release:simulator` ships a new artifact when the Expo SDK is bumped; designers pick it up transparently on their next `proto start`. SDK-bump pain on Simulator becomes a 1–2 minute auto-download, not a maintainer-instruction-laden re-install.

## File changes

### Renamed (mechanical, every reference)

| From | To |
|---|---|
| `apps/proto-app/` | `apps/prototo-app/` |
| `apps/proto-app/package.json` `"name": "proto-app"` | `"name": "prototo-app"` |
| `apps/proto-app/app.json` `"name": "Proto"` | `"name": "Prototo"` |
| `apps/proto-app/app.json` `"slug": "proto-app"` | `"slug": "prototo-app"` |
| `apps/proto-app/app.json` `"scheme": "proto"` | `"scheme": "prototo"` |
| `apps/proto-app/app.json` `"bundleIdentifier": "com.sherizan.proto"` | `"bundleIdentifier": "com.sherizan.prototo"` |
| `apps/proto-app/app.json` `extra.eas.projectId: "0fc08f0e-..."` | remove (EAS provisions a fresh ID on first build under new slug) |

### New / added inside `apps/prototo-app/`

| Path | Responsibility |
|---|---|
| `apps/prototo-app/app.json` ios.infoPlist additions | `"MinimumOSVersion": "26.0"`; existing `"ITSAppUsesNonExemptEncryption": false` kept |
| `apps/prototo-app/app.json` ios.associatedDomains | `["applinks:prototo.app"]` |
| `apps/prototo-app/eas.json` | Add `production` profile: `{ "distribution": "store", "autoIncrement": true }` |
| `apps/prototo-app/scripts/release-simulator.ts` | Maintainer-only. Downloads `.tar.gz` of the most recent `development-simulator` EAS build, computes SHA256, uploads `Prototo.app.tar.gz` + `manifest.json` (`{ sdkMajor: number, sha256: string, builtAt: ISO8601 }`) to a stable URL. Initial host: GitHub Releases on this repo, tag format `prototo-sim-sdk<sdkMajor>-<incrementingBuild>` (e.g. `prototo-sim-sdk55-3`). proto-cli reads `manifest.json` from `https://github.com/<owner>/proto/releases/download/prototo-sim-sdk<major>-latest/manifest.json` (latest pointer maintained by the release script). Wired into `package.json` `scripts` as `release:simulator`. |
| `apps/prototo-app/README.md` (existing) | Update copy: drop any "Proto" references, describe maintainer build commands and release flow. |

### Modified in `packages/proto-cli/src/`

| File | Change |
|---|---|
| `expo-spawn.ts` | `spawnExpo` invokes `npx expo start --dev-client --ios` instead of `npx expo start --ios`. Test updated accordingly. |
| `ensure-expo-go.ts` → renamed `ensure-prototo-app.ts` | `EXPO_GO_BUNDLE_ID = 'host.exp.Exponent'` → `PROTOTO_APP_BUNDLE_ID = 'com.sherizan.prototo'`. On simulator-major mismatch (or app missing): fetch `Prototo.app.tar.gz` from the configured stable URL, verify against `manifest.json` SDK major + hash, unpack into `~/.prototo/cache/<sdkMajor>-<shortHash>/`, install via `xcrun simctl install booted <path>`. On offline + cached version mismatched: log a designer-friendly message via the translation layer ("Your Simulator's Prototo is older than this project. Connect to the internet to update, or run `proto start` once with connection."). |
| `ensure-expo-go.test.ts` → renamed `ensure-prototo-app.test.ts` | Rewritten: bundle-ID detection, manifest fetch + hash verification (mocked HTTP), cache hit/miss paths, install invocation, offline fallback message. |
| `messages.ts` | Remove any Expo Go-flavoured copy. Add: `installingPrototoApp` ("Setting up Prototo on the Simulator…"), `prototoAppOutdated` (when phone Prototo App is older than the project's Expo SDK — copy: "This project needs a newer Prototo. Update from the App Store and try again."), `prototoSimulatorOffline` (offline + cached mismatch message above). |
| `messages.test.ts` | Cover new keys. |
| `start.ts` | Replace `ensureExpoGoMatchesProject` call site with `ensurePrototoAppMatchesProject`. Import + parameter updates only. |
| `error-translation.ts` | If applicable, map any Metro/Expo error strings about Expo Go to Prototo equivalents. |

### Modified in `packages/create-proto/template/`

| File | Change |
|---|---|
| `.proto/expo-config/app.json` | `"scheme": "{{name}}"` → `"scheme": "prototo"`. All Prototo projects share this scheme so Prototo opens them via the dev-client URL convention. |
| `CLAUDE.md` | Audit for any stray "Expo Go" / "Proto App" mentions; rewrite to "Prototo". |
| `README.md` | Add a single line at the top: "Before running `proto start`, install Prototo from the App Store." (Until App Store ship, this README copy is a maintainer-time follow-up — not blocking spec merge.) |

### Modified in `docs/`

| File | Change |
|---|---|
| `docs/proto-master.md` | Replace all remaining "Proto App" → "Prototo App". Update §11/§14 file-structure block: `proto-app/` → `prototo-app/`. Remove stale "Expo Go" preview-surface mentions (e.g., §3's "Phase 1+2 fallback via Expo Go" line and §14's install-Expo-Go copy block) — preview surface is now Prototo on simulator (auto-installed) and Prototo on iPhone (App Store). Add a decisions-log entry: "2026-05-25: dev-client rename Proto → Prototo. Single-QR onboarding (supersedes two-QR Step-1/Step-2). App Store-only designer install path. SDK-bump pain on iPhone surfaces as a 'Update Prototo' screen." |
| `docs/superpowers/specs/2026-05-22-proto-app-dev-client-design.md` | Add a banner at the top: `> Status: superseded by 2026-05-25-prototo-app-dev-client-design.md`. Keep the file as historical record. |
| `docs/superpowers/specs/2026-05-22-onboarding-redesign-design.md` | Add a note: the two-QR Step-1/Step-2 architecture in §1 and §2 is superseded by the single-QR model in `2026-05-25-prototo-app-dev-client-design.md`. Keep the rest (copy patterns, terminal output style) — still canonical. |
| `docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md` | Sync references: `Proto App` → `Prototo App`, `com.sherizan.proto` → `com.sherizan.prototo`, `apps/proto-app/` → `apps/prototo-app/`, `applinks:` `appID` field uses new bundle ID. |

## Build / install / release flow

### Per Expo SDK bump (maintainer)

```
cd apps/prototo-app

# Simulator binary — designer-facing, must always be live
eas build --platform ios --profile development-simulator
pnpm release:simulator
  → downloads .app from EAS
  → tars + hashes
  → uploads Prototo.app.tar.gz + manifest.json
    to GitHub Release tagged prototo-app@<sdkMajor>.<n>

# Device binary — App Store path
eas build --platform ios --profile production
eas submit --platform ios --latest
  → uploads to App Store Connect
  → maintainer files for review

# Maintainer pre-launch device testing only (not designer-facing)
eas build --platform ios --profile development
  → returns internal install URL
  → maintainer adds own UDID, sideloads via Safari
```

### Designer-facing flow (post-App-Store ship)

```
One-time setup (designer, on iPhone):
  Open App Store → search "Prototo" → Install

Per-project:
  $ npm create proto@latest myapp
  → scaffolds project, auto-runs proto start
  → "Open Prototo, scan this QR:"
  → [single QR]

  Designer scans QR with Camera → iOS routes to Prototo via prototo://
    OR opens Prototo manually and taps "Scan QR" inside the app
  → Prototo loads bundle from Mac's Metro
  → Welcome screen renders with real Liquid Glass

Simulator path (auto, no user action):
  proto start
  → ensurePrototoAppMatchesProject downloads + installs simulator binary
    if missing or SDK mismatch (silent if already present)
  → expo start --dev-client --ios boots Simulator + opens Prototo
  → Welcome screen renders
```

## Version-mismatch handling

When designer's installed Prototo's bundled Expo SDK major ≠ project's Expo SDK major:

- **Simulator** — auto-detected and refreshed by `ensurePrototoAppMatchesProject` before Metro starts. Silent on success; designer-friendly progress message on download.
- **iPhone** — cannot be auto-updated by the CLI. Prototo App itself detects the mismatch when loading the bundle and shows a designer-readable screen: *"This project needs a newer Prototo. Update from the App Store and try again."* The CLI surfaces the same hint via the translation layer if it detects a 5+ second silence after QR scan (the device never reached `/onLaunch`).

SDK-bump pain on iPhone is gated by App Store update — acceptable as a once-per-SDK cost.

## Definition of done

- [ ] Folder renamed `apps/proto-app/` → `apps/prototo-app/`; all package, app.json, eas.json fields updated to Prototo branding (name, slug, bundle ID, scheme)
- [ ] `apps/prototo-app/app.json` declares `MinimumOSVersion: 26.0` + `associatedDomains: ["applinks:prototo.app"]`
- [ ] `eas.json` has `development`, `development-simulator`, `production`, `preview` profiles
- [ ] `pnpm release:simulator` script lives in `apps/prototo-app/` and successfully publishes a tarball + manifest to a stable URL (GitHub Releases, this repo)
- [ ] `proto-cli` rename: `ensure-expo-go.{ts,test.ts}` → `ensure-prototo-app.{ts,test.ts}`; downloads, caches, and installs the simulator binary on first `proto start`
- [ ] `proto-cli` `spawnExpo` now invokes `npx expo start --dev-client --ios`
- [ ] Template's `.proto/expo-config/app.json` declares `scheme: "prototo"`
- [ ] Master doc: all "Proto App" → "Prototo App"; file-structure block updated; decisions-log entry added; 2026-05-22 demotion text removed
- [ ] 2026-05-22 dev-client spec marked superseded with banner
- [ ] 2026-05-22 onboarding spec annotated: two-QR model superseded by single-QR
- [ ] 2026-05-24 share-landing spec synced to new bundle ID + folder name
- [ ] Maintainer EAS `development` build sideloaded on Sheri's iPhone; `proto start` from a fresh `create-proto myapp` scan-with-camera opens Prototo (not Expo Go) and renders welcome screen with **visible Apple Liquid Glass refraction** in Card glass + native large-title nav bar
- [ ] Simulator path: fresh `proto start` on a clean machine downloads Prototo simulator binary, installs it, opens the prototype, welcome screen renders
- [ ] Designer-facing copy contains zero mentions of "Expo Go", "Expo", or any engineering branding
- [ ] All existing proto-cli tests pass; new tests cover `ensure-prototo-app` download + cache + version-mismatch paths
- [ ] App Store submission filed (Phase 3 sub-unit F; tracked separately, not blocking this spec's merge)

## Open risks

1. **App Store rejection** is the only thing blocking designer rollout. Mitigations: keep the dev-client UI surface minimal (host screen + dev tools); ensure App Store metadata frames Prototo accurately as a developer/designer tool with viewer-mode use case (not a free-form code runner, which Apple has historically rejected). Plan B if review drags >2 weeks: ship TestFlight invites manually — not a spec-level decision now, but noted.
2. **`MinimumOSVersion: 26.0`** excludes designers not yet on iOS 26. Per master-doc positioning ("Liquid Glass without Xcode") this is the intentional bet. Acceptance criterion: master doc's iOS-26 stance stays the product line, even at the cost of early adopters on older OS.
3. **Simulator Liquid Glass fidelity unknown.** iOS 26 Simulator may not paint the real material even with the correct binary + entitlements. If it doesn't, the simulator path still works for layout/interaction iteration but the Liquid Glass promise becomes device-only. Validate during DoD acceptance.
4. **Stable URL for simulator binary.** GitHub Releases is the initial choice (zero infra cost, signed by repo). If artifact size or download speed becomes an issue, migrate to `prototo.app/assets/` later — the spec requires "a stable URL", not a specific host.
5. **`com.sherizan.prototo` bundle claim.** Needs fresh registration in App Store Connect under the user's developer account. Old `com.sherizan.proto` claim is abandoned (no public release happened, so safe to leave dormant).
6. **EAS project ID for the renamed slug.** First `eas build` under the new slug provisions a fresh project ID; the existing `0fc08f0e-...` in `app.json` is removed so EAS prompts on first build.

## What this spec does not change

- Phase 1 components, CLI commands, templates: structurally unchanged. The dev-client work is additive on top of the existing onboarding redesign.
- Designer's prompt-driven workflow inside Claude Code: unchanged.
- `proto design` command: unchanged.
- DESIGN.md / CLAUDE.md template structure: copy edits for branding only.
- The single-QR onboarding output style established in `2026-05-22-onboarding-redesign-design.md` §2: kept; just the underlying QR payload changes from `exp://` to `prototo://expo-development-client/?url=...`.
