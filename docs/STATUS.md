# Proto STATUS

> Living status of Proto work. Snapshot, not log.
> For history → use `git log`. For design → `docs/superpowers/specs/`. For risks → `docs/RISKS.md`.
> Last updated: 2026-05-27 (proto-cli exports bugfix)

## Currently live

| Layer | Version | Source / install path |
|---|---|---|
| Prototo App — device | **0.1.8** (EAS build #5) | `prototo.app/install/ios` → EAS register-device URL `94895f10-...` |
| Prototo App — simulator | **0.1.8** (EAS sim build `07c51405`, GitHub Release tag `prototo-sim-sdk55-3`) | `github.com/sherizan/proto/releases/.../prototo-sim-sdk55-latest/Prototo.app.tar.gz` |
| `create-proto` on npm | **0.4.2** (`latest`) | `npm create proto@latest myapp` |
| `@sherizan/proto-cli` on npm | **0.4.2** (`latest`) | dep of every scaffolded project |
| `proto-components` (workspace) | 0.0.0, `private: true` | never published; source of truth for `components/proto/` synced into template via `scripts/sync-template.ts` |

## Done recently

- **2026-05-27 — proto-cli `exports` map regression fixed.** The `exports` map added in 0.4.1 (subpaths for `./design` + `./design-libraries`) inadvertently gated all deep paths, so `create-proto`'s `resolveProtoCli` (which does `req.resolve('@sherizan/proto-cli/dist/index.js')`) returned null and designers saw `"Couldn't find proto-cli. Run manually: cd myapp && npx proto start"` on every fresh scaffold. Fix: added `"."` main entry, `"./dist/*"` wildcard, and `"./package.json"` to the exports map. Both packages bumped to 0.4.2 and republished. Verified via `node -e` resolution test + end-to-end scaffold spawn.
- **2026-05-27 — motion + gestures + lottie + canvas primitives shipped end-to-end.** Four subpath modules in `packages/proto-components/src/{motion,gestures,lottie,canvas}/`, mirrored into template via auto-sync. Prototo App 0.1.8 bundles `react-native-ease`, `lottie-react-native`, `@shopify/react-native-skia`, plus the existing reanimated 4.2.1 + gesture-handler. Commits: `bd2c388` (feature), `80d30dd` (versions), `f1c3b8c` (IPA-size doc), `d4b76b8` (DESIGN.md auto-population), `b83f2f8` (release:all + DC-09 risk), `6a4d285` (README), `326d7dc` (demo video).
- **2026-05-27 — DESIGN.md auto-populates on scaffold.** `create-proto` now calls `@sherizan/proto-cli/design`'s `renderDesignDoc()` after copying the template; fresh `npm create proto@latest` produces a fully-populated DESIGN.md including the four subpath lines. Static `template/DESIGN.md` removed in favour of the generator. TDD'd with 4 tests.
- **2026-05-27 — `release:all` script added** to `apps/prototo-app/package.json`. Chains `build:ios` + `build:ios:sim` + `release:simulator`. Use this for every Prototo App release so device + simulator channels stay in lockstep.
- **2026-05-27 — README.md refreshed** with a "Motion & graphics" section explaining the four subpath modules + four example prompts, plus the new YouTube demo URL (`https://youtu.be/_srHicLflms`).

## In progress

- (none active at session close)

## Known issues / quirks

- **`pnpm create proto@latest` has 120-min stale-cache** for `@latest` resolution. Workaround: `pnpm create proto@<exact-version>` to force fresh fetch. `npm create proto@latest` doesn't have this issue.
- **3 pre-existing typecheck errors in `packages/proto-components`** (`Card.tsx` can't find `expo-glass-effect` types; `Toggle.tsx` can't find `@expo/ui/swift-ui` types + has one implicit-any). Not caused by the motion-primitives work — present on `main` before this PR. Not blocking; the modules still compile and run.
- **npm dist-tags carry a `next: 0.3.0-beta.0` tombstone** for both packages. Tracked as `XX-01` in RISKS.md. Harmless; clean up with `npm dist-tag rm <pkg> next` when convenient.
- **iOS Simulator can stash old Prototo binaries across device instances.** If a designer's `proto start` boots a different simulator device than where the new Prototo was installed, they see a stale version. `ensure-prototo-app` SHA-checks via the GitHub Release manifest and auto-reinstalls when out of date, but only on `proto start` — the first launch of an unused simulator may need `rm -rf ~/.prototo/cache` + a fresh `proto start`.
- **`npm cache clean --force` prints an ownership warning** (`sudo chown -R 501:20 /Users/sherizan/.npm`). Pre-existing on Sheri's machine from a past `sudo npm`. Cosmetic.

## Next up (idea backlog, not committed)

- **Authenticate Expo MCP.** Installed in this session via `claude mcp add --transport http expo-mcp https://mcp.expo.dev/mcp` but not yet authenticated. Run `/mcp` in a Claude Code session to complete OAuth. Once done, Claude can query EAS builds + simulator state directly instead of asking Sheri to paste output.
- **Bump fallback version in `prototo-website` repo** (`/Users/sherizan/Public/prototo/lib/npm.ts:9`). Currently `"0.1.10"` — the live site auto-fetches the real version from npm (currently 0.4.1) but the fallback is used when the npm fetch fails. Should be closer to current. Single-line edit in a separate repo.
- **Phase 3 web share (`prototo.run`)** still planned per roadmap, not started.
- **DC-08 `react-native-ease` maturity** to revisit after first real designer-usage feedback on the `motion` subpath. If ease misbehaves on common props (e.g., `borderRadius` on iOS), the fallback is to swap to `gestures` per the template CLAUDE.md guidance.

---

## How to maintain this file

**At the start of a Claude Code session in this repo:** read this file first to see what's current.

**At the end of a Claude Code session:**
1. If anything in "Currently live" changed (versions, install paths, new releases), update the table.
2. Move freshly-completed work from "In progress" → "Done recently" with date + commit refs.
3. If new bugs surfaced, add to "Known issues / quirks".
4. If new follow-ups came up that aren't being acted on, drop them in "Next up".
5. Update the "Last updated" line in the header.
6. Commit this file alongside whatever else the session produced — the file IS the handoff note.

Keep "Done recently" to roughly the last 2–3 weeks. Older entries can be culled — `git log` is the long-term history.
