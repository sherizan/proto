import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileManifest, compileScreen } from './compile.js';

const here = dirname(fileURLToPath(import.meta.url));
const tsxDir = join(here, '..', 'fixtures');
const jsonDir = join(here, '..', '..', 'proto-manifest', 'fixtures');

const read = (dir: string, file: string) => readFileSync(join(dir, file), 'utf8');
const screenOf = (jsonFile: string, name: string) =>
  JSON.parse(read(jsonDir, jsonFile)).screens[name];

const CASES: Array<[tsx: string, json: string, screenName: string]> = [
  ['empty.tsx', 'empty.json', 'Empty'],
  ['home.tsx', 'home.json', 'Home'],
  ['list.tsx', 'list.json', 'List'],
  ['detail.tsx', 'detail.json', 'Detail'],
  ['form.tsx', 'form.json', 'Form'],
  ['modal.tsx', 'modal.json', 'Modal'],
];

describe('compileScreen — templates compile to their manifest fixtures', () => {
  for (const [tsx, json, name] of CASES) {
    it(`${tsx} → ${json} screens.${name}`, () => {
      const result = compileScreen(read(tsxDir, tsx));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.screen).toEqual(screenOf(json, name));
      }
    });
  }
});

describe('compileScreen — loud rejection of out-of-schema input', () => {
  it('rejects a raw React Native primitive import', () => {
    const src = `import { View } from 'react-native';
import { Screen } from '../components/proto';
export default function S() { return <Screen><View /></Screen>; }`;
    const result = compileScreen(src);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('react-native');
  });

  it('rejects a screen that pulls in component state (useState)', () => {
    const src = `import { useState } from 'react';
import { Screen, Text } from '../components/proto';
export default function S() { const [n] = useState(0); return <Screen><Text>{String(n)}</Text></Screen>; }`;
    const result = compileScreen(src);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('react');
  });

  it('rejects a screen using a local-only motion/gesture subpath', () => {
    const src = `import { Animated } from '../components/proto/gestures';
import { Screen } from '../components/proto';
export default function S() { return <Screen><Animated.View /></Screen>; }`;
    const result = compileScreen(src);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('gestures');
  });

  it('rejects an unknown component', () => {
    const src = `import { Screen } from '../components/proto';
export default function S() { return <Screen><Marquee /></Screen>; }`;
    const result = compileScreen(src);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('Marquee');
  });

  it('rejects an interaction handler as local-only fidelity', () => {
    const src = `import { Screen, Button } from '../components/proto';
export default function S() { return <Screen><Button label="Go" onPress={() => {}} /></Screen>; }`;
    const result = compileScreen(src);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ').toLowerCase()).toContain('interaction');
  });

  it('rejects an unknown prop on a known component', () => {
    const src = `import { Screen, Text } from '../components/proto';
export default function S() { return <Screen><Text weight="bold">Hi</Text></Screen>; }`;
    const result = compileScreen(src);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('weight');
  });

  it('rejects a screen whose root element is not a Screen', () => {
    const src = `import { Stack } from '../components/proto';
export default function S() { return <Stack />; }`;
    const result = compileScreen(src);
    expect(result.ok).toBe(false);
  });
});

describe('compileManifest — end to end', () => {
  it('compiles a screen into a full, valid manifest matching the fixture', () => {
    const result = compileManifest([{ name: 'Empty', source: read(tsxDir, 'empty.tsx') }], {
      name: 'Empty',
      theme: 'liquidGlass',
      colorScheme: 'system',
      initialScreen: 'Empty',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest).toEqual(JSON.parse(read(jsonDir, 'empty.json')));
    }
  });

  it('surfaces a compile error with the screen name and does not produce a manifest', () => {
    const result = compileManifest(
      [
        {
          name: 'Bad',
          source: `import { Screen } from '../components/proto';
export default function S() { return <Screen><Marquee /></Screen>; }`,
        },
      ],
      { name: 'Bad', initialScreen: 'Bad' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('Bad');
  });
});
