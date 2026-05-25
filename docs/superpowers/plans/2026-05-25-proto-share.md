# `proto share` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `proto share` subcommand to proto-cli that starts Metro + a Cloudflare Quick Tunnel + registers a `prototo.app/p/<token>` share link, then keeps the Mac alive until Ctrl+C.

**Architecture:** Six new mockable units in `packages/proto-cli/src/` (`share-api`, `project-metadata`, `designer-identity`, `ensure-cloudflared`, `tunnel-cloudflare`, `commands/share`) plus three reused modules (`ensure-prototo-app`, `expo-spawn`, `prompt-server`). Order of operations in the orchestrator is fail-fast: read identity + metadata + ensure binary first, then start Metro + tunnel + register. Standalone command — `proto start` continues to work for local-only flows.

**Tech Stack:** TypeScript ESM, Vitest (TDD), Node 18+, `cloudflared` npm wrapper for the tunnel binary, `zod` for HTTP body validation. Subprocess invocation via `execFileSync` with arg arrays — never shell-string interpolation.

**Spec:** `docs/superpowers/specs/2026-05-25-proto-share-design.md`

---

## File map

**Files to create in `packages/proto-cli/src/`:**

- `share-api.ts` — HTTP client + zod schemas
- `share-api.test.ts`
- `project-metadata.ts` — read `proto.config.js` + screen count
- `project-metadata.test.ts`
- `designer-identity.ts` — git config → cache → prompt resolution
- `designer-identity.test.ts`
- `ensure-cloudflared.ts` — resolve binary path (system or npm-managed)
- `ensure-cloudflared.test.ts`
- `tunnel-cloudflare.ts` — start tunnel + scrape stdout for URL
- `tunnel-cloudflare.test.ts`
- `commands/share.ts` — orchestrator
- `commands/share.test.ts`

**Files to modify in `packages/proto-cli/src/`:**

- `cli.ts` — register `share` subcommand + HELP entry
- `messages.ts` — add 9 new keys
- `messages.test.ts` — assert new keys
- `error-translation.ts` — add tunnel-failure + api-failure mappings
- `error-translation.test.ts` — cover new mappings

**Files to modify in `packages/proto-cli/`:**

- `package.json` — add `cloudflared` + `zod` runtime deps; version bump to `0.3.0-beta.0`

**Files to modify in `packages/create-proto/`:**

- `template/package.json` — pin `@sherizan/proto-cli` to `^0.3.0-beta.0`
- `package.json` — version bump to `0.3.0-beta.0` + workspace dep bump
- `template/CLAUDE.md` — one-line `proto share` mention under Building blocks
- `template/README.md` — add `Run proto share to send a live link.`
- `src/messages.ts` — `howToRestart` gains a `proto share` line

**Files to modify in `docs/`:**

- `docs/proto-master.md` — decisions-log entry for `proto share` shipping
- `docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md` — one-line "Consumer" annotation

---

## Conventions for this plan

- **Working directory** for shell commands: `/Users/sherizan/Public/proto` unless stated.
- **Branch**: all work on `feat/proto-share` (created in Task 1).
- **Test runner**: `pnpm --filter @sherizan/proto-cli test` from project root.
- **Commit cadence**: one commit per task. Imperative subject. Co-Authored-By trailer.
- **TDD ordering**: failing test first, run RED, implement, run GREEN, commit.
- **Subprocess pattern**: always `execFileSync(cmd, [args...])`. Never `execSync` or shell-string templates.

---

## Task 1: Branch + runtime deps + initial version bump

**Files:**
- Modify: `packages/proto-cli/package.json` (deps + version)

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feat/proto-share
```

Expected: `Switched to a new branch 'feat/proto-share'`.

- [ ] **Step 2: Add runtime deps to `packages/proto-cli/package.json`**

Open the file. Inside `"dependencies"`, add (preserve alphabetical sort):

```json
    "cloudflared": "^0.5.3",
    "zod": "^3.23.8",
```

Bump the `version` field:

```json
  "version": "0.3.0-beta.0",
```

(Previous value was `0.2.0`.)

- [ ] **Step 3: Install + verify**

```bash
pnpm install 2>&1 | tail -3
```

Expected: lockfile updates without error. Pre-existing peer warnings (react-native@0.74.0 vs >=0.82.0) are unrelated and can be ignored.

- [ ] **Step 4: Confirm cloudflared binary is reachable**

```bash
node -e "console.log(require('cloudflared').bin)"
```

Expected: prints a path ending in `/cloudflared` under `node_modules/cloudflared/`. If the binary hasn't been downloaded yet, the package's postinstall handles it on first import — that's fine, just confirm the wrapper is installed.

- [ ] **Step 5: Tests still pass**

```bash
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
```

Expected: all existing 103 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/proto-cli/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(proto-cli): add cloudflared + zod deps, bump to 0.3.0-beta.0

Stages the proto-share feature. Cloudflared wraps the Quick Tunnels
binary; zod validates the share-api HTTP body.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `share-api.ts` — HTTP client + zod schemas (TDD)

**Files:**
- Create: `packages/proto-cli/src/share-api.ts`
- Create: `packages/proto-cli/src/share-api.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `packages/proto-cli/src/share-api.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  createShare,
  lookupShare,
  SHARE_API_BASE_DEFAULT,
  ShareApiError,
  type ShareCreateInput,
} from './share-api.js';

const VALID_INPUT: ShareCreateInput = {
  designerName: 'Sheri',
  appName: 'Atlas',
  screenCount: 7,
  theme: 'liquid-glass',
  tunnelUrl: 'https://abc.trycloudflare.com',
};

const VALID_RESPONSE = {
  token: 'xk92m',
  url: 'https://prototo.app/p/xk92m',
  expiresAt: '2026-06-01T00:00:00.000Z',
};

describe('SHARE_API_BASE_DEFAULT', () => {
  it('points at the prototo.app production host', () => {
    expect(SHARE_API_BASE_DEFAULT).toBe('https://prototo.app');
  });
});

describe('createShare', () => {
  it('POSTs to /api/share with the JSON body and returns the parsed response', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => VALID_RESPONSE,
    })) as unknown as typeof fetch;

    const result = await createShare(VALID_INPUT, { fetch: fetchSpy });

    expect(result).toEqual(VALID_RESPONSE);
    const [url, init] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://prototo.app/api/share');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(VALID_INPUT);
  });

  it('honours PROTO_SHARE_API_BASE env override', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => VALID_RESPONSE,
    })) as unknown as typeof fetch;

    await createShare(VALID_INPUT, { fetch: fetchSpy, baseUrl: 'https://staging.prototo.app' });
    const [url] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://staging.prototo.app/api/share');
  });

  it('throws ShareApiError with kind="rate-limited" on 429', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      name: 'ShareApiError',
      kind: 'rate-limited',
    });
  });

  it('throws ShareApiError with kind="bad-input" on 400', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'bad-input',
    });
  });

  it('throws ShareApiError with kind="server" on 5xx', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'server',
    });
  });

  it('throws ShareApiError with kind="network" when fetch rejects', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('ENOTFOUND prototo.app');
    }) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('rejects locally on invalid input before fetching', async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    await expect(
      createShare(
        { ...VALID_INPUT, designerName: '' } as ShareCreateInput,
        { fetch: fetchSpy },
      ),
    ).rejects.toThrow();
    expect((fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('rejects when the server returns a body that does not match the schema', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ token: 'xk92m' }), // missing url + expiresAt
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'bad-response',
    });
  });
});

describe('lookupShare', () => {
  it('GETs /api/share/<token> and returns the parsed response', async () => {
    const body = {
      designerName: 'Sheri',
      appName: 'Atlas',
      screenCount: 7,
      theme: 'liquid-glass' as const,
      tunnelUrl: 'https://abc.trycloudflare.com',
      createdAt: '2026-05-25T00:00:00.000Z',
      expiresAt: '2026-06-01T00:00:00.000Z',
    };
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => body,
    })) as unknown as typeof fetch;

    const result = await lookupShare('xk92m', { fetch: fetchSpy });
    expect(result).toEqual(body);
    const [url] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://prototo.app/api/share/xk92m');
  });

  it('throws ShareApiError with kind="not-found" on 404', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @sherizan/proto-cli test -- share-api 2>&1 | tail -5
```

Expected: tests fail with `Cannot find module './share-api.js'`.

- [ ] **Step 3: Implement `share-api.ts`**

Create `packages/proto-cli/src/share-api.ts`:

