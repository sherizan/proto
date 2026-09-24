import assert from 'node:assert';
import { expect, it } from 'vitest';
import { buildFlow, matchesRoute, routeOf } from './screen-flow';

// Same fixtures as Prototo Desktop's electron/screenFlow.check.ts (the vendored copy).
it('scans routes, screens, tab groups, edges and the start screen', () => {
  assert.equal(routeOf('app/index.tsx'), '/');
  assert.equal(routeOf('app/(tabs)/feed.tsx'), '/feed');
  assert.equal(routeOf('app/story/[user].tsx'), '/story/[user]');

  assert.ok(matchesRoute('/feed', '/feed'));
  assert.ok(matchesRoute('/feed?x=1', '/feed'));
  assert.ok(matchesRoute('/story/${encodeURIComponent(a ?? b)}', '/story/[user]'));
  assert.ok(!matchesRoute('/story/${id}', '/story/new')); // interpolation only fills dynamic segments
  assert.ok(!matchesRoute('/story', '/story/[user]'));
  assert.ok(matchesRoute('/', '/'));
  assert.ok(!matchesRoute('/', '/feed'));

  const route = (name: string, depth = 1) =>
    `import ${name} from '${'../'.repeat(depth)}screens/${name}';\nexport default function R() { return <${name} />; }`;

  // shaped like ~/Prototo/review-sample
  const g = buildFlow({
    'proto.config.js': "module.exports = { screens: { initial: 'ProfileCard' } };",
    'app/_layout.tsx': '<Stack><Stack.Screen name="index" /></Stack>',
    'app/(tabs)/_layout.tsx': '<NativeTabs><NativeTabs.Trigger name="feed" /></NativeTabs>',
    'app/index.tsx': route('ProfileCard'),
    'app/(tabs)/feed.tsx': route('Feed', 2),
    'app/(tabs)/search.tsx': route('Search', 2),
    'app/story/[user].tsx': route('Story', 2),
    'app/+not-found.tsx': 'x',
    'screens/ProfileCard.tsx': "onPress={() => router.replace('/feed')}",
    'screens/Feed.tsx':
      "router.replace('/'); <Link href={`/story/${encodeURIComponent(label)}`} asChild>",
    'screens/Search.tsx': '<Link href="/nowhere">',
    'screens/Story.tsx': 'onPress={() => router.back()}',
  });

  assert.deepEqual(
    g.nodes.map((n) => n.route),
    ['/feed', '/search', '/', '/story/[user]'], // sorted by file; _layout and +not-found dropped
  );
  const byLabel = Object.fromEntries(g.nodes.map((n) => [n.label, n]));
  assert.equal(byLabel.Feed.file, 'screens/Feed.tsx');
  assert.equal(byLabel.Feed.group, 'app/(tabs)');
  assert.equal(byLabel.Search.group, 'app/(tabs)');
  assert.equal(byLabel.ProfileCard.group, undefined);
  assert.equal(byLabel.Story.back, true);
  assert.equal(g.initial, 'app/index.tsx');

  const edge = (a: string, b: string) =>
    g.edges.some((e) => e.from === byLabel[a].id && e.to === byLabel[b].id);
  assert.ok(edge('ProfileCard', 'Feed'));
  assert.ok(edge('Feed', 'ProfileCard'));
  assert.ok(edge('Feed', 'Story'));
  assert.equal(g.edges.length, 3); // /nowhere matches nothing

  // no proto.config → the "/" route starts; a route file without a screen import is its own file
  const h = buildFlow({ 'app/index.tsx': "router.push('/about')", 'app/about.tsx': 'x' });
  assert.equal(h.initial, 'app/index.tsx');
  assert.equal(h.nodes[1].file, 'app/index.tsx');
  assert.equal(h.edges.length, 1);
  expect(true).toBe(true);
});
