// Screen flow (#25): the prototype's screens as a graph, from a static scan of
// the project (expo-router files + the screens they render). Regex-level on
// purpose: scaffolds follow AGENTS.md's conventions, and a miss only drops an
// arrow. Fails open: unreadable files mean fewer nodes/edges, never a throw.
// OWNER copy. Prototo Desktop vendors it as electron/screenFlow.ts (check-contracts diffs them).
import { type Dirent, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type FlowNode = {
  id: string; // project-relative route file, e.g. app/(tabs)/feed.tsx
  route: string; // URL path, e.g. /feed, /story/[user]
  label: string; // screen name, e.g. Feed
  file: string; // what a click pastes, e.g. screens/Feed.tsx
  group?: string; // tab-group folder, e.g. app/(tabs)
  back?: boolean; // calls router.back()
};
export type FlowGraph = {
  nodes: FlowNode[];
  edges: { from: string; to: string }[];
  initial: string | null;
};

const STR = String.raw`(['"\x60])((?:(?!\1).)*)\1`; // a '…', "…" or `…` literal
const NAV_RE = new RegExp(String.raw`router\.(?:push|replace|navigate)\(\s*` + STR, 'g');
const HREF_RE = new RegExp(String.raw`href=\{?\s*` + STR, 'g');
const SCREEN_IMPORT_RE = /import\s+\w+\s+from\s+['"](?:\.\.?\/)+screens\/([\w.-]+)['"]/;
const TABS_RE = /<(?:NativeTabs|Tabs)\b/;

// app/(tabs)/feed.tsx → /feed · app/index.tsx → / · app/story/[user].tsx → /story/[user]
export function routeOf(relPath: string): string {
  const segs = relPath
    .replace(/^app\//, '')
    .replace(/\.tsx$/, '')
    .split('/')
    .filter((s) => !/^\(.*\)$/.test(s) && s !== 'index');
  return `/${segs.join('/')}`;
}

// does a navigation target (from source) land on this route pattern?
export function matchesRoute(target: string, route: string): boolean {
  const path =
    target
      .replace(/\$\{[^}]*\}/g, ':') // interpolation → one wildcard segment
      .split(/[?#]/)[0] ?? '';
  const t = path.split('/').filter(Boolean);
  const r = route.split('/').filter(Boolean);
  for (let i = 0; i < r.length; i++) {
    const seg = r[i] ?? '';
    if (/^\[\.\.\./.test(seg)) return i < t.length; // catch-all takes the rest
    if (i >= t.length) return false;
    if (/^\[.*\]$/.test(seg)) continue; // dynamic segment takes anything
    if ((t[i] ?? '').includes(':') || t[i] !== seg) return false;
  }
  return t.length === r.length;
}

export function buildFlow(files: Record<string, string>): FlowGraph {
  const paths = Object.keys(files);
  const tabDirs = new Set(
    paths
      .filter((p) => /^app\/(.+\/)?_layout\.tsx$/.test(p) && TABS_RE.test(files[p] ?? ''))
      .map((p) => p.replace(/\/_layout\.tsx$/, '')),
  );
  const nodes: FlowNode[] = paths
    .filter((p) => /^app\/.*\.tsx$/.test(p) && !/(^|\/)[_+][^/]*$/.test(p))
    .sort()
    .map((p) => {
      const screen = (files[p] ?? '').match(SCREEN_IMPORT_RE)?.[1];
      const dir = p.slice(0, p.lastIndexOf('/'));
      const route = routeOf(p);
      return {
        id: p,
        route,
        label: screen ?? (route === '/' ? 'Index' : (route.split('/').pop() ?? '')),
        file: screen ? `screens/${screen}.tsx` : p,
        ...(tabDirs.has(dir) ? { group: dir } : {}),
      };
    });

  const edges: FlowGraph['edges'] = [];
  for (const n of nodes) {
    const src = files[n.file] ?? files[n.id] ?? '';
    if (/router\.back\(\)/.test(src)) n.back = true;
    for (const re of [NAV_RE, HREF_RE]) {
      for (const m of src.matchAll(re)) {
        const target = m[2] ?? '';
        if (!target.startsWith('/')) continue; // relative hrefs: skipped
        const to = nodes.find((t) => matchesRoute(target, t.route));
        if (to && to.id !== n.id && !edges.some((e) => e.from === n.id && e.to === to.id)) {
          edges.push({ from: n.id, to: to.id });
        }
      }
    }
  }

  const initialName = files['proto.config.js']?.match(/initial:\s*['"]([\w.-]+)['"]/)?.[1];
  const initial =
    nodes.find((n) => n.label === initialName)?.id ??
    nodes.find((n) => n.route === '/')?.id ??
    null;
  return { nodes, edges, initial };
}

export function scanFlow(projectDir: string): FlowGraph {
  const files: Record<string, string> = {};
  const read = (rel: string) => {
    try {
      files[rel] = readFileSync(join(projectDir, rel), 'utf8');
    } catch {
      /* fail open */
    }
  };
  const walk = (rel: string) => {
    let entries: Dirent[] = [];
    try {
      entries = readdirSync(join(projectDir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child);
      else if (e.name.endsWith('.tsx')) read(child);
    }
  };
  walk('app');
  walk('screens');
  read('proto.config.js');
  return buildFlow(files);
}
