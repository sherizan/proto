# Motion + Graphics Primitives — Design Spec

> Status: design locked, implementation in flight. Date: 2026-05-27.
> Master doc: see `docs/proto-master.md` §17 Prompt 12.

## Goal

Expose four motion / graphics capabilities through a curated, Proto-branded re-export surface so designer-authored screens can use them without importing the underlying third-party libraries — keeping the "Proto component library only" invariant from `CLAUDE.md` intact.

## The four subpaths

| Subpath | Powered by | Reach for when… |
|---|---|---|
| `motion` | `react-native-ease` | "fade this in", "scale on tap", "slide up on mount". Declarative, CSS-transitions-like, runs on the native platform animator (CAAnimation / ObjectAnimator) with **zero JS overhead**. Default for transitions. |
| `gestures` | `react-native-reanimated` + `react-native-gesture-handler` | "drag this card", "swipe to delete", "parallax this header". Imperative shared values + worklets — required for gesture- or scroll-driven motion. |
| `lottie` | `lottie-react-native` | "play this Lottie when user taps subscribe". Bridge from LottieFiles / After Effects → app. Designer drops `.json` into `/assets/lottie/`. |
| `canvas` | `@shopify/react-native-skia` | "draw a confetti burst", "render a custom chart". Drawing surface for anything outside RN's box model. |

Reanimated is already installed and remains the engine for `Button`'s internal press animation — that internal usage doesn't change.

## Decisions log

| Decision | Why |
|---|---|
| Bundle all four native modules in v1 (one Prototo App release) | Native code can only land in the IPA at build time; designers can't add it later without a Sheri-led EAS Internal cut + re-install. Amortize the cost once. |
| Ease is the **default** for transitions, not reanimated | Native platform animator beats JS-thread worklets for the 70% case of simple property tweens. Reanimated stays available via `gestures` for the cases ease can't express. |
| Subpath exports of `packages/proto-components`, auto-synced into `packages/create-proto/template/components/proto/` by `scripts/sync-template.ts` (prebuild + prepublishOnly hooks) | Workspace package is the single source of truth; template path is `.gitignored` and regenerated on every build. Generated screens import `../components/proto/<subpath>` and Metro/TS resolves to the synced `<subpath>/index.{ts,tsx}`. |
| Lottie convention path: `/assets/lottie/<name>.json` | Designers drop files there; Claude references them via `require('../assets/lottie/<name>.json')`. Hardcoded in template CLAUDE.md + master doc. |
| Each `LibraryDescriptor` may carry a `subpaths[]` array; only the proto descriptor uses it | Other libraries (Tamagui, Gluestack, Paper, NativeWind, custom) keep their single `importFrom` line — they manage their own animation/drawing surface. |
| No new Babel plugins, no new `app.json` config plugins | Verified via context7 + ease/lottie/skia 2.x docs. Skia worklets ride on the existing `react-native-worklets/plugin`. |

## Library version pins (Expo SDK 55 line)

- `react-native-ease` `^0.7.2`
- `lottie-react-native` `~7.3.4`
- `@shopify/react-native-skia` `2.4.18`
- `react-native-reanimated` `4.2.1` (already installed)
- `react-native-gesture-handler` `~2.30.1` (already installed)

Resolved via `npx expo install` inside `apps/prototo-app/`. Mirrored byte-identically into `packages/create-proto/template/package.json`.

## Architectural commitment

Every native module bundled here, and every native module added later, requires a full Prototo App release (EAS Internal cut + designer re-install on every device). There is no OTA path for native code. This shapes the cadence: batch native-dep additions into monthly Prototo App releases when possible, and maintain a "what's in the box" manifest as part of the master doc so future-you knows what designers can prompt without a rebuild.

## IPA delta — measured

| Library | IPA delta (compressed, ARM64) |
|---|---|
| `react-native-ease` | <1 MB |
| `lottie-react-native` | ~2–4 MB |
| `@shopify/react-native-skia` | ~7–12 MB |
| Combined (estimated) | ~10–17 MB |

**Actual Prototo App 0.1.8 IPA: 34.0 MB** (build #5, commit `bd2c388`, EAS internal/development profile). The 75–110 MB pre-build estimate was way over — Apple App Thinning + Hermes + iOS-only ARM64 slice keep the artifact compact. No risk against Apple's 200 MB cellular cap.

## Open risks

- **Native-module release cadence (cross-cutting).** Every future native dep needs a Sheri-led EAS Internal cut + designer re-install. No OTA escape hatch for native code. **Mitigation:** maintain a "what's in the box" manifest in `docs/proto-master.md` listing every native module currently bundled; batch native-dep additions into monthly Prototo App releases when possible. Promote to `docs/RISKS.md` as `XX`-prefixed cross-cutting.
- **`react-native-ease` maturity.** Ease is a young library (App and Flow, 2025–2026), not as battle-tested as reanimated. Edge-case props (e.g. `borderRadius` on iOS) may not animate as expected. **Mitigation:** `gestures` subpath is always available as the fallback; template CLAUDE.md instructs Claude to rewrite via `gestures` if a `motion` transition misbehaves. Promote to `docs/RISKS.md` for visibility.
- **Subpath mirror drift between workspace package and template (cross-cutting, mitigated).** Workspace `packages/proto-components/src/` is auto-synced into `packages/create-proto/template/components/proto/` by `scripts/sync-template.ts`, which runs as `prebuild` + `prepublishOnly`. The template path is `.gitignored`. Workspace source is the only place to edit. Promoted to `docs/RISKS.md` as `XX-03` (status: `mitigated`).
- **Designer mental model and error translation (cross-cutting).** If Claude or the Metro red-screen surfaces stack traces from ease / reanimated / lottie / skia, designers see jargon. The §14 error-translation layer must learn to translate these libraries' failure modes. Promote to `docs/RISKS.md` and pick up in the next error-translation sweep.
- **Fabric requirement (inline).** Ease requires the New Architecture. Proto runs RN 0.83.6 with Fabric by default; if a downstream user ever disables Fabric, ease fails silently. Mitigated by locking Fabric on in the template `app.json`.
- **Skia + react-native-worklets 0.7.x interaction (inline).** Context7 reports no conflict, but Skia 2.x on RN 0.83 is recent. Fallback is "ship motion + gestures + lottie now, skia later" if the simulator build fails — defer canvas to a separate ticket.
- **Skia binary size (inline).** Skia is the bulk of the IPA delta (~7–12 MB). If the actual delta on the first EAS build exceeds 25 MB, investigate before merging; consider deferring canvas.
- **Reanimated peer-dep pin staleness (resolved in this change).** `packages/proto-components/package.json` previously pinned reanimated at 3.10.0 in devDeps while the rest of the repo runs 4.2.1. Bumped to 4.2.1 as part of this work.
- **Lottie asset path convention (inline).** Convention is `/assets/lottie/<name>.json`. If a designer drops `.json` files elsewhere, Claude won't find them. Mitigated by the template shipping `/assets/lottie/.gitkeep` and the template CLAUDE.md hardcoding the path.
