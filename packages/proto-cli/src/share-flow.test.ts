import { describe, expect, it } from 'vitest';
import type { FlowGraph } from './screen-flow';
import { type CaptureFlowDeps, anchorEdges, captureFlow, linkTarget, slugOf } from './share-flow';

const graph: FlowGraph = {
  nodes: [
    {
      id: 'app/(tabs)/feed.tsx',
      route: '/feed',
      label: 'Feed',
      file: 'screens/Feed.tsx',
      group: 'app/(tabs)',
    },
    { id: 'app/index.tsx', route: '/', label: 'Home', file: 'screens/Home.tsx' },
    {
      id: 'app/story/[user].tsx',
      route: '/story/[user]',
      label: 'Story',
      file: 'screens/Story.tsx',
      back: true,
    },
  ],
  edges: [
    { from: 'app/index.tsx', to: 'app/(tabs)/feed.tsx' },
    { from: 'app/(tabs)/feed.tsx', to: 'app/story/[user].tsx' },
  ],
  initial: 'app/index.tsx',
};

function fakeDeps(over: Partial<CaptureFlowDeps> = {}) {
  const visited: string[] = [];
  const deps: CaptureFlowDeps = {
    scan: () => graph,
    walk: true,
    navigate: async (p) => {
      visited.push(p);
      return true;
    },
    links: async () => null,
    read: () => null,
    shoot: async () => Buffer.from(`png:${visited.at(-1)}`),
    sleep: async () => {},
    ...over,
  };
  return { deps, visited };
}

const flowJson = (files: { uploadPath: string; bytes: Buffer }[]) =>
  JSON.parse(files.find((f) => f.uploadPath === 'flow.json')?.bytes.toString() ?? '{}');

describe('slugOf', () => {
  it('turns routes into safe file slugs', () => {
    expect(slugOf('/')).toBe('index');
    expect(slugOf('/feed')).toBe('feed');
    expect(slugOf('/settings/Privacy Center')).toBe('settings-privacy-center');
    expect(slugOf(`/${'a'.repeat(100)}`)).toHaveLength(64);
  });
});

describe('captureFlow', () => {
  it('walks every route without a [param], shoots it, returns home, and writes flow.json', async () => {
    const { deps, visited } = fakeDeps();
    const out = await captureFlow('/p', deps);
    expect(visited).toEqual(['/feed', '/', '/']); // walk, then back to the start route
    expect(out?.screenCount).toBe(3);
    expect(out?.files.map((f) => f.uploadPath).sort()).toEqual([
      'flow.json',
      'screen-feed.png',
      'screen-index.png',
    ]);
    const flow = flowJson(out?.files ?? []);
    expect(flow.v).toBe(1);
    expect(flow.initial).toBe('/');
    // ids are routes; no source file paths in the public JSON
    expect(flow.nodes).toEqual([
      { id: '/feed', route: '/feed', label: 'Feed', group: 'tabs', image: 'screen-feed.png' },
      { id: '/', route: '/', label: 'Home', image: 'screen-index.png' },
      { id: '/story/[user]', route: '/story/[user]', label: 'Story', back: true },
    ]);
    expect(flow.edges).toEqual([
      { from: '/', to: '/feed' },
      { from: '/feed', to: '/story/[user]' },
    ]);
    expect(JSON.stringify(flow)).not.toContain('screens/');
  });

  it('reports progress before each screen it walks', async () => {
    const steps: string[] = [];
    const { deps } = fakeDeps({ onWalk: (done, total) => steps.push(`${done}/${total}`) });
    await captureFlow('/p', deps);
    expect(steps).toEqual(['1/2', '2/2']); // the [param] screen is never walked
  });

  it('does not walk outside the desktop, but still writes the graph', async () => {
    const { deps, visited } = fakeDeps({ walk: false });
    const out = await captureFlow('/p', deps);
    expect(visited).toEqual([]);
    expect(out?.files.map((f) => f.uploadPath)).toEqual(['flow.json']);
    expect(flowJson(out?.files ?? []).nodes.every((n: { image?: string }) => !n.image)).toBe(true);
  });

  it('stops walking when the app never answers (no proto start / older overlay)', async () => {
    const { deps, visited } = fakeDeps({
      navigate: async (p) => {
        visited.push(p);
        return false;
      },
    });
    const out = await captureFlow('/p', deps);
    expect(visited).toEqual(['/feed']);
    expect(out?.files.map((f) => f.uploadPath)).toEqual(['flow.json']);
  });

  it('keeps going when one screenshot fails', async () => {
    let n = 0;
    const { deps } = fakeDeps({ shoot: async () => (n++ === 0 ? null : Buffer.from('png')) });
    const out = await captureFlow('/p', deps);
    expect(out?.files.map((f) => f.uploadPath).sort()).toEqual(['flow.json', 'screen-index.png']);
  });

  it('caps the walk at 20 screens and returns null for a project with no routes', async () => {
    const many: FlowGraph = {
      nodes: Array.from({ length: 30 }, (_, i) => ({
        id: `app/s${i}.tsx`,
        route: `/s${i}`,
        label: `S${i}`,
        file: `app/s${i}.tsx`,
      })),
      edges: [],
      initial: null,
    };
    const { deps, visited } = fakeDeps({ scan: () => many });
    const out = await captureFlow('/p', deps);
    expect(visited).toHaveLength(20); // no start route to return to
    expect(out?.screenCount).toBe(30);
    expect(
      await captureFlow(
        '/p',
        fakeDeps({ scan: () => ({ nodes: [], edges: [], initial: null }) }).deps,
      ),
    ).toBeNull();
  });
});

