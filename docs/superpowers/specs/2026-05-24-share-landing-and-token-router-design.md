# Share Landing Page + Token Routing Service — Design

> Date: 2026-05-24. Status: design draft.
> Phase 3a sub-units **B + C** from `2026-05-24-phase-3-decomposition.md`. Bundled into one spec because the page has nothing to render without the router, and the router has no consumer without the page.
> Code lives in the **`sherizan/prototo-website`** repo (local checkout: `/Users/sherizan/Public/prototo`). Spec lives here in the Proto repo to keep all Proto design canonical in one place.

## Goal

A stakeholder taps a `prototo.app/p/<token>` link. If Prototo App is installed, iOS routes them directly into the app. If not, they see a tight install page with the master-doc-mocked copy, an App Store CTA, and nothing else. Designer's Mac is running the tunnel; this spec only handles routing and the install-prompt surface.

## Why this scope

- B (page) and C (router) are too tightly coupled to spec separately — the page is just a view of the router's data.
- Shipping them together lets us test the share flow end-to-end with a hand-crafted token before any CLI work (D) lands.
- Keeps the spec small (~150 LOC of page, ~80 LOC of API + KV plumbing).

## Locked decisions

| Decision | Reason |
|---|---|
| Storage: **Vercel KV** (Upstash Redis under the hood) | Free tier covers ~30k commands/day. Native Vercel integration, edge-runtime compatible. No separate auth needed. Matches "rest of the infra is on Vercel." Use whichever client the current Vercel marketplace integration ships (`@vercel/kv` or `@upstash/redis` direct — confirm at implementation time, Vercel has shifted this twice). |
| Token shape: **5-char Crockford base32** (excludes I, L, O, U) | ~33M combinations. Unambiguous to read aloud. Matches master-doc example `xk92m`. |
| TTL: **7 days** from creation, Redis-level (`EX 604800`) | Matches master-doc CLI mockup ("Link expires in 7 days"). Auto-cleanup, no cron. |
| **No auth** for Phase 3a creates | Free tier is anonymous. Accounts arrive with 3b. IP rate limit (10 creates/hr) covers casual abuse. |
| **Universal-link primary + `proto://` scheme fallback** | Universal links blocked on F (App Store build with `associatedDomains`) — ship the AASA file now so E doesn't need a follow-up PR. Scheme fallback keeps sideloaded builds working today. |
| **Edge runtime** for all routes + KV access | Lower latency, no cold start, matches Vercel KV's pattern. |
| **No web preview of the prototype** | Master-doc principle. "Anticipation of seeing the real thing on device is the feature." |
| **Spec lives in the proto repo, code in prototo-website repo** | Specs stay canonical in one place; code lives where it deploys. Same pattern as `apps/prototo-app/`. |

## Out of scope

- The tunnel itself + `proto share` CLI (sub-unit D).
- Prototo App's deep-link handler / viewer mode (sub-unit E).
- App Store submission + `associatedDomains` entitlement (sub-unit F).
- Per-share analytics (Google Analytics already covers `prototo.app` globally; nothing snapshot-specific yet).
- Token revocation UI (`DELETE` route deferred — defer until usage shows we need it).
- Hosted snapshot bundles, accounts, billing (Phase 3b).
- Comments, version history, password protection (Phase 3c).
- Generating QR codes on the CLI side — `proto-cli/src/render-qr.ts` already exists; D will reuse it.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Designer's Mac (Phase 3a, sub-unit D — out of scope here)   │
│   proto share                                                │
│     → starts tunnel                                          │
│     → POST /api/share { designerName, appName, screens,      │
│                         theme, tunnelUrl }                   │
│     → receives { token, url, expiresAt }                     │
│     → renders QR of url, keeps Mac process alive             │
└─────────────────────────────────────────────────────────────┘
                              │ POST
                              ▼
        ┌──────────────────────────────────────────────────┐
        │ prototo.app (this spec)                          │
        │   /api/share                  → create + return  │
        │   /api/share/[token]          → metadata lookup  │
        │   /p/[token]                  → page (3 states)  │
        │   /.well-known/apple-app-site-association        │
        │                                                  │
        │   Vercel KV                                      │
        │     share:<token> → JSON, TTL 7d                 │
        │     ratelimit:create:<ip> → counter, TTL 1h      │
        └──────────────────────────────────────────────────┘
                              │ GET /p/<token>
                              ▼
        ┌──────────────────────────────────────────────────┐
        │ Stakeholder's phone                              │
        │   iOS + Prototo App + universal-link live          │
        │     → iOS routes straight into Prototo App          │
        │   iOS, no Prototo App                              │
        │     → page renders install prompt                 │
        │   Desktop / Android                              │
        │     → page renders + QR of same URL               │
        │   Invalid / expired token                        │
        │     → 404 page                                    │
        └──────────────────────────────────────────────────┘
