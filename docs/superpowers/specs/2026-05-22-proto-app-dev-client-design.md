# Proto App — Custom Dev Client Spec

> Date: 2026-05-22. Status: design draft.
> Supersedes the 2026-05-22 decision that demoted custom dev client to Phase 3 — device validation proved Expo Go's binary does not render Apple's Liquid Glass material even when `expo-glass-effect`'s `isLiquidGlassAvailable()` returns true.

## Goal

A custom Expo dev client — published as **Proto** — that the designer installs once on their iPhone, then scans the project QR from `proto start` and sees their prototype rendered with **real Liquid Glass** (Apple's iOS 26 SwiftUI material), not the frosted-blur fallback.

## Why we're doing this

Phase 2 device validation (2026-05-22, iOS 26.5, Expo Go SDK 54, our `Card glass={true}` + `Nav` with `expo-glass-effect`'s `GlassView`):

- `isLiquidGlassAvailable()` returned `true`
- `GlassView` rendered but no visible refraction — area behind glass was empty, but even with cards explicitly scrolling underneath the glass appeared as a faint gray rectangle, not Apple's refractive Liquid Glass material
- Conclusion: Expo Go's current iOS binary does not paint Apple's Liquid Glass material at runtime, despite the JS-side detection succeeding

The only viable path to real Liquid Glass is **our own iOS binary compiled with Xcode 26 and the right Info.plist / entitlements**. That binary is the Proto App.

## Locked decisions

| Decision | Reason |
|---|---|
| Build via EAS Build (hosted), not local Xcode | No Xcode 26 download required (~13GB); EAS handles the toolchain. |
| Distribution: `internal` (sideload via QR / Safari), not TestFlight or App Store | MVP scope. User installs on their own device. TestFlight / App Store come later when we have more testers. |
| Single bundle ID: `com.sherizan.proto` | Documented in master doc §15. Free to keep claiming since no public release yet. |
| App name on home screen: "Proto" | Designer-recognisable. Replaces "Expo Go" in the trust path. |
| Native modules baked in: full SDK 54 set used by Proto projects | `expo-glass-effect`, `expo-blur`, `expo-haptics`, `react-native-reanimated` + `react-native-worklets`, `react-native-screens`, `react-native-gesture-handler`, `react-native-safe-area-context`, `@expo/ui` |
| Deep link scheme: `proto://` | Project QRs open directly in Proto App. No "select dev client" picker prompt the designer doesn't understand. |
| Apple Developer account: paid (active) | Code signing + EAS Build need it. |

## Out of scope (Phase 3+)

- TestFlight beta channel (sharing builds with non-engineering testers)
- App Store public listing
- Android equivalent (Jetpack Compose / Material You story comes later)
- Auth, accounts, telemetry inside Proto App
- OTA updates via `expo-updates`
- Custom native modules beyond what's bundled in Expo SDK 54

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Designer's Mac                                              │
│                                                             │
│   create-proto myapp        → scaffolds project              │
│   proto start                → prints two QRs:               │
│                                  Step 1: Proto App install   │
│                                  Step 2: proto://<lan>:8081  │
│                                          (was exp://)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Step 1 QR
        ┌──────────────────────────────────────────────────┐
        │ Phone: Camera scans Step 1 QR                    │
        │   → opens Safari at EAS internal-install URL     │
        │   → installs Proto App (.ipa, signed)            │
        └──────────────────────────────────────────────────┘
                              │
                              ▼ Step 2 QR (after Proto App installed)
        ┌──────────────────────────────────────────────────┐
        │ Phone: Camera scans Step 2 QR                    │
        │   → iOS opens Proto App via proto:// scheme       │
        │   → Proto App loads bundle from Mac's Metro       │
        │   → Welcome screen renders with REAL Liquid Glass │
        └──────────────────────────────────────────────────┘
```

## File structure

**New (Proto App itself):**

| Path | Responsibility |
|---|---|
| `apps/proto-app/` | Expo bare workflow project (the dev client). Has `app.json` with Proto branding, `eas.json` with development profile, `App.tsx` as a minimal dev-client host. |
| `apps/proto-app/app.json` | name: "Proto"; bundleIdentifier: "com.sherizan.proto"; scheme: "proto"; icon, splash; minimum iOS version: 26.0 (gives us guaranteed Liquid Glass). |
| `apps/proto-app/eas.json` | `development` profile with `developmentClient: true`, `distribution: "internal"`. `development-simulator` profile for sanity testing without a device. |
| `apps/proto-app/package.json` | Same SDK 54 native modules as the template, plus `expo-dev-client`. |
| `apps/proto-app/App.tsx` | Minimal entry that hosts the dev-client UI (Expo provides this; we mostly leave it alone). |
| `apps/proto-app/ios/Info.plist` (generated by prebuild) | We confirm `MinimumOSVersion` is 26.0 so all Liquid Glass APIs are available. |

**Modified:**

| Path | Change |
|---|---|
| `packages/proto-cli/src/commands/start.ts` | Step 1 QR now points at the Proto App install URL (EAS internal install) instead of Expo Go App Store. Step 2 QR uses `proto://` scheme instead of `exp://`. Both URL constants centralised, fed by env vars so the install URL can be overridden during development. |
| `packages/proto-cli/src/messages.ts` | Step 1 copy: "Install Proto on your phone" (no "Expo Go" mention anywhere now). |
| `packages/create-proto/template/CLAUDE.md` | Remove the "Expo Go" parenthetical from the preview-app description. |
| `docs/proto-master.md` | Reverse the 2026-05-22 demotion. Move custom dev client back to Phase 2 requirement. Add a decisions log entry explaining why. |

## Build and install flow (designer-facing instructions, for the README)

```bash
# One-time setup (you, the maintainer):
cd apps/proto-app
eas build --platform ios --profile development
# → EAS returns an install URL. Save it as PROTO_APP_INSTALL_URL.

# Then the designer:
# 1. Scans the Step 1 QR in proto start → Safari opens the EAS install URL
# 2. Installs Proto on phone (one-time)
# 3. Scans the Step 2 QR → Proto App opens the prototype with real Liquid Glass
```

## Implementation outline

1. **B2 — Master doc revert.** Reverse the demote-to-Phase-3 entries; add a new decisions log entry: "Expo Go binary cannot paint Liquid Glass even when detection succeeds. Custom dev client required. Date: 2026-05-22." Cite the device validation.
2. **B3 — Scaffold `apps/proto-app/`.** Use `npx create-expo-app` with the bare template, prune to dev-client essentials, add Proto branding (icon, splash, name, bundle ID), pin SDK 54 deps to the same versions as the template.
3. **B4 — `eas.json`.** Configure `development` and `development-simulator` profiles. Internal distribution.
4. **B5 — First build.** `eas build --platform ios --profile development`. Capture the EAS internal-install URL. Install on user's device. Smoke test Liquid Glass renders.
5. **B6 — proto-cli QR scheme swap.** Step 1 QR → EAS install URL (via env var; default to a placeholder, overridable). Step 2 QR → `proto://<lan>:8081` instead of `exp://`. Update copy.
6. **B7 — End-to-end validation.** `proto start` in `/tmp/test-onboarding`, scan Step 1 to install Proto App, scan Step 2 to open prototype, verify Card glass + Nav glass both visibly refract content underneath.

## Definition of done

- `apps/proto-app/` builds successfully via EAS (`eas build` exits 0).
- The .ipa installs on your iPhone via QR / Safari sideload.
- Opening a `proto start` Step 2 QR in Camera launches Proto App (not Expo Go).
- The prototype's `Card glass={true}` shows visible Apple Liquid Glass refraction.
- The prototype's bottom Nav shows visible Apple Liquid Glass refraction as content scrolls underneath.
- Designer never sees the words "Expo Go" anywhere in the flow.
- Phase 1 + Phase 2 tests still pass.

## Known risks and open questions

1. **Will Apple's Liquid Glass material actually render?** This spec assumes YES once we have a custom binary compiled with Xcode 26 (which EAS Build provides) and `MinimumOSVersion: 26.0`. If `isLiquidGlassAvailable()` returns true AND `GlassView` paints a visible material in our own dev client → spec is validated. If it still doesn't, there may be an `Info.plist` key (e.g., `UIDesignRequiresCompatibility`) or entitlement we missed; B7 will surface it.
2. **EAS Build queue time.** Free tier can be 15+ minute waits. Paid tier (~$19/mo or per-build) faster. Acceptable for MVP.
3. **`proto://` scheme conflicts** with another app installed on user's phone. Low risk (we own the scheme via bundle ID claim), but if conflict, fall back to `exp+proto://` or similar.
4. **Designer needs to re-install Proto App when we update bundled SDK versions.** Each significant Expo SDK bump means a new build + re-install. Documented as a known cost in the master doc decisions log.
5. **Apple Developer account scope.** Personal account works for MVP; if we ever want to publish on App Store the team account upgrade comes later.

## What this spec does not change

- Phase 1 components, CLI commands, templates: all unchanged. The dev client is additive.
- Designer's prompt-driven workflow inside Claude Code: unchanged.
- The `proto design` command: unchanged.
- DESIGN.md / CLAUDE.md template structure: unchanged.
