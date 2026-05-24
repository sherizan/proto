# Phase 3 — Decomposition

> Date: 2026-05-24. Status: planning. Source of truth: `docs/proto-master.md` §8.
> Purpose: break Phase 3 into independently specced sub-units, identify dependencies, recommend build order, pick the first unit to brainstorm.

## What Phase 3 is

One sentence: a designer runs one command, a stakeholder opens a link on their phone, sees the real native prototype in Proto App. No web fallback ever.

Three tiers per master doc §8:

- **3a — Tunnel sharing (free, synchronous).** Designer's Mac must stay running.
- **3b — Hosted snapshots (Pro $12/mo, async).** Snapshot uploaded to cloud, designer's Mac not required.
- **3c — Comments + Team dashboard (Team $29/mo).** Pins, sync, password-protected shares, version history.

## Where Phase 2 leaves us

- `@sherizan/proto-cli` 0.1.10 — commands today: `start`, `design`, `new-screen`, `reset`. No `share`, `snapshot`, `export`, `remove`, `login`.
- `apps/proto-app` — Expo dev client, bundle ID `com.sherizan.proto`, scheme `proto://`. Distribution is `internal` (sideload). Renders a static welcome screen; no deep-link routing, no viewer mode, no snapshot loading.
- No web app, no domain wiring, no auth, no billing, no cloud storage.

## Sub-units

Every row is something that could be specced and built on its own. "Tier" maps to the master-doc sub-phase. "Depends on" lists hard prerequisites.

| # | Sub-unit | Tier | Depends on | Notes |
|---|---|---|---|---|
| A | Domain wiring — `prototo.app` DNS → Vercel, root + `/p/*` routes | 3a | — | **Done 2026-05-24.** prototo.app live on Vercel. |
| B | `prototo.app` landing page — root marketing + `/p/<token>` share page | 3a | A | Next.js on Vercel. App Store button + universal-link fallback. No web preview of the prototype. |
| C | Token routing service — maps `<token>` → tunnel URL + metadata | 3a | A | Could be a Next.js API route + Vercel KV / Upstash. ~50 LOC. |
| D | `proto share` CLI command — tunnel + token registration + QR | 3a | C | Open question: ngrok / Cloudflare Tunnel / Expo's built-in `--tunnel`. |
| E | Proto App viewer mode + universal link / scheme handler | 3a | B, D | Adds a router that splits "creator mode" (scan project QR from `proto start`) vs "viewer mode" (open share link). |
| F | **Proto App on App Store** — public distribution, not sideload | 3a (blocker) | — | Hard prerequisite for non-technical stakeholders to install. Review 1–7 days. Should start in parallel with everything else. |
| G | `proto snapshot "<name>"` — local named version | 3b | — | Pure file copy, no cloud. Low risk; could ship earlier. |
| H | Hosted snapshot upload — `proto share --save` → R2 / Vercel Blob | 3b | C, J, K | Bundle screens/components/DESIGN.md/manifest.json (~2–5MB). |
| I | `proto export` — engineer handoff bundle (HANDOFF.md + screens + components) | 3b | — | Local only, no cloud. Can ship anytime. |
| J | Auth / accounts — Clerk or Auth.js | 3b | A | Backs `proto login`, hosted snapshots, billing, dashboard. |
| K | Stripe subscriptions — Pro & Team tiers, webhook → entitlement | 3b | J | Standard Stripe Checkout + customer portal. |
| L | `proto login` — device-flow auth, store token in macOS keychain | 3b | J | Replaces the deferred Phase 2 `proto login`. |
| M | Snapshot metering & expiry — 3 active / 7-day on free, etc. | 3b | H, K | Cron + DB columns. |
| N | prototo.app dashboard — list snapshots, share links, billing | 3b | J, H | Authenticated Next.js area. |
| O | `proto remove <screen-name>` | 3a-3b housekeeping | — | Listed in master doc §9 but missing. Small. |
| P | Comment layer in Proto App — pin-drop UI | 3c | E | Stakeholder-side UI in viewer mode. |
| Q | Comment sync service — store comments per snapshot | 3c | H, J | Pairs with P. |
| R | Team dashboard on prototo.app — orgs, member management | 3c | J, K, N | Multi-user N. |
| S | Password-protected shares | 3c | C, B | Token routing checks password before serving. |
| T | Version history — snapshot list per project, restore | 3c | H, N | Extension of N. |