```ts
import { z } from 'zod';

export const SHARE_API_BASE_DEFAULT = 'https://prototo.app';

export const ThemeEnum = z.enum(['liquid-glass', 'material-you']);

export const ShareCreateInputSchema = z.object({
  designerName: z.string().min(1).max(60),
  appName: z.string().min(1).max(60),
  screenCount: z.number().int().min(0).max(999),
  theme: ThemeEnum,
  tunnelUrl: z.string().url().startsWith('https://'),
});

export const ShareCreateResponseSchema = z.object({
  token: z.string().min(1).max(20),
  url: z.string().url(),
  expiresAt: z.string().min(1),
});

export const ShareLookupResponseSchema = z.object({
  designerName: z.string(),
  appName: z.string(),
  screenCount: z.number(),
  theme: ThemeEnum,
  tunnelUrl: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export type ShareCreateInput = z.infer<typeof ShareCreateInputSchema>;
export type ShareCreateResponse = z.infer<typeof ShareCreateResponseSchema>;
export type ShareLookupResponse = z.infer<typeof ShareLookupResponseSchema>;

export type ShareApiErrorKind =
  | 'network'
  | 'bad-input'
  | 'rate-limited'
  | 'not-found'
  | 'server'
  | 'bad-response';

export class ShareApiError extends Error {
  readonly kind: ShareApiErrorKind;
  constructor(kind: ShareApiErrorKind, message: string) {
    super(message);
    this.name = 'ShareApiError';
    this.kind = kind;
  }
}

export type ShareApiOptions = {
  fetch?: typeof fetch;
  baseUrl?: string;
};

function resolveBaseUrl(opts: ShareApiOptions): string {
  if (opts.baseUrl) return opts.baseUrl;
  const env = process.env.PROTO_SHARE_API_BASE;
  return env && env.length > 0 ? env : SHARE_API_BASE_DEFAULT;
}

export async function createShare(
  input: ShareCreateInput,
  opts: ShareApiOptions = {},
): Promise<ShareCreateResponse> {
  const parsed = ShareCreateInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ShareApiError('bad-input', 'Invalid share input');
  }

  const fetchFn = opts.fetch ?? fetch;
  const baseUrl = resolveBaseUrl(opts);
  const url = `${baseUrl}/api/share`;

  let res: Response;
  try {
    res = (await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })) as Response;
  } catch {
    throw new ShareApiError('network', 'Could not reach the share service');
  }

  if (res.status === 429) throw new ShareApiError('rate-limited', 'Rate limited');
  if (res.status === 400) throw new ShareApiError('bad-input', 'Server rejected payload');
  if (res.status >= 500) throw new ShareApiError('server', `Server error ${res.status}`);
  if (!res.ok) throw new ShareApiError('server', `Unexpected status ${res.status}`);

  let bodyJson: unknown;
  try {
    bodyJson = await res.json();
  } catch {
    throw new ShareApiError('bad-response', 'Response was not JSON');
  }

  const bodyParsed = ShareCreateResponseSchema.safeParse(bodyJson);
  if (!bodyParsed.success) {
    throw new ShareApiError('bad-response', 'Response did not match schema');
  }
  return bodyParsed.data;
}

export async function lookupShare(
  token: string,
  opts: ShareApiOptions = {},
): Promise<ShareLookupResponse> {
  const fetchFn = opts.fetch ?? fetch;
  const baseUrl = resolveBaseUrl(opts);
  const url = `${baseUrl}/api/share/${encodeURIComponent(token)}`;

  let res: Response;
  try {
    res = (await fetchFn(url)) as Response;
  } catch {
    throw new ShareApiError('network', 'Could not reach the share service');
  }

  if (res.status === 404) throw new ShareApiError('not-found', 'Share token not found');
  if (res.status >= 500) throw new ShareApiError('server', `Server error ${res.status}`);
  if (!res.ok) throw new ShareApiError('server', `Unexpected status ${res.status}`);

  let bodyJson: unknown;
  try {
    bodyJson = await res.json();
  } catch {
    throw new ShareApiError('bad-response', 'Response was not JSON');
  }

  const bodyParsed = ShareLookupResponseSchema.safeParse(bodyJson);
  if (!bodyParsed.success) {
    throw new ShareApiError('bad-response', 'Response did not match schema');
  }
  return bodyParsed.data;
}
```

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @sherizan/proto-cli test -- share-api 2>&1 | tail -5
```

Expected: all share-api tests pass.

- [ ] **Step 5: Run full suite**

```bash
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/proto-cli/src/share-api.ts packages/proto-cli/src/share-api.test.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): share-api HTTP client + zod schemas

Consumer-side for prototo.app /api/share. Validates input + response,
maps HTTP errors to ShareApiError kinds (network, bad-input,
rate-limited, not-found, server, bad-response). PROTO_SHARE_API_BASE
env var overrides the production host for dev.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `project-metadata.ts` — read project name, theme, screen count (TDD)

**Files:**
- Create: `packages/proto-cli/src/project-metadata.ts`
- Create: `packages/proto-cli/src/project-metadata.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/proto-cli/src/project-metadata.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readProjectMetadata, mapTheme } from './project-metadata.js';

function makeProject(opts: {
  name?: string;
  theme?: string;
  screens?: string[];
  withoutConfig?: boolean;
  withoutScreensDir?: boolean;
}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-share-meta-'));
  if (!opts.withoutConfig) {
    fs.writeFileSync(
      path.join(dir, 'proto.config.js'),
      `module.exports = ${JSON.stringify({
        name: opts.name ?? 'Atlas',
        theme: opts.theme ?? 'liquidGlass',
      })};`,
    );
  }
  if (!opts.withoutScreensDir) {
    fs.mkdirSync(path.join(dir, 'screens'));
    for (const s of opts.screens ?? ['Home.tsx', 'Settings.tsx']) {
      fs.writeFileSync(path.join(dir, 'screens', s), '');
    }
  }
  return dir;
}

describe('mapTheme', () => {
  it('liquidGlass -> liquid-glass', () => {
    expect(mapTheme('liquidGlass')).toBe('liquid-glass');
  });
  it('materialYou -> material-you', () => {
    expect(mapTheme('materialYou')).toBe('material-you');
  });
  it('passes through already-kebab values', () => {
    expect(mapTheme('liquid-glass')).toBe('liquid-glass');
    expect(mapTheme('material-you')).toBe('material-you');
  });
  it('falls back to liquid-glass on unknown', () => {
    expect(mapTheme('something-weird')).toBe('liquid-glass');
  });
});

describe('readProjectMetadata', () => {
  let dir: string;
  afterEach(() => {
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads name + theme from proto.config.js and counts .tsx in /screens', () => {
    dir = makeProject({ name: 'Atlas', theme: 'liquidGlass', screens: ['Home.tsx', 'Settings.tsx', 'About.tsx'] });
    const meta = readProjectMetadata(dir);
    expect(meta).toEqual({ appName: 'Atlas', screenCount: 3, theme: 'liquid-glass' });
  });

  it('ignores non-tsx files in /screens', () => {
    dir = makeProject({ screens: ['Home.tsx', 'README.md', 'thumbnail.png', 'Settings.tsx'] });
    const meta = readProjectMetadata(dir);
    expect(meta.screenCount).toBe(2);
  });

  it('returns screenCount=0 when /screens is empty', () => {
    dir = makeProject({ screens: [] });
    expect(readProjectMetadata(dir).screenCount).toBe(0);
  });

  it('returns screenCount=0 when /screens is missing', () => {
    dir = makeProject({ withoutScreensDir: true });
    expect(readProjectMetadata(dir).screenCount).toBe(0);
  });

  it('throws when proto.config.js is missing', () => {
    dir = makeProject({ withoutConfig: true });
    expect(() => readProjectMetadata(dir)).toThrow();
  });

  it('maps theme: materialYou -> material-you', () => {
    dir = makeProject({ theme: 'materialYou' });
    expect(readProjectMetadata(dir).theme).toBe('material-you');
  });

  it('falls back to liquid-glass when theme is unset', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-share-meta-'));
    fs.writeFileSync(path.join(d, 'proto.config.js'), `module.exports = { name: 'X' };`);
    fs.mkdirSync(path.join(d, 'screens'));
    dir = d;
    expect(readProjectMetadata(d).theme).toBe('liquid-glass');
  });
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @sherizan/proto-cli test -- project-metadata 2>&1 | tail -3
```

Expected: fails with module-not-found.

- [ ] **Step 3: Implement `project-metadata.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export type Theme = 'liquid-glass' | 'material-you';

export type ProjectMetadata = {
  appName: string;
  screenCount: number;
  theme: Theme;
};

const KNOWN_THEMES: Record<string, Theme> = {
  liquidGlass: 'liquid-glass',
  'liquid-glass': 'liquid-glass',
  materialYou: 'material-you',
  'material-you': 'material-you',
};

export function mapTheme(input: unknown): Theme {
  if (typeof input !== 'string') return 'liquid-glass';
  return KNOWN_THEMES[input] ?? 'liquid-glass';
}

function loadProtoConfig(cwd: string): { name?: unknown; theme?: unknown } {
  const candidates = ['proto.config.js', 'proto.config.cjs', 'proto.config.mjs'];
  for (const name of candidates) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) {
      const req = createRequire(path.join(cwd, 'noop.js'));
      const mod = req(p);
      return (mod && typeof mod === 'object' ? mod : {}) as { name?: unknown; theme?: unknown };
    }
  }
  throw new Error('proto.config.js not found');
}

function countScreens(cwd: string): number {
  const dir = path.join(cwd, 'screens');
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith('.tsx')).length;
}

export function readProjectMetadata(cwd: string): ProjectMetadata {
  const cfg = loadProtoConfig(cwd);
  const rawName = typeof cfg.name === 'string' ? cfg.name.trim() : '';
  if (!rawName) throw new Error('proto.config.js missing "name"');
  return {
    appName: rawName,
    screenCount: countScreens(cwd),
    theme: mapTheme(cfg.theme),
  };
}
```

