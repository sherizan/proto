# `proto share` CLI — Design Spec

> Date: 2026-05-25. Status: design draft.
> Phase 3a sub-unit **D** from `2026-05-24-phase-3-decomposition.md`. Pairs with the already-shipped B+C (share-landing page + token routing service, code in `sherizan/prototo-website`, spec at `2026-05-24-share-landing-and-token-router-design.md`).

## Goal

A new proto-cli command `proto share` that lets a designer expose their running prototype to a stakeholder via a `prototo.app/p/<token>` link. The designer's Mac stays alive serving Metro through a Cloudflare Quick Tunnel; the stakeholder taps the link, lands on the share page, installs Prototo App (when sub-unit F lands), and opens the live bundle natively.

Phase 3a is **tunnel-only**. Hosted snapshots (Phase 3b sub-unit H, `proto share --save`) are out of scope here.

## Locked decisions

| Decision | Reason |
|---|---|
| Tunnel transport: **Cloudflare Quick Tunnels** via the `cloudflared` npm wrapper | Free, no signup, no rate limit, ephemeral subdomain (`*.trycloudflare.com`). Stable enough for the 7-day share window. Binary fetched on first `proto share`, cached under `~/.prototo/cloudflared/` — same pattern as `ensure-prototo-app`. |
| `proto share` is **standalone** — starts Metro + tunnel + share registration itself | One-command UX. Designer doesn't have to think about Metro. If they want local-dev-only (no tunnel), they still use `proto start`. The two commands coexist. |
| `designerName` from **`git config user.name`**, fallback prompt, cached in `~/.prototo/config.json` | Silent for most designers (git is already configured); one-time prompt otherwise. Override via `--as "Different Name"`. |
| Other metadata (`appName`, `screenCount`, `theme`) **derived from the project** | `appName` from `proto.config.js` `name` field. `screenCount` from a directory listing of `./screens/` filtered to `.tsx`. `theme` from `proto.config.js` `theme` field, mapped camelCase→kebab (`liquidGlass`→`liquid-glass`, `materialYou`→`material-you`). |
| Token + URL acquired by **`POST /api/share`** to `https://prototo.app/api/share` | API contract already specced + live per the share-landing design. CLI is the producer of the request payload. |
| TTL **7 days**, set server-side; client just keeps tunnel alive | Token expiry is `prototo.app`'s concern. Designer who wants to extend Ctrl+C and re-runs (new token). |
| **No auth** for Phase 3a | Matches share-landing spec. IP rate limit (10/hr) is the abuse control. `proto login` arrives with Phase 3b. |
| Lifecycle: `proto share` runs until Ctrl+C, then kills Metro + tunnel + prompt server; **no token deregister** | TTL handles cleanup. Simpler exit path. Avoids breaking links mid-window if designer stops sharing. |
| **Reuses** `ensurePrototoAppMatchesProject`, `spawnExpo`, `startPromptServer`, `messages`, `render-qr` from the existing proto-cli | Don't duplicate. The new `commands/share.ts` orchestrates these + adds the cloudflared + POST pieces. |
| **Mockable units** for tunnel, share-api, identity, metadata, cloudflared-install — each takes deps via DI | Same TDD-strict pattern as `ensure-prototo-app`. Project rule (CLAUDE.md §3) requires TDD for CLI code. |
| Subprocess invocation: `execFileSync` with arg arrays, never shell-string interpolation | Matches existing pattern in `ensure-prototo-app.ts` and project rule banning `execSync`/shell interpolation. |
| Version bump: proto-cli `0.2.0` → `0.3.0-beta.0` (minor) | `proto share` is a meaningful additive surface — minor bump per semver. Stable `0.3.0` after validation. |

## Out of scope

- `proto share --save` (Phase 3b sub-unit H — hosted snapshot upload, needs auth + storage).
- `proto login` and any account-bound features (Phase 3b sub-unit J).
- Universal-link viewer-mode handler in Prototo App (sub-unit E — separate spec).
- App Store submission of Prototo App (sub-unit F — separate work, in-flight).
- Comment pins, version history, password-protected shares (Phase 3c).
- Token revoke / list / extend CLI commands (defer until designer feedback demands them).
- Custom domains, branded sharing pages (Team tier, Phase 3c).
- Deregister-on-exit (TTL-based cleanup is enough).

## Architecture

### Flow diagram

