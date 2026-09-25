import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

export type InspectFrame = { file: string; lineNumber: number; column: number; methodName: string };
export type InspectHit = { file: string; line: number };
/** A tappable on the mounted screen (#89): where it sits (screen fractions), what it names. */
export type ScreenLink = { href?: string; file?: string; line?: number; frame: FlowRect };
export type FlowRect = { x: number; y: number; w: number; h: number };

export type StartServerOptions = {
  port?: number;
  /** Project root; inspect answers are limited to files under it. */
  root?: string;
  /** How long POST /inspect waits for the app to answer (default 4s). */
  inspectTimeoutMs?: number;
  /** How long POST /navigate waits for the app to confirm (default 2s). */
  navigateTimeoutMs?: number;
  /** How long POST /links waits for the app's tappables (default 3s). */
  linksTimeoutMs?: number;
  /** Bundle frames → source frames. Default: Metro's own /symbolicate. */
  symbolicate?: (frames: InspectFrame[]) => Promise<InspectFrame[]>;
};
export type ServerHandle = {
  port: number;
  close: () => Promise<void>;
};

type InspectRequest = { id: number; x: number; y: number };
type Pending = InspectRequest & { resolve: (hit: InspectHit | null) => void };

const MAX_FRAMES = 80;
// Hermes: "    at Home (http://…/entry.bundle?…:200:9)". Address-only frames
// ("address at …") carry no location and are skipped.
const FRAME_RE = /at (\S+) \((https?:\/\/[^\s)]+?):(\d+):(\d+)\)/g;

/** Pull bundle frames, in order, out of React `_debugStack` strings. */
export function parseStackFrames(stacks: string[]): InspectFrame[] {
  const frames: InspectFrame[] = [];
  for (const stack of stacks) {
    for (const m of stack.matchAll(FRAME_RE)) {
      frames.push({
        methodName: m[1] ?? '',
        file: m[2] ?? '',
        lineNumber: Number(m[3]),
        column: Number(m[4]),
      });
      if (frames.length >= MAX_FRAMES) return frames;
    }
  }
  return frames;
}

/**
 * First frame in the designer's own files: under the project, not a dependency,
 * not the Proto-managed component copies. Path comes back project-relative.
 */
export function pickProjectFrame(frames: InspectFrame[], root: string): InspectHit | null {
  for (const f of frames) {
    const rel = path.relative(root, f.file);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue;
    if (rel.includes('node_modules') || rel.startsWith(`components${path.sep}proto${path.sep}`))
      continue;
    return { file: rel.split(path.sep).join('/'), line: f.lineNumber };
  }
  return null;
}

