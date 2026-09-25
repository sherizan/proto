import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { capturePreview, defaultPreviewDeps } from './preview-shot.js';
import type { FlowRect, ScreenLink } from './prompt-server.js';
import { type FlowGraph, matchesRoute, scanFlow } from './screen-flow.js';

// Flow export (#25, `proto flow`): the project's screen graph as flow.json, plus
// a screenshot of each screen for prototo.app/f/<token>. The pictures come from
// walking the live preview with `proto start`'s /navigate, only under Prototo
// Desktop (PROTO_HEADLESS_SIM=1), whose Export flow modal hides the Simulator
// meanwhile. Every step fails open: no pictures still exports the graph.

export type FlowFile = { uploadPath: string; bytes: Buffer; contentType: string };

export type CaptureFlowDeps = {
  scan: (root: string) => FlowGraph;
  /** Walk the preview for screenshots (Prototo Desktop only). */
  walk: boolean;
  /** Ask the running app to open a route; true once it confirms. */
  navigate: (route: string) => Promise<boolean>;
  /** The mounted screen's tappables (#89); null when nothing answers. */
  links: () => Promise<ScreenLink[] | null>;
  /** A file's text (absolute path), for matching a tappable to its router.push; null if unreadable. */
  read: (path: string) => string | null;
  /** The booted Simulator's screen, scaled; null on failure. */
  shoot: () => Promise<Buffer | null>;
  sleep: (ms: number) => Promise<void>;
  /** Called before each screen is opened: 1-based index, screens to walk. */
  onWalk?: (done: number, total: number) => void;
};

/** Screens pictured per publish (~2 s each). */
export const MAX_SHOTS = 20;
/** Time for a screen to render after navigating. */
export const SETTLE_MS = 1000;
/** Stored screenshot width; the /f canvas zooms into them (up to 4x). */
export const SCREEN_WIDTH = 800;

// / → index · /settings/Privacy Center → settings-privacy-center
export function slugOf(route: string): string {
  const slug = route
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'index';
}

