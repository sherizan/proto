# Viewer release checklist (`apps/prototo-app` store cuts)

Born from the 2026-07-07 QR bug: builds 26-29 each shipped a *real* fix that
was not *the reported* bug, because verification ran against reconstructed
flows instead of the reported one. These gates are cheap; a wasted TestFlight
cycle is not.

## Before cutting a build

1. **Reproduce the reported flow as reported.** Same entry point, same auth
   state, same screen state before the action. Entry points are NOT
   interchangeable:
   - Camera scan / tapped link ≈ OS URL delivery through the shell router —
     simulate with `xcrun simctl openurl <sim> "prototo:///p/<token>"`.
   - The `prototo://expo-development-client/?url=…` channel bypasses URL
     delivery entirely (expo-linking's registry never sees it) — it can load a
     share but proves nothing about link routing.
   A fix without a repro of the reported flow does not cut a build.
2. **Run `apps/prototo-app/scripts/sim-e2e.sh`** (dedicated sim, never the
   desktop's headless one) and get a PASS on the fix build.
3. Tests + `tsc --noEmit` green; `~/Public/prototo-shared/check-contracts.sh`
   clean.

## Field-report intake (before theorizing)

- Screenshot of the failure.
- TestFlight build number **confirmed on the device** (not assumed).
- Entry point + what was on screen immediately before and after.

One discriminating question costs minutes; a build cycle costs hours.

## Circuit breaker

Three failed fixes for one symptom means the *repro* is the suspect, not the
fix. Stop, re-derive the mechanism from raw evidence only (screenshots, crash
logs, device logs), and list which assumptions each prior fix baked in.

## Known landmines (verified the hard way)

- `ExpoLinkingRegistry.initialURL` is process-wide and survives runtime
  swaps; every freshly mounted runtime reads it as its own initial URL.
  `AppDelegate.mount()` clears it (`ExpoLinkingClearInitialURL`).
- Old runtimes must not be freed synchronously on swap — in-flight module
  work (expo-fetch) segfaults against freed JSI memory (DC-14 grace-hold).
- expo-dev-launcher's subscriber swallows external URLs whenever it thinks no
  app is running — always true in the launcher-free build (warm-link fix).