## Dependency graph (compressed)

```
F (App Store) ─────────────────── parallel track ─────────────┐
                                                              ↓
A → B ─→ E ────────────────────────────→ [3a end-to-end usable]
    ↓    ↑
    C ───┘
    ↑
    D

G, I, O ─ local-only, slot in anytime ────────────────────────┐
                                                              ↓
J → L                                                         │
J → K → M ────→ N                                             │
H needs C+J+K                                                 │
       ↓                                                      │
       N (metering) ───────────────→ [3b complete]            │
                                                              ↓
P → Q ─→ R ─→ S ─→ T ─────────────→ [3c complete]
```

## Risks worth naming now

1. **F (App Store) is the secret long-pole.** Phase 3a is technically demoable on a sideloaded build, but the master doc's promise — *stakeholder downloads Proto App from a link and sees the prototype* — depends on Proto being on the App Store. Apple review is 1–7 days and can reject. **Start F in parallel with A immediately.**
2. **Tunnel transport choice** has long-tail consequences (cost, reliability, URL shape). Worth a focused decision before D is specced. Candidates: ngrok (paid for stable subdomains), Cloudflare Tunnel (free, more setup), Expo `--tunnel` (free, uses ngrok under the hood, less control).
3. **Universal links vs `proto://` scheme.** Universal links (`prototo.app/p/xk92m` opens Proto App directly) require an `apple-app-site-association` file served from `prototo.app` and a correctly-signed App Store build. `proto://` works on sideloaded builds but is uglier and asks the user "Open in Proto?". Decision belongs in E.
4. **Storage shape for snapshot bundles** (Cloudflare R2 vs Vercel Blob). R2 is cheaper at scale, Vercel Blob is closer to the rest of our infra. Decide before H.
5. **Auth provider** (Clerk vs Auth.js). Clerk is faster to ship, costlier. Auth.js is open-source, more setup. Decide before J.

## Recommended build order

**Track 1 — Phase 3a usable end-to-end (target: ~2–3 weeks):**

1. **F** — submit current Proto App to App Store (parallel, starts day 1).
2. ~~**A** — domain wiring.~~ ✅ Done 2026-05-24 (Vercel).
3. **B** — landing page skeleton (root + `/p/<token>` page, hard-coded data).
4. **C** — token routing service (Next.js API + Vercel KV).
5. **D** — `proto share` CLI command + tunnel.
6. **E** — Proto App viewer mode + universal link / scheme handler.
7. End-to-end QA on real device once F approves.

**Track 2 — Local-only tools (slot in alongside Track 1, no dependencies):**

- **O** — `proto remove`.
- **G** — `proto snapshot` (local-only version first; cloud upload comes in 3b).
- **I** — `proto export`.

**Track 3 — Phase 3b (after 3a is live):**

8. **J** — auth.
9. **K** — Stripe.
10. **L** — `proto login`.
11. **H** — hosted snapshot upload (extends G).
12. **M** — metering & expiry.
13. **N** — dashboard.

**Track 4 — Phase 3c (after 3b stabilises):** P → Q → R → S → T.

## Recommended first unit to spec

**B — `prototo.app` landing page**, paired with the F (App Store submission) prep checklist.

Why this and not D (`proto share` CLI):

- B is the surface every stakeholder will see first. Designing it forces decisions about share-link format, App Store messaging, universal-link behaviour, and what metadata the token must carry — all of which then constrain C and D, not the other way around.
- B can ship and be load-tested with hard-coded data before C exists.
- D depends on the token format, which falls out of B+C.

If you'd rather front-load the CLI side (and let the web side catch up), **D + C** as a pair is the alternative — that lets you demo `proto share` to yourself end-to-end against a sideloaded Proto App before B is pretty.

## Open questions for the user before brainstorming the first unit

1. Does Track 1's ordering match your priorities, or do you want to demo the CLI side first?
2. Are you ready to start the App Store submission now? (It's a real-world delay, not engineering work.)
3. Tunnel transport preference, or leave to D's brainstorm?
4. Auth provider preference, or leave to J's brainstorm?