```

## File layout (new files in `prototo-website`)

```
app/
  p/
    [token]/
      page.tsx              ← server component, reads KV directly, renders 3 states
      not-found.tsx         ← invalid / expired token page
  api/
    share/
      route.ts              ← POST: create share
      [token]/
        route.ts            ← GET: lookup share
lib/
  share.ts                  ← KV client + token gen + zod schemas + types
  rate-limit.ts             ← IP-based rate limiter (KV-backed)
public/
  .well-known/
    apple-app-site-association   ← static JSON (Next.js serves verbatim from /public)
```

No changes to existing `app/page.tsx`, `app/home-page.tsx`, or `app/layout.tsx`.

## Data model

```ts
// lib/share.ts
import { z } from "zod";

export const ThemeEnum = z.enum(["liquid-glass", "material-you"]);

export const ShareCreateInput = z.object({
  designerName: z.string().min(1).max(60),
  appName: z.string().min(1).max(60),
  screenCount: z.number().int().min(0).max(999),
  theme: ThemeEnum,
  tunnelUrl: z.string().url().startsWith("https://"),
});

export type ShareCreateInput = z.infer<typeof ShareCreateInput>;

export type ShareRecord = ShareCreateInput & {
  token: string;
  createdAt: string; // ISO 8601
  expiresAt: string; // ISO 8601 (createdAt + 7d)
};

export type ShareCreateResponse = {
  token: string;
  url: string; // https://prototo.app/p/<token>
  expiresAt: string;
};

export type ShareLookupResponse = Omit<ShareRecord, "token">;
```

**KV keys:**

| Key | Value | TTL |
|---|---|---|
| `share:<token>` | `ShareRecord` (JSON-encoded) | 604800s (7d) |
| `ratelimit:create:<ip-hash>` | integer (count) | 3600s (1h) |

IPs hashed (sha-256, no salt — best-effort PII reduction; we don't pretend KV is private).

## API contracts

### `POST /api/share`

**Request:**
```json
{
  "designerName": "Sheri",
  "appName": "Atlas",
  "screenCount": 7,
  "theme": "liquid-glass",
  "tunnelUrl": "https://abc123.ngrok.app"
}
```

**Success — 201:**
```json
{
  "token": "xk92m",
  "url": "https://prototo.app/p/xk92m",
  "expiresAt": "2026-05-31T18:42:00.000Z"
}
```

**Errors:**
- `400` invalid body (zod errors, plain-language messages).
- `429` rate limit exceeded (`Retry-After` header).
- `500` KV unreachable.

**Behaviour:**
1. Validate body via zod.
2. Rate-limit check: `INCR ratelimit:create:<ip-hash>`. If > 10, return 429.
3. Generate token. Retry up to 5x on `NX` collision.
4. `SET share:<token> <JSON> EX 604800 NX`.
5. Return `{ token, url, expiresAt }`.

### `GET /api/share/[token]`

**Success — 200:**
```json
{
  "designerName": "Sheri",
  "appName": "Atlas",
  "screenCount": 7,
  "theme": "liquid-glass",
  "tunnelUrl": "https://abc123.ngrok.app",
  "createdAt": "2026-05-24T18:42:00.000Z",
  "expiresAt": "2026-05-31T18:42:00.000Z"
}
```

**Errors:**
- `404` token unknown or expired.
- `400` token shape invalid (not 5-char Crockford base32).

**Behaviour:**
1. Validate token shape (regex).
2. `GET share:<token>`. If null, 404.
3. Return body.

No caching headers — KV is fast, and stale data would mean linking to a dead tunnel.

## Page — `/p/[token]`

Server component. Reads KV **directly** (same edge runtime — no internal HTTP hop). Three render states.

### State 1: iOS + Prototo App installed

When universal links are live (post-F), iOS intercepts the URL before the page is fetched and routes straight into Prototo App. The page only renders if iOS fails to route (rare: clearing default app, opening from search results, refresh after tap-out). In those cases, render State 2 — the address-bar app affordance is enough.

### State 2: iOS, no Prototo App

Master-doc mockup, verbatim:

```
[proto mark]

[Designer name] shared a prototype with you.

[App name] · [N] screens · [Theme] theme

[Download Proto on the App Store]