- [ ] **Step 4: Run GREEN + full suite**

```bash
pnpm --filter @sherizan/proto-cli test -- project-metadata 2>&1 | tail -3
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/project-metadata.ts packages/proto-cli/src/project-metadata.test.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): project-metadata reader

Reads name + theme from proto.config.js, counts .tsx files in
/screens, normalises theme camelCase->kebab. Used by the share-api
payload.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `designer-identity.ts` — git → cache → prompt (TDD)

**Files:**
- Create: `packages/proto-cli/src/designer-identity.ts`
- Create: `packages/proto-cli/src/designer-identity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/proto-cli/src/designer-identity.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDesignerName, type IdentityDeps } from './designer-identity.js';

function makeConfigRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'proto-identity-'));
}

function makeDeps(overrides: Partial<IdentityDeps>): IdentityDeps {
  return {
    run: () => '',
    prompt: async () => '',
    configRoot: '',
    ...overrides,
  };
}

describe('getDesignerName', () => {
  let configRoot: string;
  beforeEach(() => {
    configRoot = makeConfigRoot();
  });
  afterEach(() => {
    if (fs.existsSync(configRoot)) fs.rmSync(configRoot, { recursive: true, force: true });
  });

  it('uses --as CLI override first, ignoring everything else', async () => {
    const name = await getDesignerName({
      cliOverride: 'CLI Sheri',
      deps: makeDeps({ configRoot, run: () => 'git Sheri', prompt: async () => 'prompt Sheri' }),
    });
    expect(name).toBe('CLI Sheri');
  });

  it('reads cached name from ~/.prototo/config.json second', async () => {
    fs.mkdirSync(path.join(configRoot, '.prototo'), { recursive: true });
    fs.writeFileSync(
      path.join(configRoot, '.prototo', 'config.json'),
      JSON.stringify({ designerName: 'Cached Sheri' }),
    );
    const name = await getDesignerName({
      deps: makeDeps({ configRoot, run: () => 'git Sheri', prompt: async () => 'prompt Sheri' }),
    });
    expect(name).toBe('Cached Sheri');
  });

  it('reads git config user.name third + persists it to config.json', async () => {
    const name = await getDesignerName({
      deps: makeDeps({
        configRoot,
        run: (cmd, args) => {
          if (cmd === 'git' && args.join(' ') === 'config user.name') return 'Git Sheri\n';
          return '';
        },
        prompt: async () => 'prompt Sheri',
      }),
    });
    expect(name).toBe('Git Sheri');
    const persisted = JSON.parse(
      fs.readFileSync(path.join(configRoot, '.prototo', 'config.json'), 'utf8'),
    );
    expect(persisted.designerName).toBe('Git Sheri');
  });

  it('prompts when git is empty + persists the prompted value', async () => {
    const name = await getDesignerName({
      deps: makeDeps({
        configRoot,
        run: () => '', // git returns empty
        prompt: async () => 'Prompted Sheri',
      }),
    });
    expect(name).toBe('Prompted Sheri');
    const persisted = JSON.parse(
      fs.readFileSync(path.join(configRoot, '.prototo', 'config.json'), 'utf8'),
    );
    expect(persisted.designerName).toBe('Prompted Sheri');
  });

  it('prompts when git throws (no git installed)', async () => {
    const name = await getDesignerName({
      deps: makeDeps({
        configRoot,
        run: () => {
          throw new Error('git: command not found');
        },
        prompt: async () => 'No-git Sheri',
      }),
    });
    expect(name).toBe('No-git Sheri');
  });

  it('trims whitespace from the resolved name', async () => {
    const name = await getDesignerName({
      deps: makeDeps({ configRoot, run: () => '  Sheri  \n' }),
    });
    expect(name).toBe('Sheri');
  });

  it('rejects empty name from prompt by re-prompting (loops once for test simplicity)', async () => {
    let promptCalls = 0;
    const name = await getDesignerName({
      deps: makeDeps({
        configRoot,
        run: () => '',
        prompt: async () => {
          promptCalls += 1;
          return promptCalls === 1 ? '   ' : 'Eventually Sheri';
        },
      }),
    });
    expect(name).toBe('Eventually Sheri');
    expect(promptCalls).toBe(2);
  });

  it('truncates names longer than 60 chars (share-api ceiling)', async () => {
    const longName = 'A'.repeat(120);
    const name = await getDesignerName({
      cliOverride: longName,
      deps: makeDeps({ configRoot }),
    });
    expect(name.length).toBe(60);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @sherizan/proto-cli test -- designer-identity 2>&1 | tail -3
```

Expected: module-not-found.

- [ ] **Step 3: Implement `designer-identity.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const MAX_LEN = 60;

export type RunCommand = (cmd: string, args: string[]) => string;
export type PromptFn = (message: string) => Promise<string>;

export type IdentityDeps = {
  run: RunCommand;
  prompt: PromptFn;
  configRoot: string;
};

export type IdentityOptions = {
  cliOverride?: string;
  deps?: Partial<IdentityDeps>;
};

const defaultRun: RunCommand = (cmd, args) =>
  execFileSync(cmd, args, { stdio: 'pipe' }).toString();

const defaultPrompt: PromptFn = async () => {
  // Minimal stdin reader. Replaced with @clack/prompts in commands/share.ts at call site.
  return '';
};

function defaultConfigRoot(): string {
  return os.homedir();
}

function configFilePath(configRoot: string): string {
  return path.join(configRoot, '.prototo', 'config.json');
}

function readCached(configRoot: string): string | null {
  try {
    const raw = fs.readFileSync(configFilePath(configRoot), 'utf8');
    const obj = JSON.parse(raw) as { designerName?: unknown };
    return typeof obj.designerName === 'string' ? obj.designerName.trim() : null;
  } catch {
    return null;
  }
}

function persistCached(configRoot: string, designerName: string): void {
  const dir = path.dirname(configFilePath(configRoot));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configFilePath(configRoot), JSON.stringify({ designerName }, null, 2));
}

function tryGit(run: RunCommand): string | null {
  try {
    const out = run('git', ['config', 'user.name']);
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function clamp(name: string): string {
  return name.length > MAX_LEN ? name.slice(0, MAX_LEN) : name;
}

export async function getDesignerName(opts: IdentityOptions = {}): Promise<string> {
  const deps: IdentityDeps = {
    run: opts.deps?.run ?? defaultRun,
    prompt: opts.deps?.prompt ?? defaultPrompt,
    configRoot: opts.deps?.configRoot ?? defaultConfigRoot(),
  };

  if (opts.cliOverride && opts.cliOverride.trim().length > 0) {
    return clamp(opts.cliOverride.trim());
  }

  const cached = readCached(deps.configRoot);
  if (cached) return clamp(cached);

  const fromGit = tryGit(deps.run);
  if (fromGit) {
    const value = clamp(fromGit);
    persistCached(deps.configRoot, value);
    return value;
  }

  // Prompt loop; reject empty
  for (;;) {
    const ans = (await deps.prompt('What should we call you when sharing prototypes? ')).trim();
    if (ans.length > 0) {
      const value = clamp(ans);
      persistCached(deps.configRoot, value);
      return value;
    }
  }
}
```

- [ ] **Step 4: GREEN + full suite**

```bash
pnpm --filter @sherizan/proto-cli test -- designer-identity 2>&1 | tail -3
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/designer-identity.ts packages/proto-cli/src/designer-identity.test.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): designer-identity resolver

Order: --as CLI override -> ~/.prototo/config.json -> git config
user.name -> prompt + persist. Trims whitespace, clamps to 60 chars
(share-api ceiling), loops the prompt on empty input.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `ensure-cloudflared.ts` — resolve binary path (TDD)

**Files:**
- Create: `packages/proto-cli/src/ensure-cloudflared.ts`
- Create: `packages/proto-cli/src/ensure-cloudflared.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/proto-cli/src/ensure-cloudflared.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureCloudflared, type EnsureCloudflaredDeps } from './ensure-cloudflared.js';

function makeRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'proto-cflared-'));
}

function makeDeps(overrides: Partial<EnsureCloudflaredDeps>): EnsureCloudflaredDeps {
  return {
    which: () => null,
    npmBinPath: () => null,
    log: () => {},
    ...overrides,
  };
}

describe('ensureCloudflared', () => {
  let root: string;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('prefers a system-installed cloudflared on PATH', async () => {
    const sysPath = path.join(root, 'usr-bin-cloudflared');
    fs.writeFileSync(sysPath, '');
    const out = await ensureCloudflared({
      deps: makeDeps({
        which: () => sysPath,
        npmBinPath: () => path.join(root, 'npm-cloudflared'),
      }),
    });
    expect(out).toBe(sysPath);
  });

  it('falls back to the npm-managed binary when no system install', async () => {
    const npmPath = path.join(root, 'npm-cloudflared');
    fs.writeFileSync(npmPath, '');
    const out = await ensureCloudflared({
      deps: makeDeps({
        which: () => null,
        npmBinPath: () => npmPath,
      }),
    });
    expect(out).toBe(npmPath);
  });

  it('throws when neither system nor npm-managed path is usable', async () => {
    await expect(
      ensureCloudflared({
        deps: makeDeps({ which: () => null, npmBinPath: () => null }),
      }),
    ).rejects.toThrow();
  });

  it('throws when npm path is reported but file does not exist', async () => {
    await expect(
      ensureCloudflared({
        deps: makeDeps({ which: () => null, npmBinPath: () => path.join(root, 'missing') }),
      }),
    ).rejects.toThrow();
  });

  it('logs which path was chosen', async () => {
    const sysPath = path.join(root, 'sys');
    fs.writeFileSync(sysPath, '');
    const logs: string[] = [];
    await ensureCloudflared({
      deps: makeDeps({
        which: () => sysPath,
        log: (m) => logs.push(m),
      }),
    });
    expect(logs.some((m) => m.toLowerCase().includes('cloudflared'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @sherizan/proto-cli test -- ensure-cloudflared 2>&1 | tail -3
```

Expected: module-not-found.

- [ ] **Step 3: Implement `ensure-cloudflared.ts`**

```ts
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export type EnsureCloudflaredDeps = {
  which: () => string | null;
  npmBinPath: () => string | null;
  log: (message: string) => void;
};

export type EnsureCloudflaredOptions = {
  deps?: Partial<EnsureCloudflaredDeps>;
};

const defaultWhich = (): string | null => {
  try {
    const out = execFileSync('which', ['cloudflared'], { stdio: 'pipe' }).toString().trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
};

const defaultNpmBinPath = (): string | null => {
  try {
    // The `cloudflared` npm package exports `bin` (a string path) once the postinstall completes.
    const mod = require('cloudflared') as { bin?: string };
    return typeof mod.bin === 'string' ? mod.bin : null;
  } catch {
    return null;
  }
};

export async function ensureCloudflared(opts: EnsureCloudflaredOptions = {}): Promise<string> {
  const deps: EnsureCloudflaredDeps = {
    which: opts.deps?.which ?? defaultWhich,
    npmBinPath: opts.deps?.npmBinPath ?? defaultNpmBinPath,
    log: opts.deps?.log ?? (() => {}),
  };

  const sys = deps.which();
  if (sys && fs.existsSync(sys)) {
    deps.log(`cloudflared: using system binary at ${sys}`);
    return sys;
  }

  const npmPath = deps.npmBinPath();
  if (npmPath && fs.existsSync(npmPath)) {
    deps.log(`cloudflared: using npm-managed binary at ${npmPath}`);
    return npmPath;
  }

  throw new Error('cloudflared binary not available');
}
```

- [ ] **Step 4: GREEN + full suite**

```bash
pnpm --filter @sherizan/proto-cli test -- ensure-cloudflared 2>&1 | tail -3
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/ensure-cloudflared.ts packages/proto-cli/src/ensure-cloudflared.test.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): ensure-cloudflared binary resolver

System install on PATH first; falls back to the npm-managed binary
that the `cloudflared` package's postinstall downloads. Logs the
choice via the injected log dep.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `tunnel-cloudflare.ts` — start tunnel + scrape stdout (TDD)

**Files:**
- Create: `packages/proto-cli/src/tunnel-cloudflare.ts`
- Create: `packages/proto-cli/src/tunnel-cloudflare.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/proto-cli/src/tunnel-cloudflare.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { startCloudflareTunnel, parseCloudflareUrl, type TunnelDeps } from './tunnel-cloudflare.js';

describe('parseCloudflareUrl', () => {
  it('extracts the trycloudflare.com URL from typical stdout', () => {
    const sample = [
      '2026-05-25T12:00:00Z INF +-------------------------------------------+',
      '2026-05-25T12:00:00Z INF | https://orange-fox-92.trycloudflare.com   |',
      '2026-05-25T12:00:00Z INF +-------------------------------------------+',
    ].join('\n');
    expect(parseCloudflareUrl(sample)).toBe('https://orange-fox-92.trycloudflare.com');
  });

  it('ignores other https URLs in the output', () => {
    const sample = 'Some preamble https://example.com/x and https://abc.trycloudflare.com/y after';
    expect(parseCloudflareUrl(sample)).toBe('https://abc.trycloudflare.com');
  });

  it('returns null when no trycloudflare URL is present', () => {
    expect(parseCloudflareUrl('just noise')).toBe(null);
  });

  it('strips trailing path/query if present', () => {
    expect(parseCloudflareUrl('https://abc.trycloudflare.com/foo?bar=1 trailing'))
      .toBe('https://abc.trycloudflare.com');
  });
});

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill(signal?: NodeJS.Signals): boolean {
    this.killed = true;
    setTimeout(() => this.emit('exit', 0, signal ?? 'SIGTERM'), 0);
    return true;
  }
}

function makeDeps(child: FakeChild): TunnelDeps {
  return {
    spawn: () => child as unknown as ReturnType<TunnelDeps['spawn']>,
    timeoutMs: 1000,
    log: () => {},
  };
}

describe('startCloudflareTunnel', () => {
  it('resolves tunnelUrl when cloudflared prints the URL on stdout', async () => {
    const child = new FakeChild();
    const handle = startCloudflareTunnel({
      localPort: 8081,
      cloudflaredPath: '/tmp/cf',
      deps: makeDeps(child),
    });

    setTimeout(() => {
      child.stdout.emit(
        'data',
        Buffer.from('https://blue-otter-42.trycloudflare.com listening'),
      );
    }, 10);

    const url = await handle.tunnelUrl;
    expect(url).toBe('https://blue-otter-42.trycloudflare.com');
  });

  it('resolves when the URL arrives on stderr (cloudflared writes there)', async () => {
    const child = new FakeChild();
    const handle = startCloudflareTunnel({
      localPort: 8081,
      cloudflaredPath: '/tmp/cf',
      deps: makeDeps(child),
    });

    setTimeout(() => {
      child.stderr.emit('data', Buffer.from('https://red-cat-1.trycloudflare.com'));
    }, 10);

    const url = await handle.tunnelUrl;
    expect(url).toBe('https://red-cat-1.trycloudflare.com');
  });

  it('rejects on timeout when no URL appears', async () => {
    const child = new FakeChild();
    const handle = startCloudflareTunnel({
      localPort: 8081,
      cloudflaredPath: '/tmp/cf',
      deps: makeDeps(child),
    });
    await expect(handle.tunnelUrl).rejects.toThrow(/timeout/i);
  });

  it('kill() sends SIGTERM to the child and resolves', async () => {
    const child = new FakeChild();
    const handle = startCloudflareTunnel({
      localPort: 8081,
      cloudflaredPath: '/tmp/cf',
      deps: makeDeps(child),
    });
    setTimeout(() => {
      child.stdout.emit('data', Buffer.from('https://x.trycloudflare.com'));
    }, 10);
    await handle.tunnelUrl;
    await handle.kill();
    expect(child.killed).toBe(true);
  });

  it('passes --url http://localhost:<port> to cloudflared', async () => {
    const child = new FakeChild();
    let capturedArgs: string[] = [];
    startCloudflareTunnel({
      localPort: 8181,
      cloudflaredPath: '/tmp/cf',
      deps: {
        ...makeDeps(child),
        spawn: (_cmd, args) => {
          capturedArgs = args;
          return child as unknown as ReturnType<TunnelDeps['spawn']>;
        },
      },
    });
    expect(capturedArgs).toContain('--url');
    expect(capturedArgs).toContain('http://localhost:8181');
    expect(capturedArgs[0]).toBe('tunnel');
  });
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @sherizan/proto-cli test -- tunnel-cloudflare 2>&1 | tail -3
```

Expected: module-not-found.

- [ ] **Step 3: Implement `tunnel-cloudflare.ts`**

```ts
import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

const TRYCLOUDFLARE_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

export function parseCloudflareUrl(text: string): string | null {
  const m = text.match(TRYCLOUDFLARE_REGEX);
  return m ? m[0] : null;
}

type SpawnedChild = {
  stdout: { on(event: 'data', listener: (chunk: Buffer | string) => void): void };
  stderr: { on(event: 'data', listener: (chunk: Buffer | string) => void): void };
  on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
  kill(signal?: NodeJS.Signals): boolean;
};

export type TunnelDeps = {
  spawn: (cmd: string, args: string[]) => SpawnedChild;
  timeoutMs: number;
  log: (message: string) => void;
};

export type TunnelOptions = {
  localPort: number;
  cloudflaredPath: string;
  deps?: Partial<TunnelDeps>;
};

export type TunnelHandle = {
  tunnelUrl: Promise<string>;
  kill: () => Promise<void>;
};

const DEFAULT_TIMEOUT_MS = 30_000;

const defaultSpawn = (cmd: string, args: string[]): SpawnedChild =>
  nodeSpawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }) as ChildProcessWithoutNullStreams;

export function startCloudflareTunnel(opts: TunnelOptions): TunnelHandle {
  const deps: TunnelDeps = {
    spawn: opts.deps?.spawn ?? defaultSpawn,
    timeoutMs: opts.deps?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    log: opts.deps?.log ?? (() => {}),
  };

  const args = ['tunnel', '--url', `http://localhost:${opts.localPort}`];
  const child = deps.spawn(opts.cloudflaredPath, args);

  const tunnelUrl = new Promise<string>((resolve, reject) => {
    let buffer = '';
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('cloudflared tunnel start timeout'));
      }
    }, deps.timeoutMs);

    const onData = (chunk: Buffer | string): void => {
      if (resolved) return;
      buffer += chunk.toString();
      const url = parseCloudflareUrl(buffer);
      if (url) {
        resolved = true;
        clearTimeout(timer);
        deps.log(`cloudflared: tunnel up at ${url}`);
        resolve(url);
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code, signal) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(new Error(`cloudflared exited before tunnel was ready (code=${code} signal=${signal})`));
      }
    });
  });

  return {
    tunnelUrl,
    kill: async () => {
      child.kill('SIGTERM');
    },
  };
}
```

- [ ] **Step 4: GREEN + full suite**

```bash
pnpm --filter @sherizan/proto-cli test -- tunnel-cloudflare 2>&1 | tail -3
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/tunnel-cloudflare.ts packages/proto-cli/src/tunnel-cloudflare.test.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): tunnel-cloudflare launcher