async function metroSymbolicate(frames: InspectFrame[]): Promise<InspectFrame[]> {
  const res = await fetch('http://127.0.0.1:8081/symbolicate', {
    method: 'POST',
    body: JSON.stringify({ stack: frames }),
    signal: AbortSignal.timeout(3000),
  });
  const body = (await res.json()) as { stack?: InspectFrame[] };
  return body.stack ?? [];
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function isFraction(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function startPromptServer(options: StartServerOptions = {}): Promise<ServerHandle> {
  const root = options.root ?? process.cwd();
  const inspectTimeoutMs = options.inspectTimeoutMs ?? 4000;
  const navigateTimeoutMs = options.navigateTimeoutMs ?? 2000;
  const linksTimeoutMs = options.linksTimeoutMs ?? 3000;
  const symbolicate = options.symbolicate ?? metroSymbolicate;
  return new Promise((resolve, reject) => {
    // Recording flag: `proto record` POSTs it around the capture; the scaffold's
    // dev-only TouchDots overlay polls GET so taps are drawn on-device and land
    // in the recorded video (simctl captures only what the app renders).
    let recording = false;
    // Point-and-edit: the desktop POSTs a tapped point (fractions of the
    // screen) and waits; the same TouchDots poll carries it to the app, which
    // answers with the React debug stacks of the element's owners. One slot —
    // a newer tap supersedes an unanswered one.
    let pending: Pending | null = null;
    let nextId = 1;
    const settle = (hit: InspectHit | null) => {
      const p = pending;
      pending = null;
      p?.resolve(hit);
    };
    // Flow view (#25): the desktop POSTs a route; the same poll carries it to
    // the overlay, which calls expo-router's router.navigate and confirms. One
    // slot, like inspect. No answer (an older overlay) → 204, fail open.
    let navigating: { id: number; path: string; resolve: (ok: boolean | null) => void } | null =
      null;
    const settleNavigate = (ok: boolean | null) => {
      const n = navigating;
      navigating = null;
      n?.resolve(ok);
    };
    // Flow export (#89): `proto flow` asks for the mounted screen's tappables;
    // the overlay measures them and sends each one's debug stack, symbolicated
    // here to a project file:line like /inspect. One slot; 204 = no overlay.
    let linking: { id: number; resolve: (links: ScreenLink[] | null) => void } | null = null;
    const settleLinks = (links: ScreenLink[] | null) => {
      const l = linking;
      linking = null;
      l?.resolve(links);
    };

    const server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      if (req.url === '/recording' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const inspect = pending ? { id: pending.id, x: pending.x, y: pending.y } : undefined;
        const navigate = navigating ? { id: navigating.id, path: navigating.path } : undefined;
        const links = linking ? { id: linking.id } : undefined;
        res.end(
          JSON.stringify({
            recording,
            ...(inspect && { inspect }),
            ...(navigate && { navigate }),
            ...(links && { links }),
          }),
        );
        return;
      }
      if (req.url === '/recording' && req.method === 'POST') {
        readJson(req).then(
          (body) => {
            recording = (body as { recording?: boolean }).recording === true;
            res.writeHead(204);
            res.end();
          },
          () => {
            res.writeHead(400);
            res.end();
          },
        );
        return;
      }
      if (req.url === '/inspect' && req.method === 'POST') {
        readJson(req).then(
          (body) => {
            const { x, y } = body as { x?: unknown; y?: unknown };
            if (!isFraction(x) || !isFraction(y)) {
              res.writeHead(400);
              res.end();
              return;
            }
            settle(null);
            const id = nextId++;
            const timer = setTimeout(() => {
              if (pending?.id === id) settle(null);
            }, inspectTimeoutMs);
            pending = {
              id,
              x,
              y,
              resolve: (hit) => {
                clearTimeout(timer);
                if (hit) {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify(hit));
                } else {
                  res.writeHead(204);
                  res.end();
                }
              },
            };
          },
          () => {
            res.writeHead(400);
            res.end();
          },
        );
        return;
      }
      if (req.url === '/navigate' && req.method === 'POST') {
        readJson(req).then(
          (body) => {
            const { path: route } = body as { path?: unknown };
            if (typeof route !== 'string' || !route.startsWith('/') || route.length > 512) {
              res.writeHead(400);
              res.end();
              return;
            }
            settleNavigate(null);
            const id = nextId++;
            const timer = setTimeout(() => {
              if (navigating?.id === id) settleNavigate(null);
            }, navigateTimeoutMs);
            navigating = {
              id,
              path: route,
              resolve: (ok) => {
                clearTimeout(timer);
                if (ok === null) {
                  res.writeHead(204);
                  res.end();
                } else {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ ok }));
                }
              },
            };
          },
          () => {
            res.writeHead(400);
            res.end();
          },
        );
        return;
      }
      if (req.url === '/navigate/result' && req.method === 'POST') {
        readJson(req).then(
          (body) => {
            res.writeHead(204);
            res.end();
            const { id, ok } = body as { id?: unknown; ok?: unknown };
            if (navigating && navigating.id === id) settleNavigate(ok === true);
          },
          () => {
            res.writeHead(400);
            res.end();
          },
        );
        return;
      }
      if (req.url === '/links' && req.method === 'POST') {
        settleLinks(null);
        const id = nextId++;
        const timer = setTimeout(() => {
          if (linking?.id === id) settleLinks(null);
        }, linksTimeoutMs);
        linking = {
          id,
          resolve: (links) => {
            clearTimeout(timer);
            if (links === null) {
              res.writeHead(204);
              res.end();
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ links }));
            }
          },
        };
        return;
      }
      if (req.url === '/links/result' && req.method === 'POST') {
        readJson(req).then(
          (body) => {
            res.writeHead(204);
            res.end();
            const { id, links } = body as { id?: unknown; links?: unknown };
            if (!linking || linking.id !== id) return;
            const l = linking;
            const raw = (Array.isArray(links) ? links : []).flatMap((x) => {
              const r = x as { href?: unknown; stacks?: unknown; frame?: unknown };
              const f = r?.frame as Partial<FlowRect> | null;
              if (
                !f ||
                !isFraction(f.x) ||
                !isFraction(f.y) ||
                !isFraction(f.w) ||
                !isFraction(f.h)
              )
                return [];
              const stacks = Array.isArray(r.stacks)
                ? r.stacks.filter((s) => typeof s === 'string')
                : [];
              return [
                {
                  href: typeof r.href === 'string' ? r.href : undefined,
                  frames: parseStackFrames(stacks),
                  frame: { x: f.x, y: f.y, w: f.w, h: f.h },
                },
              ];
            });
            // one Metro round trip for every link: flatten, map, slice back
            const all = raw.flatMap((r) => r.frames);
            (all.length ? symbolicate(all) : Promise.resolve([]))
              .then((mapped) => {
                let at = 0;
                return raw.map((r) => {
                  const hit = pickProjectFrame(mapped.slice(at, at + r.frames.length), root);
                  at += r.frames.length;
                  return {
                    ...(r.href && { href: r.href }),
                    ...(hit && { file: hit.file, line: hit.line }),
                    frame: r.frame,
                  } as ScreenLink;
                });
              })
              .catch(() =>
                raw.map((r) => ({ ...(r.href && { href: r.href }), frame: r.frame }) as ScreenLink),
              )
              .then((out) => {
                if (linking === l) settleLinks(out);
              });
          },
          () => {
            res.writeHead(400);
            res.end();
          },
        );
        return;
      }
      if (req.url === '/inspect/result' && req.method === 'POST') {
        readJson(req).then(
          (body) => {
            res.writeHead(204);
            res.end();
            const { id, stacks } = body as { id?: unknown; stacks?: unknown };
            if (!pending || pending.id !== id) return;
            const p = pending;
            const frames = parseStackFrames(
              Array.isArray(stacks) ? stacks.filter((s) => typeof s === 'string') : [],
            );
            symbolicate(frames)
              .then((mapped) => pickProjectFrame(mapped, root))
              .catch(() => null)
              .then((hit) => {
                if (pending === p) settle(hit);
              });
          },
          () => {
            res.writeHead(400);
            res.end();
          },
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    server.once('error', (err) => {
      reject(err);
    });

    server.listen(options.port ?? 3001, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({
        port: addr.port,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            settle(null);
            settleNavigate(null);
            settleLinks(null);
            server.close((err) => {
              if (err) rejectClose(err);
              else resolveClose();
            });
          }),
      });
    });
  });
}