/** How far below a pressable's JSX line its onPress may push (multi-line props). */
const PUSH_REACH = 8;
const PUSH_RE = /router\.(?:push|replace|navigate)\(\s*(['"`])((?:(?!\1).)*)\1/;

// Which screen a tappable leads to (#89): a Link names it; a router.push is
// found in the source at the pressable's line. Anything else: no anchor, the
// arrow keeps its edge start.
export function linkTarget(
  link: ScreenLink,
  from: FlowGraph['nodes'][number],
  nodes: FlowGraph['nodes'],
  read: (rel: string) => string | null,
): FlowGraph['nodes'][number] | undefined {
  let target = link.href;
  if (!target && link.file && link.line) {
    const lines = read(link.file)?.split('\n') ?? [];
    for (let i = link.line - 1; i < Math.min(lines.length, link.line - 1 + PUSH_REACH); i++) {
      const m = lines[i]?.match(PUSH_RE);
      if (m) {
        target = m[2];
        break;
      }
    }
  }
  if (!target?.startsWith('/')) return undefined;
  const to = nodes.find((n) => matchesRoute(target, n.route));
  return to && to.id !== from.id ? to : undefined;
}

// Edges with the CTA that triggers each (#89). Every anchored link becomes its
// own edge; a scanned edge stays (unanchored) only when no link covered it.
export function anchorEdges(
  edges: FlowGraph['edges'],
  anchors: { from: string; to: string; at: FlowRect }[],
): { from: string; to: string; at?: FlowRect }[] {
  const covered = new Set(anchors.map((a) => `${a.from}>${a.to}`));
  return [...edges.filter((e) => !covered.has(`${e.from}>${e.to}`)), ...anchors];
}

export async function captureFlow(
  root: string,
  deps: CaptureFlowDeps = defaultCaptureFlowDeps(),
): Promise<{ files: FlowFile[]; screenCount: number } | null> {
  let graph: FlowGraph;
  try {
    graph = deps.scan(root);
  } catch {
    return null;
  }
  if (graph.nodes.length === 0) return null;

  const files: FlowFile[] = [];
  const images = new Map<string, string>();
  const anchors: { from: string; to: string; at: FlowRect }[] = [];
  if (deps.walk) {
    const used = new Set<string>();
    let walked = false;
    const walkable = graph.nodes.filter((n) => !n.route.includes('[')).slice(0, MAX_SHOTS);
    for (const [i, n] of walkable.entries()) {
      deps.onWalk?.(i + 1, walkable.length);
      if (!(await deps.navigate(n.route))) break; // nothing answering: stop, don't wait out every screen
      walked = true;
      await deps.sleep(SETTLE_MS);
      const seen = new Set<string>();
      for (const link of (await deps.links()) ?? []) {
        // screens under this one stay mounted and measure to the same place, so
        // only what this screen's own file draws counts.
        // ponytail: a link inside a shared component (components/Nav.tsx) gets no
        // anchor; teach the overlay the focused route if that ever matters.
        if (link.file !== n.file && link.file !== n.id) continue;
        const to = linkTarget(link, n, graph.nodes, (rel) => deps.read(join(root, rel)));
        // the same button reaches the overlay twice (Button, then its Pressable)
        const key = `${to?.id}@${link.frame.x.toFixed(3)},${link.frame.y.toFixed(3)}`;
        if (!to || seen.has(key)) continue;
        seen.add(key);
        anchors.push({ from: n.id, to: to.id, at: link.frame });
      }
      const bytes = await deps.shoot();
      if (!bytes) continue;
      let name = `screen-${slugOf(n.route)}`;
      for (let k = 2; used.has(name); k++) name = `screen-${slugOf(n.route).slice(0, 60)}-${k}`;
      used.add(name);
      images.set(n.id, `${name}.png`);
      files.push({ uploadPath: `${name}.png`, bytes, contentType: 'image/png' });
    }
    const start = graph.nodes.find((n) => n.id === graph.initial);
    if (walked && start) await deps.navigate(start.route);
  }

  // Public JSON: ids are routes, never the project's file paths.
  const routeOf = new Map(graph.nodes.map((n) => [n.id, n.route]));
  const flow = {
    v: 1,
    initial: graph.initial ? (routeOf.get(graph.initial) ?? null) : null,
    nodes: graph.nodes.map((n) => ({
      id: n.route,
      route: n.route,
      label: n.label,
      ...(n.group ? { group: n.group.replace(/^app\/?/, '').replace(/[()]/g, '') || 'root' } : {}),
      ...(n.back ? { back: true } : {}),
      ...(images.has(n.id) ? { image: images.get(n.id) } : {}),
    })),
    edges: anchorEdges(graph.edges, anchors).map((e) => ({
      from: routeOf.get(e.from),
      to: routeOf.get(e.to),
      ...(e.at ? { at: e.at } : {}),
    })),
  };
  files.push({
    uploadPath: 'flow.json',
    bytes: Buffer.from(JSON.stringify(flow)),
    contentType: 'application/json',
  });
  return { files, screenCount: graph.nodes.length };
}

export function defaultCaptureFlowDeps(): CaptureFlowDeps {
  return {
    scan: scanFlow,
    walk: process.env.PROTO_HEADLESS_SIM === '1',
    navigate: async (route) => {
      try {
        const res = await fetch('http://127.0.0.1:3001/navigate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: route }),
          signal: AbortSignal.timeout(4000),
        });
        return res.status === 200 && ((await res.json()) as { ok?: boolean }).ok === true;
      } catch {
        return false; // proto start not running, or older than 0.8.8
      }
    },
    links: async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/links', {
          method: 'POST',
          signal: AbortSignal.timeout(5000),
        });
        return res.status === 200
          ? (((await res.json()) as { links?: ScreenLink[] }).links ?? null)
          : null;
      } catch {
        return null; // older proto start: arrows keep their edge start
      }
    },
    read: (path) => {
      try {
        return readFileSync(path, 'utf8');
      } catch {
        return null;
      }
    },
    shoot: async () => {
      const shot = await capturePreview(defaultPreviewDeps, SCREEN_WIDTH);
      return shot.ok ? shot.bytes : null;
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}