Spawns cloudflared tunnel --url http://localhost:<port>, scrapes
stdout/stderr for the trycloudflare URL, 30s timeout. kill()
sends SIGTERM. Both streams scanned because cloudflared writes
to stderr by default but tests cover both for safety.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: New messages.ts keys (TDD)

**Files:**
- Modify: `packages/proto-cli/src/messages.ts`
- Modify: `packages/proto-cli/src/messages.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `packages/proto-cli/src/messages.test.ts`, inside the existing `describe('messages — Prototo dev-client copy', ...)`:

```ts
  it('shareStarting is a brief status string', () => {
    expect(messages.shareStarting).toBe('Setting up your share…');
  });

  it('shareTunnelStarting matches master-doc mockup', () => {
    expect(messages.shareTunnelStarting).toBe('Starting tunnel…');
  });

  it('shareLive renders the share URL', () => {
    expect(messages.shareLive('https://prototo.app/p/xk92m')).toBe(
      'Your prototype is live\n  https://prototo.app/p/xk92m',
    );
  });

  it('shareScanCopy invites scanning', () => {
    expect(messages.shareScanCopy).toBe('Scan to open on any device:');
  });

  it('shareKeepRunning explains the lifecycle', () => {
    expect(messages.shareKeepRunning).toBe('Keep Prototo running while they view it.');
  });

  it('shareDesignerNamePrompt is human-friendly', () => {
    expect(messages.shareDesignerNamePrompt).toBe(
      'What should we call you when sharing prototypes?',
    );
  });

  it('shareRateLimited is a designer-friendly retry hint', () => {
    expect(messages.shareRateLimited).toBe(
      "You've shared a lot recently. Try again in an hour.",
    );
  });

  it('shareApiUnreachable says to check internet', () => {
    expect(messages.shareApiUnreachable).toBe(
      "Can't reach Prototo's share service. Check your internet and try again.",
    );
  });

  it('shareTunnelFailed tells designer to retry', () => {
    expect(messages.shareTunnelFailed).toBe(
      "Couldn't start the share tunnel. Run proto share again to retry.",
    );
  });
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @sherizan/proto-cli test -- messages 2>&1 | tail -5
```

Expected: 9 new failing assertions (`undefined`).

- [ ] **Step 3: Add the keys to `messages.ts`**

Open `packages/proto-cli/src/messages.ts`. Add these keys (placement: just below the existing `prototoSimulatorOffline` block to keep share/install copy grouped):

```ts
  shareStarting: 'Setting up your share…',
  shareTunnelStarting: 'Starting tunnel…',
  shareLive: (url: string) => `Your prototype is live\n  ${url}`,
  shareScanCopy: 'Scan to open on any device:',
  shareKeepRunning: 'Keep Prototo running while they view it.',
  shareDesignerNamePrompt: 'What should we call you when sharing prototypes?',
  shareRateLimited: "You've shared a lot recently. Try again in an hour.",
  shareApiUnreachable: "Can't reach Prototo's share service. Check your internet and try again.",
  shareTunnelFailed: "Couldn't start the share tunnel. Run proto share again to retry.",