describe('CTA anchors (#89)', () => {
  const [feed, home, story] = graph.nodes;
  const at = { x: 0.1, y: 0.8, w: 0.8, h: 0.06 };

  it('linkTarget: a Link names its screen; a router.push is read at the pressable line', () => {
    expect(linkTarget({ href: '/feed', frame: at }, home, graph.nodes, () => null)).toBe(feed);
    expect(linkTarget({ href: '/story/ahmed', frame: at }, feed, graph.nodes, () => null)).toBe(
      story,
    );
    const src = [
      '<Screen>',
      '  <Button',
      "    onPress={() => router.push('/story/maya')}",
      '  />',
      '</Screen>',
    ];
    const read = (rel: string) => (rel === 'screens/Feed.tsx' ? src.join('\n') : null);
    expect(
      linkTarget({ file: 'screens/Feed.tsx', line: 2, frame: at }, feed, graph.nodes, read),
    ).toBe(story);
    // a named handler defined elsewhere: no guess
    expect(
      linkTarget({ file: 'screens/Feed.tsx', line: 5, frame: at }, feed, graph.nodes, read),
    ).toBeUndefined();
    // a link to itself, or to nothing: no anchor
    expect(linkTarget({ href: '/feed', frame: at }, feed, graph.nodes, () => null)).toBeUndefined();
    expect(
      linkTarget({ href: '/nowhere', frame: at }, feed, graph.nodes, () => null),
    ).toBeUndefined();
  });

  it('anchorEdges: an anchored link replaces its scanned edge; two buttons are two edges', () => {
    const out = anchorEdges(graph.edges, [
      { from: home.id, to: feed.id, at },
      { from: home.id, to: feed.id, at: { ...at, y: 0.9 } },
    ]);
    expect(out).toEqual([
      { from: feed.id, to: story.id },
      { from: home.id, to: feed.id, at },
      { from: home.id, to: feed.id, at: { ...at, y: 0.9 } },
    ]);
  });

  it('captureFlow writes `at` on edges from the walked screens and dedupes a button seen twice', async () => {
    const { deps } = fakeDeps({
      links: async () => [
        { href: '/feed', frame: at },
        { href: '/feed', frame: { ...at, x: at.x + 0.0001 } }, // Button, then its Pressable
        { frame: at }, // no target: ignored
      ],
    });
    const out = await captureFlow('/p', deps);
    const flow = flowJson(out?.files ?? []);
    // every walked screen answered the same links; only Home really links to /feed
    expect(flow.edges).toEqual([
      { from: '/feed', to: '/story/[user]' },
      { from: '/', to: '/feed', at },
    ]);
  });
});