```
Designer's Mac                                       prototo.app                      Stakeholder's iPhone
────────────────────────────────────────────         ─────────────────────            ─────────────────────
$ proto share
  │
  ├─ readDesignerName()
  │   - --as <name> CLI flag (highest priority)
  │   - ~/.prototo/config.json cached value
  │   - git config user.name
  │   - else prompt + persist to ~/.prototo/config.json
  │
  ├─ readProjectMetadata(cwd)
  │   - proto.config.js → { name, theme }
  │   - listing of ./screens/*.tsx → screenCount
  │   - map theme: liquidGlass → liquid-glass
  │
  ├─ ensurePrototoAppMatchesProject()            ← reused from start.ts
  ├─ startPromptServer (port 3001)               ← reused from start.ts
  ├─ spawnExpo (Metro on :8081)                  ← reused from start.ts
  │
  ├─ ensureCloudflared()
  │   - check ~/.prototo/cloudflared/cloudflared
  │   - if missing: npm `cloudflared` package fetches binary
  │
  ├─ startCloudflareTunnel(localPort=8081)
  │   - spawn `cloudflared tunnel --url http://localhost:8081`
  │   - parse stdout for the trycloudflare.com URL (timeout 30s)
  │   - return { tunnelUrl, kill }
  │
  ├─ POST https://prototo.app/api/share ────────►│ Edge runtime
  │   body: {                                    │   validate (zod)
  │     designerName, appName, screenCount,      │   rate-limit (10/hr/IP)
  │     theme, tunnelUrl                         │   generate token (Crockford b32 5-char)
  │   }                                          │   SET share:<token> EX 604800
  │                              ◄───────────────│ 201 { token, url, expiresAt }
  │
  ├─ render terminal output (matches master doc §8.1 mockup):
  │   ◆ Prototo
  │   │
  │   ◇ Starting tunnel...
  │   ◇ Your prototype is live
  │   │ prototo.app/p/xk92m
  │   │
  │   ◇ Scan to open on any device:
  │   │ [QR code]
  │   │
  │   ◇ Stakeholders need the Prototo app to view this.
  │   │ prototo.app/p/xk92m shows download instructions.
  │   │
  │   └ Keep Prototo running while they view it.
  │
  ├─ keep Metro + tunnel + prompt server alive ──┐
  │   on SIGINT: kill all three                  │ Stakeholder taps prototo.app/p/xk92m
  │                                              │   ↓
  │                                              │ GET /p/xk92m → server reads KV → render
  │                                              │   ↓
  │                                              │ Universal link (when F + E land) → Prototo opens
  │                                              │   - Prototo reads token from URL
  │                                              │   - GET /api/share/xk92m → tunnelUrl
  │                                              │   - load Metro bundle from tunnelUrl ──────► back to Mac's Metro
```

### Unit breakdown

Each unit small, single-responsibility, DI-friendly. Roughly mirrors the `ensure-prototo-app` pattern (Phase 2 helper).

| Unit | What it does | Dependencies |
|---|---|---|
| `commands/share.ts` | Orchestrator. Wires `share` subcommand. Mirrors `commands/start.ts` shape; adds 4 steps after Metro spawn. | Everything below + reused start-flow modules. |
| `designer-identity.ts` | `getDesignerName({ run, configRoot, prompt, cliOverride })` | `node:fs`, `run` dep for invoking `git config`, `@clack/prompts` (or the prompt lib proto-cli uses). |
| `project-metadata.ts` | `readProjectMetadata(cwd)` → `{ appName, screenCount, theme }` | `node:fs`, `node:path`, `require()` for `proto.config.js`. |
| `ensure-cloudflared.ts` | `ensureCloudflared({ cacheRoot, fetch, log })` → path-to-binary. Checks system-installed `cloudflared` first; falls back to `cloudflared` npm package's `bin` export which manages download + caching. | `cloudflared` npm package (new dep), `node:fs`, `node:os`. |
| `tunnel-cloudflare.ts` | `startCloudflareTunnel({ localPort, cloudflaredPath, spawn, log })` → `{ tunnelUrl: Promise<string>, kill: () => Promise<void> }`. Scrapes stdout for `https://*.trycloudflare.com`. 30s timeout. | `spawn` dep (subprocess factory; production default is `node:child_process` `spawn`). |
| `share-api.ts` | `createShare(body, { fetch, baseUrl }) → ShareCreateResponse`. Optional `lookupShare(token)` exported for tests. Zod schemas duplicated from share-landing `lib/share.ts`. `baseUrl` defaults to `https://prototo.app`, overridable via `PROTO_SHARE_API_BASE` env var (for dev). | global `fetch`, `zod`. |

