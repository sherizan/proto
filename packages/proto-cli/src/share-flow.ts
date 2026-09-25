import { capturePreview, defaultPreviewDeps } from './preview-shot.js';
import { type FlowGraph, scanFlow } from './screen-flow.js';

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
/** Stored screenshot width; they render small in the flow. */
export const SCREEN_WIDTH = 400;

// / → index · /settings/Privacy Center → settings-privacy-center
export function slugOf(route: string): string {
  const slug = route
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'index';
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
  if (deps.walk) {
    const used = new Set<string>();
    let walked = false;
    const walkable = graph.nodes.filter((n) => !n.route.includes('[')).slice(0, MAX_SHOTS);
    for (const [i, n] of walkable.entries()) {
      deps.onWalk?.(i + 1, walkable.length);
      if (!(await deps.navigate(n.route))) break; // nothing answering: stop, don't wait out every screen
      walked = true;
      await deps.sleep(SETTLE_MS);
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
    edges: graph.edges.map((e) => ({ from: routeOf.get(e.from), to: routeOf.get(e.to) })),
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
    shoot: async () => {
      const shot = await capturePreview(defaultPreviewDeps, SCREEN_WIDTH);
      return shot.ok ? shot.bytes : null;
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}