```

- [ ] **Step 4: GREEN + full suite**

```bash
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/messages.ts packages/proto-cli/src/messages.test.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): share-flow designer-facing strings

Nine new keys for the proto share command: live-link reveal, QR
hint, rate-limit + network + tunnel failure copy, name prompt.
Tone matches the rest of messages.ts — no engineering jargon, no
URLs of internal services in error paths.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Error translation for share-api + cloudflared (TDD)

**Files:**
- Modify: `packages/proto-cli/src/error-translation.ts`
- Modify: `packages/proto-cli/src/error-translation.test.ts`

This task only applies if `error-translation.ts` actually maps errors. Inspect it first:

- [ ] **Step 1: Read the current shape**

```bash
cat packages/proto-cli/src/error-translation.ts
cat packages/proto-cli/src/error-translation.test.ts
```

- [ ] **Step 2: If the file's purpose is mapping Metro/Expo stdout strings → designer messages**, add cases for `ShareApiError.kind` and a generic cloudflared-exit pattern. Use the new messages from Task 7. Write failing tests first that exercise each new case, then implement, then GREEN, then commit. If the file is purely about Metro lines (and the orchestrator handles `ShareApiError` directly with `try/catch + log`), skip this task entirely and note in the commit log of Task 9 ("error mapping done inline in commands/share.ts; no error-translation changes needed").

- [ ] **Step 3: Commit (if changes made)**

```bash
git add packages/proto-cli/src/error-translation.ts packages/proto-cli/src/error-translation.test.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): translate share-api + cloudflared errors

ShareApiError.kind maps to designer messages from messages.ts.
Generic cloudflared exit translates to shareTunnelFailed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `commands/share.ts` orchestrator (TDD)

**Files:**
- Create: `packages/proto-cli/src/commands/share.ts`
- Create: `packages/proto-cli/src/commands/share.test.ts`

This task is the largest. The orchestrator wires every unit together. Tests mock each unit independently.

- [ ] **Step 1: Write the failing test file**

Create `packages/proto-cli/src/commands/share.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { runShare, type ShareOrchestratorDeps } from './share.js';
import { ShareApiError } from '../share-api.js';

function noopHandle() {
  return { kill: async () => {}, waitUntilExit: Promise.resolve(0) };
}

function makeDeps(overrides: Partial<ShareOrchestratorDeps>): ShareOrchestratorDeps {
  return {
    findConfig: () => ({ ok: true, root: '/tmp/p', configPath: '/tmp/p/proto.config.js' }),
    readProjectMetadata: () => ({ appName: 'Atlas', screenCount: 7, theme: 'liquid-glass' }),
    getDesignerName: async () => 'Sheri',
    killPort: async () => ({ killed: 0 }),
    startPromptServer: async () => ({ port: 3001, close: async () => {} }),
    ensurePrototoAppMatchesProject: async () => {},
    spawnExpo: () => noopHandle(),
    waitForMetroReady: async () => {},
    ensureCloudflared: async () => '/bin/cloudflared',
    startCloudflareTunnel: () => ({
      tunnelUrl: Promise.resolve('https://t.trycloudflare.com'),
      kill: async () => {},
    }),
    createShare: async () => ({
      token: 'xk92m',
      url: 'https://prototo.app/p/xk92m',
      expiresAt: '2026-06-01T00:00:00Z',
    }),
    renderQr: () => '[QR]',
    log: () => {},
    onShutdown: () => {},
    ...overrides,
  };
}

