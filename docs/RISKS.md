# Risks Backlog

> Source of truth for open risks across the Proto + Prototo product line. Curated; not every "Open risks" item in every spec lands here — only the ones worth tracking *across* features.
>
> Each new spec under `docs/superpowers/specs/` must include an **Open risks** section. The risks that affect more than the immediate feature (cross-cutting, long-tail, or requiring follow-up work) get promoted here for visibility.
>
> Status: `open` (active concern), `mitigated` (controls in place; revisit if conditions change), `accepted` (we chose to live with this), `resolved` (no longer applies). Each entry links to its source spec.

## Format

`| ID | Area | Risk | Status | Source | Mitigation / next action |`

IDs are append-only, two-letter area prefix + sequence (`DC-01`, `SH-02`, etc.). Don't renumber.

| Area | Prefix |
|---|---|
| Dev client (`apps/prototo-app/`) | `DC` |
| Share infrastructure (`prototo.app`) | `SH` |
| CLI (`packages/proto-cli/`) | `CL` |
| Scaffold (`packages/create-proto/`) | `SC` |
| App Store / Apple Developer | `AS` |
| Cross-cutting / infra | `XX` |

---

## Open

| ID | Area | Risk | Status | Source | Mitigation / next action |
|---|---|---|---|---|---|
| `AS-01` | App Store | App Store rejection of Prototo App. Apple has historically rejected JS-bundle-loading apps. | `open` | `2026-05-25-prototo-app-dev-client-design.md` §Open risks #1 | Frame App Store metadata around the viewer-mode use case, not "code runner". Plan B if review >2 weeks: TestFlight invites for early adopters. |
| `AS-02` | App Store | Apple Developer account scope. Currently personal; may need team upgrade for non-individual publishing. | `open` | (operational, not in spec) | Revisit if/when team members are added. |
| `DC-01` | Dev client | `MinimumOSVersion: 26.0` excludes designers on older iOS. | `accepted` | `2026-05-25-prototo-app-dev-client-design.md` §Open risks #2 | Intentional positioning bet ("Liquid Glass without Xcode"). Revisit if a meaningful audience is locked out. |
| `DC-02` | Dev client | Simulator Liquid Glass fidelity unknown — Apple's iOS 26 Simulator may not paint the real material even with correct entitlements. | `mitigated` | `2026-05-25-prototo-app-dev-client-design.md` §Open risks #3 | Validated on iPhone (real Liquid Glass renders); Simulator path works for layout/interaction. Re-test if Apple updates Simulator graphics stack. |
| `DC-03` | Dev client | `com.sherizan.prototo` bundle ID claim. Needs fresh registration in App Store Connect; old `com.sherizan.proto` claim abandoned but dormant. | `mitigated` | `2026-05-25-prototo-app-dev-client-design.md` §Open risks #5 | Registered 2026-05-25 (App Store Connect entry created with the new bundle ID). |
| `DC-04` | Dev client | EAS API uses `buildProfile`, not `profile`. A future maintainer touching `eas build:list --json` may hit the same gotcha. | `open` | `2026-05-25-prototo-app-dev-client-design.md` §Open risks #7 | Grep convention: always `buildProfile` in any new EAS-querying code. |
| `DC-05` | Dev client | `release-simulator.ts` leaks ~50–100 MB to `/tmp/prototo-release-*` after each run (workDir not cleaned). | `open` | Final code review of `feat/prototo-app-dev-client` | Add `fs.rmSync(workDir, { recursive: true, force: true })` at end of `main()`. ~5 min fix. |
| `DC-06` | Dev client | `prototoAppOutdated` message is defined + tested but never called at runtime. CLI-side silence-detection trigger not implemented. | `open` | `2026-05-25-prototo-app-dev-client-design.md` §Implementation footnotes | Either wire up a 5+ second silence detector after QR scan or remove the message + test. Decide before stable 1.0. |
| `SH-01` | Share infra | Rate-limit ceiling (10/hr/IP) is a guess. May bite early beta testers. | `open` | `2026-05-24-share-landing-and-token-router-design.md` §Open follow-ups #3 | Revisit after `proto share` ships and we see real usage patterns. |
| `SH-02` | Share infra | Token-format type sharing — `ShareCreateInput` will be duplicated between `prototo-website` and `proto-cli`. | `open` | `2026-05-24-share-landing-and-token-router-design.md` §Open follow-ups #1; restated in `2026-05-25-proto-share-design.md` | Defer until D ships. Extract `@sherizan/prototo-types` package once both sides need to evolve together. |
| `SH-03` | Share infra | Universal-link verification once F ships. Need to validate AASA file with Apple's tooling. | `open` | `2026-05-24-share-landing-and-token-router-design.md` §Open follow-ups #2 | Add to F's pre-submission checklist. |
| `SH-04` | Share infra | Master doc roadmap numbering mismatch — prototo-website calls share "Phase 4", proto repo master doc calls it "Phase 3". | `open` | `2026-05-24-share-landing-and-token-router-design.md` §Open follow-ups #4 | Reconcile before B is publicly demoed. |
| `SH-05` | Share infra | Cloudflare Quick Tunnel subdomain rotation. Designer Ctrl+C and restart produces a new tunnel URL; old share token points at a dead tunnel. | `accepted` | `2026-05-25-proto-share-design.md` §Open risks #1 | Phase 3a tradeoff. Phase 3b hosted-snapshot resolves entirely. |
| `SH-06` | Share infra | Metro accessible publicly through the cloudflared tunnel. JS bundle = project source, no auth gate. | `accepted` | `2026-05-25-proto-share-design.md` §Open risks #3 | Phase 3a tradeoff. Phase 3b hosted-snapshot (uploaded bundle, not streamed) closes this. |
| `SH-07` | Share infra | Cloudflare service outage on `trycloudflare.com` breaks `proto share`. No automatic transport fallback. | `accepted` | `2026-05-25-proto-share-design.md` §Open risks #4 | Failure message points designer at docs. Doubling transport options doubles testing surface. |
| `CL-01` | CLI | `cloudflared` npm package quality / Cloudflare protocol churn. | `mitigated` | `2026-05-25-proto-share-design.md` §Open risks #2 | `ensureCloudflared` checks system-installed first; falls back to npm-managed. Logged in translation layer when a fallback is taken. |
| `CL-02` | CLI | Race between Metro readiness and tunnel start. First stakeholder request could hit a 502 before Metro is ready. | `open` | `2026-05-25-proto-share-design.md` §Open risks #7 | Wait for Metro readiness signal before printing the share URL. `expo-spawn` already exposes readiness via stdout; reuse that. |
| `CL-03` | CLI | Zod added as runtime dep on proto-cli (~12KB gzipped). | `accepted` | `2026-05-25-proto-share-design.md` §Open risks #6 | Acceptable for v1. Replace with hand-rolled validator if package size becomes a concern. |
| `XX-01` | Cross-cutting | The `next` npm dist-tag retains old beta references after stable promotion (tombstones). | `open` | Conversation 2026-05-25 | Optional cleanup: `npm dist-tag rm <pkg> next` once stable is well-adopted. Harmless if left. |
| `DC-07` | Dev client | expo-dev-client's bundle-load error UI (e.g., 502 from a dead tunnel) is owned by Expo and not customizable. Stakeholder sees Expo's default error screen instead of Prototo-branded copy. | `accepted` | `2026-05-25-prototo-viewer-mode-design.md` §Open risks #2 | Phase 3a tradeoff. B's share-landing page is the primary surface for stakeholders who can't connect. Phase 3b hosted-snapshot eliminates the live-tunnel failure mode. |
| `SH-08` | Share infra | Viewer-side stale-tunnel race: stakeholder taps a share link after the designer Ctrl+C's `proto share`. KV still has the (now-dead) tunnel URL, redirect succeeds, expo-dev-client gets a 502 from the bundle fetch. | `accepted` | `2026-05-25-prototo-viewer-mode-design.md` §Open risks #5 | Distinct from SH-05 (which is about designer-restart). Same Phase 3b hosted-snapshot fix. |
| `AS-03` | App Store | Universal-link AASA file propagation lag — iOS caches the previous AASA for up to 24h after an App Store install. Universal-link path may not work for some users during that window. | `open` | `2026-05-25-prototo-viewer-mode-design.md` §Open risks #1 | Scheme path remains functional. Document the 24h window. Revisit if real users hit it after F lands. |

## Resolved / closed

| ID | Area | Risk | Resolution date | Notes |
|---|---|---|---|---|
| (none yet) | — | — | — | — |

---

## How this file is maintained

1. **Adding a risk:** when a new spec lands, copy any cross-cutting items from its "Open risks" section into this file with a fresh ID. Inline-only risks (specific to one file, no downstream impact) stay in the spec.
2. **Updating status:** when a risk's status changes (mitigated → resolved, open → accepted, etc.), update the row + add a note in the right column.
3. **Closing a risk:** move the row to the "Resolved / closed" table with a resolution date. Don't delete — closed risks are useful history.
4. **No renumbering:** IDs are append-only. If a risk is closed, its ID is retired; subsequent risks in the same area continue counting up.

This file is human-readable and never machine-parsed — table format is fine to mass-edit by hand when a sweep is needed.