After installing, this link opens automatically.
```

Implementation:
- Theme label: `liquid-glass` → "Liquid Glass", `material-you` → "Material You".
- "[Download Proto on the App Store]" — uses live App Store URL once F lands. Until then: button disabled, secondary copy *"Proto launches on the App Store soon."* Configured via `process.env.NEXT_PUBLIC_APP_STORE_URL` (empty = disabled state).
- Hidden fallback link `<a href="proto://open/<token>">` rendered below the App Store button, only when `NEXT_PUBLIC_DEV_LINK === "true"`. Lets the team test sideloaded builds without polluting the stakeholder UX.

### State 3: Desktop / Android

Same heading + metadata line + App Store CTA. Below it:
- QR code (server-side rendered SVG via `qrcode` npm package) of the same URL.
- One-liner: *Open on an iPhone running iOS 26+.*

Detection via `User-Agent` parsed in the server component (Next 14 supports `headers()`). UA-sniff is good enough — we're not authorising on it, just choosing copy.

### State 4: Invalid / expired token

Returned from `not-found.tsx` (Next's convention). Triggered by calling `notFound()` from the page when KV returns null.

```
[proto mark]

This share link isn't active.

The designer may need to run `proto share` again.
```

HTTP 404 (Next handles this for `not-found.tsx`). No indexing.

## Universal-link config

### `public/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "<APPLE_TEAM_ID>.com.sherizan.prototo",
        "paths": [ "/p/*" ]
      }
    ]
  }
}
```

- `<APPLE_TEAM_ID>` filled in from Apple Developer account before merge.
- Served from `/public/.well-known/` so Next.js delivers it verbatim with `Content-Type: application/json` (Vercel auto-detects; we add `vercel.json` override if not).
- Doesn't take effect until Prototo App ships with `associatedDomains: ["applinks:prototo.app"]` entitlement (in sub-unit E + F). Until then, the file is inert — no harm.

### `vercel.json` addition

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/.well-known/apple-app-site-association",
      "headers": [
        { "key": "Content-Type", "value": "application/json" }
      ]
    }
  ]
}
```

## Visual design

Existing tokens only — no new colours, no new fonts:

- **Font:** Geist Sans for body, Geist Mono for the deep-link debug fallback.
- **Background:** `bg-white`.
- **Text:** `text-proto-ink` for headings, `text-proto-secondary` for metadata line, `text-proto-muted` for sub-copy.
- **CTA button:** existing `CopyButton` styling — `rounded-btn bg-proto-ink text-white`. Adapt to App Store link.
- **Layout:** reuse `NarrowContainer` (`max-w-[680px]`) from `home-page.tsx`. No nav, no footer on share pages — the page is single-purpose, no distractions.
- **Proto mark:** lift `ProtoMark` SVG from `home-page.tsx` into a shared `app/components/proto-mark.tsx` so both pages use the same source.

## Testing

This is a Next.js app + a thin API + a KV. Tests need to be cheap and useful.

| Layer | Tool | What we test |
|---|---|---|
| `lib/share.ts` | Vitest | Token generator shape, zod validation, rate-limit counter logic. |
| API routes | Vitest + `@vercel/kv` mock | Happy path + rate limit + collision retry + 404. |
| Page | Playwright (manual) | Each render state with a hand-seeded KV entry. Run locally; no CI for now. |
| AASA | curl | `curl -I https://prototo.app/.well-known/apple-app-site-association` returns 200 + `application/json`. |

**Not yet:** CI, E2E in CI, visual regression. Add when the page has a real consumer (D ships).

## Open follow-ups (out of this spec, tracked for later)

1. **Token-format type sharing.** `ShareCreateInput` will be needed identically by `proto-cli` (sub-unit D). Either duplicate, or extract `@sherizan/prototo-types` later. Defer until D's spec.
2. **Universal-link verification once F ships.** Run Apple's [Branch Test Tool](https://branch.io/resources/aasa-validator/) or `swcutil` on the live AASA file. Add to F's checklist, not this one.
3. **Rate-limit ceiling.** 10/hr/IP is a guess. Revisit if D's beta testers hit it.
4. **Master doc roadmap numbering.** The prototo-website home page lists "Phase 4 — Share + Scale (prototo.app)", but the proto repo master doc calls it Phase 3. Reconcile before B is publicly demoed.

## Build sequence (for the implementation plan)

1. `lib/share.ts` — types, zod schemas, token gen. Unit-tested first.
2. `lib/rate-limit.ts` — KV-backed counter. Unit-tested.
3. `POST /api/share` route. Test against KV (or mock).
4. `GET /api/share/[token]` route. Test.
5. `app/p/[token]/page.tsx` — start with State 2 (iOS no app), then add 3 (desktop/Android) and 4 (404).
6. `app/components/proto-mark.tsx` — extract shared SVG.
7. `public/.well-known/apple-app-site-association` + `vercel.json` headers.
8. Manual end-to-end test: seed a KV record via curl, hit the page on iOS and desktop.

Estimated effort: **1–2 days** with focused work. Most of the time goes to the page's 3 states and getting the AASA file deployed cleanly.