describe('runShare', () => {
  it('runs the full happy path and resolves', async () => {
    const calls: string[] = [];
    const log = (m: string): void => {
      calls.push(m);
    };
    await runShare({ cliOverride: undefined }, makeDeps({ log }));
    expect(calls.some((m) => m.includes('Setting up your share'))).toBe(true);
    expect(calls.some((m) => m.includes('Your prototype is live'))).toBe(true);
    expect(calls.some((m) => m.includes('Scan to open'))).toBe(true);
    expect(calls.some((m) => m.includes('Keep Prototo running'))).toBe(true);
  });

  it('exits cleanly when findConfig fails', async () => {
    const errors: string[] = [];
    const exit = vi.fn();
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        findConfig: () => ({ ok: false, reason: 'Not a Prototo project' }),
        log: () => {},
        exit: ((code: number) => {
          exit(code);
          throw new Error('exited');
        }) as unknown as ShareOrchestratorDeps['exit'],
        error: (m) => errors.push(m),
      }),
    ).catch(() => {});
    expect(errors.some((m) => m.includes('Not a Prototo project'))).toBe(true);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('passes --as override into getDesignerName', async () => {
    const seen: Array<string | undefined> = [];
    await runShare(
      { cliOverride: 'CLI Sheri' },
      makeDeps({
        getDesignerName: async ({ cliOverride }) => {
          seen.push(cliOverride);
          return cliOverride ?? 'fallback';
        },
      }),
    );
    expect(seen).toEqual(['CLI Sheri']);
  });

  it('POSTs the right shape to createShare', async () => {
    const seen: unknown[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        createShare: async (body) => {
          seen.push(body);
          return { token: 'xk92m', url: 'https://prototo.app/p/xk92m', expiresAt: 'x' };
        },
      }),
    );
    expect(seen[0]).toMatchObject({
      designerName: 'Sheri',
      appName: 'Atlas',
      screenCount: 7,
      theme: 'liquid-glass',
      tunnelUrl: 'https://t.trycloudflare.com',
    });
  });

  it('logs shareRateLimited when createShare throws kind="rate-limited"', async () => {
    const logs: string[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        createShare: async () => {
          throw new ShareApiError('rate-limited', 'x');
        },
        log: (m) => logs.push(m),
      }),
    ).catch(() => {});
    expect(logs.some((m) => m.includes("You've shared a lot recently"))).toBe(true);
  });

  it('logs shareApiUnreachable on network errors', async () => {
    const logs: string[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        createShare: async () => {
          throw new ShareApiError('network', 'x');
        },
        log: (m) => logs.push(m),
      }),
    ).catch(() => {});
    expect(logs.some((m) => m.includes("Can't reach Prototo's share service"))).toBe(true);
  });

  it('logs shareTunnelFailed when startCloudflareTunnel rejects', async () => {
    const logs: string[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        startCloudflareTunnel: () => ({
          tunnelUrl: Promise.reject(new Error('cloudflared timeout')),
          kill: async () => {},
        }),
        log: (m) => logs.push(m),
      }),
    ).catch(() => {});
    expect(logs.some((m) => m.includes("Couldn't start the share tunnel"))).toBe(true);
  });

  it('shuts down tunnel + expo + prompt server on shutdown signal', async () => {
    const killed = { tunnel: false, expo: false, server: false };
    let shutdownFn: (() => Promise<void>) | null = null;
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        startCloudflareTunnel: () => ({
          tunnelUrl: Promise.resolve('https://t.trycloudflare.com'),
          kill: async () => {
            killed.tunnel = true;
          },
        }),
        spawnExpo: () => ({
          kill: async () => {
            killed.expo = true;
          },
          waitUntilExit: new Promise(() => {}), // never resolves
        }),
        startPromptServer: async () => ({
          port: 3001,
          close: async () => {
            killed.server = true;
          },
        }),
        onShutdown: (fn) => {
          shutdownFn = fn;
        },
      }),
    );
    expect(shutdownFn).not.toBeNull();
    await shutdownFn!();
    expect(killed).toEqual({ tunnel: true, expo: true, server: true });
  });
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @sherizan/proto-cli test -- commands/share 2>&1 | tail -5
```

Expected: module-not-found.

- [ ] **Step 3: Implement `commands/share.ts`**

```ts
import { messages } from '../messages.js';
import { findConfig as defaultFindConfig, type ConfigLookup } from '../find-config.js';
import { startPromptServer as defaultStartPromptServer, type ServerHandle } from '../prompt-server.js';
import { spawnExpo as defaultSpawnExpo, type ExpoHandle } from '../expo-spawn.js';
import { makeKillPort } from '../kill-port.js';
import { ensurePrototoAppMatchesProject as defaultEnsurePrototoApp } from '../ensure-prototo-app.js';
import { readProjectMetadata as defaultReadProjectMetadata, type ProjectMetadata } from '../project-metadata.js';
import { getDesignerName as defaultGetDesignerName } from '../designer-identity.js';
import { ensureCloudflared as defaultEnsureCloudflared } from '../ensure-cloudflared.js';
import { startCloudflareTunnel as defaultStartCloudflareTunnel, type TunnelHandle } from '../tunnel-cloudflare.js';
import { createShare as defaultCreateShare, ShareApiError, type ShareCreateResponse } from '../share-api.js';
import { renderQr as defaultRenderQr } from '../render-qr.js';

export type ShareOrchestratorDeps = {
  findConfig: (cwd: string) => ConfigLookup;
  readProjectMetadata: (cwd: string) => ProjectMetadata;
  getDesignerName: (opts: { cliOverride?: string }) => Promise<string>;
  killPort: (port: number) => Promise<{ killed: number }>;
  startPromptServer: (opts: { port?: number }) => Promise<ServerHandle>;
  ensurePrototoAppMatchesProject: (opts: {
    cwd: string;
    deps?: { log?: (m: string) => void };
  }) => Promise<void>;
  spawnExpo: (opts: { cwd: string }) => ExpoHandle;
  waitForMetroReady: (handle: ExpoHandle) => Promise<void>;
  ensureCloudflared: () => Promise<string>;
  startCloudflareTunnel: (opts: { localPort: number; cloudflaredPath: string }) => TunnelHandle;
  createShare: (body: {
    designerName: string;
    appName: string;
    screenCount: number;
    theme: 'liquid-glass' | 'material-you';
    tunnelUrl: string;
  }) => Promise<ShareCreateResponse>;
  renderQr: (url: string) => string;
  log: (m: string) => void;
  error?: (m: string) => void;
  exit?: (code: number) => void;
  onShutdown?: (fn: () => Promise<void>) => void;
};

export type ShareCliOptions = {
  cliOverride: string | undefined;
};

function buildDefaults(): ShareOrchestratorDeps {
  const killPortImpl = makeKillPort();
  return {
    findConfig: defaultFindConfig,
    readProjectMetadata: defaultReadProjectMetadata,
    getDesignerName: ({ cliOverride }) => defaultGetDesignerName({ cliOverride }),
    killPort: killPortImpl,
    startPromptServer: defaultStartPromptServer,
    ensurePrototoAppMatchesProject: defaultEnsurePrototoApp,
    spawnExpo: defaultSpawnExpo,
    // Default: just wait one tick. Real impl can listen for "Metro waiting" line.
    waitForMetroReady: async () => {
      await new Promise((r) => setTimeout(r, 2000));
    },
    ensureCloudflared: () => defaultEnsureCloudflared(),
    startCloudflareTunnel: ({ localPort, cloudflaredPath }) =>
      defaultStartCloudflareTunnel({ localPort, cloudflaredPath }),
    createShare: (body) => defaultCreateShare(body),
    renderQr: defaultRenderQr,
    log: (m) => console.log(m),
    error: (m) => console.error(m),
    exit: (code) => process.exit(code),
    onShutdown: (fn) => {
      process.on('SIGINT', fn);
      process.on('SIGTERM', fn);
    },
  };
}

function mapShareError(err: unknown): string | null {
  if (err instanceof ShareApiError) {
    if (err.kind === 'rate-limited') return messages.shareRateLimited;
    if (err.kind === 'network' || err.kind === 'server' || err.kind === 'bad-response')
      return messages.shareApiUnreachable;
    if (err.kind === 'bad-input') return messages.shareApiUnreachable;
  }
  return null;
}