Reused from existing proto-cli (no changes): `ensure-prototo-app.ts`, `expo-spawn.ts`, `prompt-server.ts`, `render-qr.ts`, `messages.ts` (extended), `error-translation.ts` (extended).

### Lifecycle shape

```
proto share start:
  1. readDesignerName       (may prompt, persists to ~/.prototo/config.json)
  2. readProjectMetadata    (synchronous file reads)
  3. ensurePrototoAppMatchesProject  (boots Sim, installs Prototo if needed)
  4. startPromptServer      (port 3001, reused)
  5. spawnExpo              (Metro on :8081, reused — same --dev-client --scheme prototo --ios flags)
  6. ensureCloudflared      (binary on disk, downloads if needed)
  7. startCloudflareTunnel  (tunnel URL ready)
  8. share-api.createShare  (token + share URL)
  9. render terminal output + QR
  10. wait for SIGINT

proto share stop (SIGINT):
  kill cloudflared
  kill expo (Metro)
  kill prompt-server
  exit 0
```

### Why we don't deregister tokens on exit

KV TTL (7 days) does the cleanup. Deregistering on exit would:
1. Cost a round trip on SIGINT (annoying if network is slow at the moment).
2. Break the "link is alive for 7 days" expectation — if the stakeholder taps mid-day after the designer killed the share, they'd hit a 404 vs. seeing the install page (which is more helpful — they can install Prototo and try again when designer's online).
3. Require auth (anyone could DELETE someone else's token by guessing).

Letting the TTL expire keeps the page useful for the full window.

## File changes

### New files in `packages/proto-cli/src/`

| Path | Responsibility | LOC est. |
|---|---|---|
| `commands/share.ts` | Orchestrator. Mirrors `commands/start.ts` + 4 new steps. Wires `--as <name>` flag. | ~150 |
| `commands/share.test.ts` | Tests orchestrator wiring (each dep invoked with right args, error paths cause clean exit). Mocks all underlying units. | ~80 |
| `designer-identity.ts` | `getDesignerName` — CLI override → cached → git → prompt-and-persist. | ~50 |
| `designer-identity.test.ts` | All 4 sources covered; persistence verified; trims whitespace; rejects empty/too-long names per the share-api 60-char limit. | ~70 |
| `project-metadata.ts` | `readProjectMetadata(cwd)` → `{ appName, screenCount, theme }`. | ~40 |
| `project-metadata.test.ts` | Happy paths + missing `proto.config.js` + missing `screens/` + unknown theme value (defaults to `liquid-glass`, logs warning via injected log). | ~60 |
| `ensure-cloudflared.ts` | `ensureCloudflared` → binary path. Uses `cloudflared` npm package `bin` export; caches under `~/.prototo/cloudflared/`. | ~40 |
| `ensure-cloudflared.test.ts` | Cache hit, cache miss → download, network failure → designer-friendly message. | ~50 |
| `tunnel-cloudflare.ts` | `startCloudflareTunnel` — spawn + stdout-parse + kill. 30s timeout. | ~70 |
| `tunnel-cloudflare.test.ts` | URL parsing happy + variants; timeout path; kill cleanly shuts down child. | ~60 |
| `share-api.ts` | `createShare` + `lookupShare`. Zod schemas duplicated from share-landing. `PROTO_SHARE_API_BASE` env override. Designer-facing error mapping. | ~80 |
| `share-api.test.ts` | Happy + each error code mapped + body validation + env-var override. | ~80 |

### Modified files in `packages/proto-cli/src/`

| Path | Change |
|---|---|
| `cli.ts` | Register the new `share` subcommand: `proto share [--as <name>]`. Wire to `runShare` from `commands/share.ts`. |
| `messages.ts` | New designer-facing strings: `shareStarting`, `shareTunnelStarting`, `shareLive` (template with token URL), `shareScanCopy`, `shareKeepRunning`, `shareDesignerNamePrompt`, `shareRateLimited`, `shareApiUnreachable`, `shareTunnelFailed`. |
| `messages.test.ts` | Asserts each new key + Expo Go guard still passes. |
| `error-translation.ts` | Add mappings for cloudflared failures and `share-api` HTTP errors. |
| `error-translation.test.ts` | Cover the new mappings. |

### Modified files in `packages/proto-cli/`

| Path | Change |
|---|---|
| `package.json` | New runtime dep: `cloudflared@^0.5.x`. Version bump `0.2.0` → `0.3.0-beta.0`. |

### Modified files in `packages/create-proto/`

| Path | Change |
|---|---|
| `template/package.json` | Bump `@sherizan/proto-cli` pin to `^0.3.0-beta.0`. |
| `package.json` | Workspace dep bump + version `0.2.0` → `0.3.0-beta.0`. |
| `template/CLAUDE.md` | One-line entry under §"Building blocks" mentioning `proto share` for stakeholder sharing. |
| `template/README.md` | Add `Run proto share to send a live link.` between the existing `proto start` and `proto add` lines. |
| `src/messages.ts` | `howToRestart`: add a third line mentioning `npx proto share`. |

### Modified files in `docs/`

| Path | Change |
|---|---|
| `docs/proto-master.md` | §9 already covers `proto share`; add an implementation reference pointing at this spec + a decisions-log entry. |
| `docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md` | Add a one-line "Consumer" annotation at the top noting this spec is the producer of `POST /api/share`. |

### Files NOT changed in this spec

- `apps/prototo-app/` — `proto share` works against the **existing** Prototo App build. Prototo's viewer-mode handler is **sub-unit E** (separate spec).
- `apps/prototo-app/eas.json` — production submit config (for F) is already filled in.
- Any other Phase 2 files. The `proto start` flow is unchanged; `proto share` adds a sibling command.

## Designer-facing copy (excerpt — full list in `messages.ts`)

Following CLAUDE.md §1 — no stack traces, no engineering jargon, no internal URLs in error messages.

| Key | Value |
|---|---|
| `shareStarting` | `'Setting up your share…'` |
| `shareTunnelStarting` | `'Starting tunnel…'` |
| `shareLive(url)` | `'Your prototype is live\n  ' + url` |
| `shareScanCopy` | `'Scan to open on any device:'` |
| `shareKeepRunning` | `'Keep Prototo running while they view it.'` |
| `shareDesignerNamePrompt` | `'What should we call you when sharing prototypes?'` |
| `shareRateLimited` | `"You've shared a lot recently. Try again in an hour."` |
| `shareApiUnreachable` | `"Can't reach Prototo's share service. Check your internet and try again."` |
| `shareTunnelFailed` | `"Couldn't start the share tunnel. Run proto share again to retry."` |

## API contract (consumer-side; matches share-landing spec)

`POST https://prototo.app/api/share`

Request body (validated by zod in `share-api.ts`):
```ts
{
  designerName: string  // 1..60 chars
  appName: string       // 1..60 chars
  screenCount: number   // integer 0..999
  theme: 'liquid-glass' | 'material-you'
  tunnelUrl: string     // https URL
}
```

Success response (201):
```ts
{
  token: string       // 5-char Crockford b32
  url: string         // https://prototo.app/p/<token>
  expiresAt: string   // ISO 8601
}
```

Errors:
- `400` invalid body → `shareApiUnreachable`-style designer copy with a generic "Something looked off in your project" hint.
- `429` rate limit → `shareRateLimited`.
- `5xx` or network failure → `shareApiUnreachable`.

CLI prints `url` + renders QR via the existing `render-qr.ts`.

## Definition of done

- [ ] `commands/share.ts` exists; `proto share` is a registered subcommand
- [ ] `proto share` from a fresh `npm create proto@next <name>` (or `@latest` once 0.3.0 ships) end-to-end:
  - boots Simulator + installs Prototo if needed (reused `ensure-prototo-app`)
  - starts Metro on :8081 + prompt server on :3001
  - downloads `cloudflared` binary on first run, caches under `~/.prototo/cloudflared/`
  - starts a tunnel, parses the `https://*.trycloudflare.com` URL
  - POSTs to `https://prototo.app/api/share` with the right payload (designerName, appName, screenCount, theme, tunnelUrl)
  - prints the master-doc terminal layout: header → "Your prototype is live" → URL → QR → keep-running hint
  - Ctrl+C cleanly kills cloudflared + Metro + prompt server
- [ ] Visiting the printed `prototo.app/p/<token>` URL on a desktop browser renders the share-landing page with the right metadata (designer name, app name, screen count, theme)
- [ ] Visiting the same URL on iPhone with Prototo App installed loads the prototype via the tunnel — bundle loads without "Cannot find native module" errors
- [ ] Designer-name sourcing: `git config user.name` works silently when set; first-run prompt appears + persists to `~/.prototo/config.json` when git is unset; `--as "Different Name"` overrides; the persisted name is read on subsequent runs (no re-prompt)
- [ ] All new units have TDD-style tests (red → green) with injected deps; ≥95% line coverage on `share-api.ts`, `designer-identity.ts`, `project-metadata.ts`, `ensure-cloudflared.ts`, `tunnel-cloudflare.ts`
- [ ] `commands/share.test.ts` covers the orchestrator wiring + error paths (each underlying unit can fail independently and the orchestrator handles it gracefully)
- [ ] `pnpm --filter @sherizan/proto-cli test` passes
- [ ] `pnpm --filter create-proto test` passes
- [ ] Designer-facing copy contains zero engineering jargon — no raw URLs of internal services, no `cloudflared` mentions, no HTTP error codes
- [ ] Rate-limit response (429) shows `shareRateLimited`
- [ ] Offline / DNS failure shows `shareApiUnreachable`
- [ ] Tunnel failure shows `shareTunnelFailed`
- [ ] Commit + push as a feature branch (`feat/proto-share`), PR-reviewed before merge
- [ ] Published as `@sherizan/proto-cli@0.3.0-beta.0` and `create-proto@0.3.0-beta.0` under npm `next` tag
- [ ] End-to-end validation: scaffold a fresh `/tmp/share-test` project from `@next`, `proto share` it, scan QR on iPhone, confirm Prototo opens (when F lands; until then the manual sideload scheme path is enough for validation)
- [ ] After validation, bump to stable `0.3.0` (drop `-beta` suffix), republish under `latest`

## Open risks

1. **Cloudflare Quick Tunnel subdomain rotation.** Each run gets a new `*.trycloudflare.com` URL. Fine for the 7-day share window because the token is the stable identifier (tunnel URL stored in the share record, looked up at viewer time). But if the designer Ctrl+Cs and re-runs `proto share` within the 7-day window, the new tunnel URL won't match the old share record. **Mitigation:** `proto share` always creates a fresh token. Designers who restart get a new link. Old links point at a dead tunnel — stakeholder sees the page but Prototo App times out connecting. Acceptable for Phase 3a; Phase 3b hosted-snapshot replaces this dynamic entirely.

2. **The `cloudflared` npm package quality.** It's maintained, but smaller surface than ngrok's. If it ever lags Cloudflare protocol changes, we'd need to fall back to system `cloudflared` (via `brew install`). **Mitigation:** `ensureCloudflared` checks system-installed first, then npm-managed binary. Logged in the translation layer if a fallback is taken.

3. **Metro accessible publicly through the tunnel.** Anyone with the tunnel URL can hit Metro directly (not just via the share token + Prototo App). Metro serves the JS bundle, which IS the prototype — readable JS, no secrets, but the designer's project source is effectively exposed. **Mitigation:** documented as a known limit. Phase 3b hosted snapshots solve this properly (bundle uploaded, not streamed live). Acceptable risk for Phase 3a.

4. **Cloudflare service outage.** If `trycloudflare.com` is down or restricted on the designer's network, `proto share` fails. **Mitigation:** failure message points the designer at the docs. No automatic fallback to a different transport (doubles the testing surface).

5. **Designer with no git installed.** Falls through to the prompt path silently — `git config user.name` errors are caught by `designer-identity.ts` and treated as "not set." Verified in tests.

6. **Zod added as a runtime dep on proto-cli.** Small (~12KB gzipped) but it's a new third-party surface. Could be replaced with a hand-rolled validator if size becomes a concern. Won't matter for v1.

7. **Race between Metro readiness and tunnel start.** `cloudflared` will start the tunnel even if Metro isn't ready yet on :8081 — first stakeholder request would hit a 502. **Mitigation:** wait for Metro readiness signal before printing the share URL (`expo-spawn` already exposes readiness via stdout; reuse that signal). If Metro never becomes ready, surface `shareTunnelFailed`.

## Build sequence (for the implementation plan)

1. `share-api.ts` + tests — pure HTTP client, no I/O elsewhere. Easiest to unit-test first.
2. `project-metadata.ts` + tests — pure file reads.
3. `designer-identity.ts` + tests.
4. `ensure-cloudflared.ts` + tests.
5. `tunnel-cloudflare.ts` + tests.
6. `messages.ts` + `error-translation.ts` additions + tests.
7. `commands/share.ts` orchestrator + tests (mocks all 5 units).
8. `cli.ts` wires the subcommand.
9. `cloudflared` runtime dep added, lockfile updated, `pnpm install`.
10. Manual end-to-end: scaffold fresh project, `proto share`, verify on desktop browser + sideloaded Prototo.
11. Version bumps, build, publish to `next` tag.
12. Validate `npm create proto@next` flow end-to-end on a fresh checkout.

Estimated effort: **2–3 days** with focused work. The orchestrator and tests carry most of the time; the individual units are small.