export async function runShare(
  opts: ShareCliOptions,
  injected?: Partial<ShareOrchestratorDeps>,
): Promise<void> {
  const defaults = buildDefaults();
  const deps: ShareOrchestratorDeps = { ...defaults, ...injected };

  const config = deps.findConfig(process.cwd());
  if (!config.ok) {
    (deps.error ?? deps.log)(config.reason);
    (deps.exit ?? (() => {}))(1);
    return;
  }

  deps.log(messages.shareStarting);

  const designerName = await deps.getDesignerName({ cliOverride: opts.cliOverride });
  const metadata = deps.readProjectMetadata(config.root);

  let cloudflaredPath: string;
  try {
    cloudflaredPath = await deps.ensureCloudflared();
  } catch {
    deps.log(messages.shareTunnelFailed);
    return;
  }

  const cleared = await deps.killPort(8081);
  if (cleared.killed > 0) deps.log(messages.stoppedPrevious);

  let server: ServerHandle | null = null;
  try {
    server = await deps.startPromptServer({ port: 3001 });
  } catch (err) {
    if (err instanceof Error && /EADDRINUSE/.test(err.message)) {
      (deps.error ?? deps.log)(messages.portInUse);
      (deps.exit ?? (() => {}))(1);
      return;
    }
    throw err;
  }

  await deps.ensurePrototoAppMatchesProject({
    cwd: config.root,
    deps: { log: deps.log },
  });

  const expo = deps.spawnExpo({ cwd: config.root });
  await deps.waitForMetroReady(expo);

  deps.log(messages.shareTunnelStarting);
  const tunnel = deps.startCloudflareTunnel({ localPort: 8081, cloudflaredPath });

  let tunnelUrl: string;
  try {
    tunnelUrl = await tunnel.tunnelUrl;
  } catch {
    deps.log(messages.shareTunnelFailed);
    await tunnel.kill().catch(() => undefined);
    await expo.kill().catch(() => undefined);
    await server?.close().catch(() => undefined);
    return;
  }

  let share: ShareCreateResponse;
  try {
    share = await deps.createShare({
      designerName,
      appName: metadata.appName,
      screenCount: metadata.screenCount,
      theme: metadata.theme,
      tunnelUrl,
    });
  } catch (err) {
    const mapped = mapShareError(err);
    if (mapped) deps.log(mapped);
    await tunnel.kill().catch(() => undefined);
    await expo.kill().catch(() => undefined);
    await server?.close().catch(() => undefined);
    return;
  }

  deps.log(messages.shareLive(share.url));
  deps.log('');
  deps.log(messages.shareScanCopy);
  deps.log(deps.renderQr(share.url));
  deps.log(messages.shareKeepRunning);

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await tunnel.kill().catch(() => undefined);
    await expo.kill().catch(() => undefined);
    await server?.close().catch(() => undefined);
  };
  deps.onShutdown?.(shutdown);

  // Keep alive until Metro exits or shutdown fires
  await expo.waitUntilExit;
  await shutdown();
}
```

- [ ] **Step 4: GREEN + full suite**

```bash
pnpm --filter @sherizan/proto-cli test -- commands/share 2>&1 | tail -5
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/proto-cli/src/commands/share.ts packages/proto-cli/src/commands/share.test.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): commands/share orchestrator

Wires every share-flow unit together. Order is fail-fast: read
identity + metadata + ensure cloudflared first; then port-clear,
prompt server, ensure-prototo-app, Metro, tunnel, share-api,
print URL + QR + keep-alive hint. Shutdown is a single function
registered on SIGINT/SIGTERM that kills tunnel + Metro +
prompt server in order. ShareApiError kinds map to designer
messages via mapShareError; all other failures surface
shareTunnelFailed or surface inline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Wire `share` into `cli.ts`

**Files:**
- Modify: `packages/proto-cli/src/cli.ts`

- [ ] **Step 1: Add the import + dispatch + HELP text**

Open `packages/proto-cli/src/cli.ts`. Apply these three edits:

1. Add import at the top, beside the other command imports:

```ts
import { runShare } from './commands/share.js';
```

2. Insert a new line in the `HELP` constant between the `start` and `new-screen` lines:

```
  share [--as <name>]            Start tunnel + register prototo.app/p/<token> share
```

3. Add a new dispatch branch directly below the `start` branch:

```ts
  if (command === 'share') {
    const rest = argv.slice(3);
    const asIdx = rest.indexOf('--as');
    const cliOverride =
      asIdx >= 0 && typeof rest[asIdx + 1] === 'string' ? rest[asIdx + 1] : undefined;
    await runShare({ cliOverride });
    return;
  }
```

- [ ] **Step 2: Type-check + tests**

```bash
pnpm --filter @sherizan/proto-cli typecheck 2>&1 | tail -3
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
```

Expected: typecheck exits 0; tests pass.

- [ ] **Step 3: Confirm `proto share --help`-style behaviour**

```bash
pnpm --filter @sherizan/proto-cli build 2>&1 | tail -3
node packages/proto-cli/dist/index.js help
```

Expected: HELP output contains the new `share` line.

- [ ] **Step 4: Commit**

```bash
git add packages/proto-cli/src/cli.ts
git commit -m "$(cat <<'EOF'
feat(proto-cli): register share subcommand in cli dispatcher

proto share [--as <name>] is now a top-level command. Help text
updated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: create-proto template + scaffolding hint updates

**Files:**
- Modify: `packages/create-proto/template/package.json`
- Modify: `packages/create-proto/template/CLAUDE.md`
- Modify: `packages/create-proto/template/README.md`
- Modify: `packages/create-proto/src/messages.ts`
- Modify: `packages/create-proto/package.json`

- [ ] **Step 1: Bump template pin**

In `packages/create-proto/template/package.json`, update:

```json
    "@sherizan/proto-cli": "^0.3.0-beta.0",
```

- [ ] **Step 2: One-line `proto share` mention in template CLAUDE.md**

Open `packages/create-proto/template/CLAUDE.md`. In §"Building blocks", below the existing Prototo primitives bullet, add a new bullet:

```markdown
**Share** — `proto share` starts a tunnel + registers a `prototo.app/p/<token>` link. Stakeholders open the link on iPhone with Prototo App to view the live prototype.
```

- [ ] **Step 3: Template README update**

Open `packages/create-proto/template/README.md`. Insert between the two existing `Run` lines:

```markdown
Run `proto share` to send a live link to someone (their Mac stays alive while shared).
```

(Result: the file has three `Run …` lines: `proto start`, `proto share`, `proto add`.)

- [ ] **Step 4: create-proto `howToRestart` message gains a share line**

Open `packages/create-proto/src/messages.ts`. Locate the `howToRestart(name)` function. Add a third line so the output reads:

```
Proto stopped.
To restart Proto: cd <name> && npx proto start
To share a live link: cd <name> && npx proto share
To prompt Claude: cd <name> && claude
```

- [ ] **Step 5: Update the matching test**

Open `packages/create-proto/src/messages.test.ts`. Find `howToRestart includes both proto start AND claude` and add an assertion:

```ts
    expect(m).toContain('cd myapp && npx proto share');
```

- [ ] **Step 6: Bump create-proto package + workspace dep**

In `packages/create-proto/package.json`:

```json
  "version": "0.3.0-beta.0",
  ...
    "@sherizan/proto-cli": "workspace:^0.3.0-beta.0",
```

- [ ] **Step 7: Install + tests**

```bash
pnpm install 2>&1 | tail -3
pnpm --filter create-proto test 2>&1 | tail -3
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add packages/create-proto/template packages/create-proto/src packages/create-proto/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(create-proto): template knows about proto share

Bump pin to ^0.3.0-beta.0, mention share command in template CLAUDE.md
and README, add the share line to howToRestart output. create-proto
itself bumped to 0.3.0-beta.0.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Docs — master doc + share-landing annotation

**Files:**
- Modify: `docs/proto-master.md`
- Modify: `docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md`

- [ ] **Step 1: Add a decisions-log entry to master doc**

Find the decisions-log section (toward the bottom of `docs/proto-master.md`). Add at the top of the log, above the existing 2026-05-25 entry:

```markdown
**2026-05-25 — `proto share` ships.**
- Cloudflare Quick Tunnels via the `cloudflared` npm wrapper for the tunnel transport.
- `proto share` is standalone: starts Metro + tunnel + share registration itself. `proto start` continues to exist for local-dev-only flows.
- Designer name from `git config user.name`, fallback prompt, cached in `~/.prototo/config.json`.
- See: `docs/superpowers/specs/2026-05-25-proto-share-design.md`.
```

- [ ] **Step 2: Add Consumer annotation to share-landing spec**

Open `docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md`. Insert immediately after the existing `> Date: ...` line at the top:

```markdown
> **Consumer:** `proto-cli`'s `proto share` command (sub-unit D). See `docs/superpowers/specs/2026-05-25-proto-share-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/proto-master.md docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md
git commit -m "$(cat <<'EOF'
docs: proto share decisions-log entry + share-landing consumer note

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Clean rebuild + final sanity tests

**Files:** none modified directly; this is a verification gate.

- [ ] **Step 1: Wipe and rebuild dist for both packages**

```bash
rm -rf packages/proto-cli/dist packages/create-proto/dist
pnpm --filter @sherizan/proto-cli build 2>&1 | tail -3
pnpm --filter create-proto build 2>&1 | tail -3
```

Expected: both exit 0.

- [ ] **Step 2: Confirm new artifacts in dist**

```bash
ls packages/proto-cli/dist | grep -E "^share-api|^project-metadata|^designer-identity|^ensure-cloudflared|^tunnel-cloudflare"
ls packages/proto-cli/dist/commands | grep "^share"
```

Expected: each new module's `.js` + `.d.ts` files present.

- [ ] **Step 3: Run full test suites + grep audits**

```bash
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
pnpm --filter create-proto test 2>&1 | tail -3
grep -rn -i "expo go\|expo-go" packages/proto-cli/src packages/create-proto/template apps/prototo-app 2>/dev/null
```

Expected: all tests pass; Expo Go matches are only in the existing anti-pattern test guard, render-qr fixture, and prototo-app/README historical text.

- [ ] **Step 4: No commit needed** (verification only).

---

## Task 14: Push feature branch + open PR

**Files:** none.

- [ ] **Step 1: Push branch to origin**

```bash
git push -u origin feat/proto-share
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "proto share: CLI + Cloudflare Quick Tunnels for live prototype sharing" --body "$(cat <<'EOF'
## Summary

Implements Phase 3a sub-unit D — the `proto share` CLI command. Designers run `proto share` and get a `prototo.app/p/<token>` link to send to a stakeholder; their Mac keeps Metro alive through a Cloudflare Quick Tunnel until Ctrl+C.

Standalone command — `proto start` continues to work for local-only flows.

## What changed

- Six new mockable units in `packages/proto-cli/src/` (`share-api`, `project-metadata`, `designer-identity`, `ensure-cloudflared`, `tunnel-cloudflare`, `commands/share`), each TDD'd
- New CLI dep: `cloudflared` (binary wrapper), `zod` (validates the share API contract on both sides)
- Designer-facing copy strings added to `messages.ts`
- `cli.ts` registers the new `share [--as <name>]` subcommand
- Template scaffolding mentions the new command (README, CLAUDE.md, `howToRestart`)
- Both packages bump to `0.3.0-beta.0`; template pin updated to match

## Test plan

- [ ] `pnpm --filter @sherizan/proto-cli test` — all green
- [ ] `pnpm --filter create-proto test` — all green
- [ ] Manual: scaffold `npm create proto@next /tmp/share-test`, run `proto share`, scan QR with iPhone Camera (Prototo App already installed from prior dev-client work), confirm welcome screen loads from the tunnel
- [ ] Ctrl+C cleanly kills cloudflared + Metro + prompt server (no orphan processes via `ps aux | grep -E 'cloudflared|expo'`)
- [ ] `prototo.app/p/<token>` resolves on desktop browser, shows correct designer name + app name + screen count + theme

## References

- Spec: `docs/superpowers/specs/2026-05-25-proto-share-design.md`
- Plan: `docs/superpowers/plans/2026-05-25-proto-share.md`
- API contract: `docs/superpowers/specs/2026-05-24-share-landing-and-token-router-design.md`
- Risks added to `docs/RISKS.md`: SH-05, SH-06, SH-07, CL-01, CL-02, CL-03
EOF
)"
```

- [ ] **Step 3: Capture the PR URL** in your notes.

---

## Task 15: Merge PR + publish prereleases

- [ ] **Step 1: Verify PR is mergeable**

```bash
gh pr view --json mergeable,mergeStateStatus
```

Expected: `"mergeable": "MERGEABLE"`, `"mergeStateStatus": "CLEAN"`.

- [ ] **Step 2: Merge with merge commit**

```bash
gh pr merge --merge --delete-branch
```

- [ ] **Step 3: Sync main locally**

```bash
git checkout main && git pull && git fetch --prune origin && git branch -d feat/proto-share 2>/dev/null
```

Expected: local main contains the merge commit; feature branch gone from both local and remote.

- [ ] **Step 4: Publish `@sherizan/proto-cli@0.3.0-beta.0`**

```bash
cd /Users/sherizan/Public/proto/packages/proto-cli
pnpm publish --tag next --no-git-checks
```

OTP prompt: complete browser auth flow.

- [ ] **Step 5: Verify**

```bash
npm view @sherizan/proto-cli dist-tags
```

Expected: `next: '0.3.0-beta.0'`, `latest: '0.2.0'`.

- [ ] **Step 6: Publish `create-proto@0.3.0-beta.0`**

```bash
cd /Users/sherizan/Public/proto/packages/create-proto
pnpm publish --tag next --no-git-checks
```

OTP prompt: complete browser auth flow.

- [ ] **Step 7: Verify**

```bash
npm view create-proto dist-tags
npm view create-proto@next dependencies | grep proto-cli
```

Expected: `next: '0.3.0-beta.0'`. Dep on `@sherizan/proto-cli` resolves to `^0.3.0-beta.0`.

---

## Task 16: End-to-end validation + DoD signoff

- [ ] **Step 1: Scaffold a fresh test project from npm `next`**

```bash
cd /tmp && rm -rf share-test && npm create proto@next share-test
```

Expected: scaffolds with the new template, auto-starts `proto start`. Hit Ctrl+C once the welcome screen renders.

- [ ] **Step 2: Run `proto share`**

```bash
cd /tmp/share-test && pnpm proto share
```

Expected output sequence:
- `Setting up your share…`
- (Simulator boots / Prototo installs if not already cached)
- `Starting tunnel…`
- `Your prototype is live\n  https://prototo.app/p/<token>`
- ``
- `Scan to open on any device:`
- (ASCII QR code)
- `Keep Prototo running while they view it.`

- [ ] **Step 3: Verify the share page on desktop**

Open the printed URL in a desktop browser. Expected: share-landing page shows your name (`git config user.name`), `share-test` (or the project name), screen count, and Liquid Glass theme.

- [ ] **Step 4: Verify on iPhone**

Scan the QR with iPhone Camera. iOS opens Prototo App (with the universal-link entitlement once F lands, or via `prototo://` scheme until then). Prototo connects to the Mac's tunnel and loads the bundle. The welcome screen renders — no `Cannot find native module` errors.

- [ ] **Step 5: Ctrl+C** in the terminal running `proto share`. Expected: tunnel + Metro + prompt server all shut down cleanly. Verify no orphans:

```bash
ps aux | grep -E 'cloudflared|expo-cli|expo start' | grep -v grep
```

Expected: empty.

- [ ] **Step 6: Tick the DoD in the spec**

Open `docs/superpowers/specs/2026-05-25-proto-share-design.md`. Replace `[ ]` with `[x]` for every item under "Definition of done" that has shipped.

- [ ] **Step 7: Commit + push the DoD update**

```bash
cd /Users/sherizan/Public/proto
git add docs/superpowers/specs/2026-05-25-proto-share-design.md
git commit -m "$(cat <<'EOF'
docs(spec): proto share DoD signoff

End-to-end validated: scaffold from npm next, proto share boots
tunnel, share page renders correctly on desktop + iPhone, bundle
loads in Prototo App via tunnel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 17: Promote to stable 0.3.0

- [ ] **Step 1: Bump both package versions to stable**

In `packages/proto-cli/package.json`: `"version": "0.3.0"` (was `"0.3.0-beta.0"`).
In `packages/create-proto/package.json`: `"version": "0.3.0"` + workspace dep `"@sherizan/proto-cli": "workspace:^0.3.0"`.
In `packages/create-proto/template/package.json`: `"@sherizan/proto-cli": "^0.3.0"`.

- [ ] **Step 2: Install + clean rebuild + tests**

```bash
pnpm install 2>&1 | tail -3
rm -rf packages/proto-cli/dist packages/create-proto/dist
pnpm --filter @sherizan/proto-cli build 2>&1 | tail -3
pnpm --filter create-proto build 2>&1 | tail -3
pnpm --filter @sherizan/proto-cli test 2>&1 | tail -3
pnpm --filter create-proto test 2>&1 | tail -3
```

Expected: all green.

- [ ] **Step 3: Commit + push**

```bash
git add packages/proto-cli/package.json packages/create-proto/package.json packages/create-proto/template/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore: promote packages to 0.3.0 stable

Drops the -beta suffix on both. proto share is now available via
`npm create proto@latest`.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 4: Publish proto-cli stable**

```bash
cd /Users/sherizan/Public/proto/packages/proto-cli
pnpm publish --no-git-checks
```

OTP prompt: complete browser auth flow.

- [ ] **Step 5: Publish create-proto stable**

```bash
cd /Users/sherizan/Public/proto/packages/create-proto
pnpm publish --no-git-checks
```

OTP prompt: complete browser auth flow.

- [ ] **Step 6: Verify dist-tags**

```bash
npm view @sherizan/proto-cli dist-tags
npm view create-proto dist-tags
```

Expected: `latest: '0.3.0'`, `next: '0.3.0-beta.0'` (or similar — `next` tag retains its prior value, harmless).

---

## Self-review check

Spec coverage:
- ✓ Tunnel transport (Cloudflare via `cloudflared` npm wrapper): Tasks 1, 5, 6
- ✓ Standalone Metro lifecycle: Task 9
- ✓ Designer name (git → cached → prompt): Task 4
- ✓ Project metadata (name + screenCount + theme): Task 3
- ✓ Share-api HTTP client + zod: Task 2
- ✓ Designer-facing copy: Task 7
- ✓ CLI subcommand: Task 10
- ✓ Template + scaffolding hint: Task 11
- ✓ Docs (master + share-landing): Task 12
- ✓ DoD signoff: Task 16
- ✓ Version bumps + publish: Tasks 15, 17
- ✓ Risks already promoted in `docs/RISKS.md` (CL-01, CL-02, CL-03, SH-05, SH-06, SH-07)

Placeholder scan: no `TODO`, `TBD`, "fill in later". The "Task 8 may be skipped if error-translation.ts is purely Metro-flavoured" is an explicit branching decision documented in-task, not a placeholder.

Type consistency: `ShareCreateInput`, `ShareCreateResponse`, `ShareApiError`, `Theme`, `ProjectMetadata`, `TunnelHandle`, `TunnelDeps`, `IdentityDeps`, `EnsureCloudflaredDeps`, `ShareOrchestratorDeps` — names used consistently across tasks. `mapShareError` is defined inside Task 9.
