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

describe('compileScreen — shareable interactions (onTap / bind / state)', () => {
  const wrap = (body: string, imports = 'Button, Screen') =>
    `import { ${imports} } from '../components/proto';
export default function S() { return <Screen>${body}</Screen>; }`;

  it('maps every onTap grammar form to its action', () => {
    const result = compileScreen(
      wrap(
        `<Button label="A" onTap="navigate:Detail" />
         <Button label="B" onTap="dismiss" />
         <Button label="C" onTap="toggle:darkMode" />
         <Button label="D" onTap="showModal:info" />
         <Button label="E" onTap="hideModal:info" />
         <Button label="F" onTap="set:plan:pro" />
         <Button label="G" onTap="set:flag:true" />`,
      ),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const taps = result.screen.children.map((c) => (c as { onTap?: unknown }).onTap);
      expect(taps).toEqual([
        { action: 'navigate', to: 'Detail' },
        { action: 'dismiss' },
        { action: 'toggleState', key: 'darkMode' },
        { action: 'showModal', key: 'info' },
        { action: 'hideModal', key: 'info' },
        { action: 'setState', key: 'plan', value: 'pro' },
        { action: 'setState', key: 'flag', value: true },
      ]);
    }
  });

  it('accepts onTap on a Card', () => {
    const result = compileScreen(
      wrap(`<Card onTap="navigate:Detail"><Text>Go</Text></Card>`, 'Card, Screen, Text'),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects an onTap string outside the grammar', () => {
    const result = compileScreen(wrap(`<Button label="A" onTap="explode" />`));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('explode');
  });

  it('rejects a non-literal onTap', () => {
    const result = compileScreen(wrap(`<Button label="A" onTap={() => {}} />`));
    expect(result.ok).toBe(false);
  });

  it('still rejects onChange as local-only', () => {
    const result = compileScreen(
      wrap(`<Toggle label="X" bind="darkMode" onChange={() => {}} />`, 'Screen, Toggle'),
    );
    expect(result.ok).toBe(false);
  });

  it('infers bound and action state keys as false', () => {
    const result = compileScreen(
      wrap(
        `<Toggle label="X" bind="darkMode" />
         <Button label="B" onTap="showModal:info" />`,
        'Button, Screen, Toggle',
      ),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toEqual({ darkMode: false, info: false });
    }
  });

  it('lifts Screen state overrides out of the node tree', () => {
    const src = `import { Screen, Toggle } from '../components/proto';
export default function S() {
  return (
    <Screen state={{ darkMode: true, plan: 'pro' }}>
      <Toggle label="X" bind="darkMode" />
    </Screen>
  );
}`;
    const result = compileScreen(src);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toEqual({ darkMode: true, plan: 'pro' });
      expect('state' in result.screen).toBe(false);
    }
  });

  it('compiles screens with no interactions to an empty state', () => {
    const result = compileScreen(read(tsxDir, 'home.tsx'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toEqual({});
    }
  });
});

describe('compileManifest — interactive golden', () => {
  it('compiles the interactive fixtures to interactive.json (state inferred)', () => {
    const result = compileManifest(
      [
        { name: 'Home', source: read(tsxDir, 'interactive-home.tsx') },
        { name: 'Detail', source: read(tsxDir, 'interactive-detail.tsx') },
      ],
      {
        name: 'Interactive',
        theme: 'materialYou',
        colorScheme: 'system',
        accentColor: '#FF6B6B',
        tokens: { space: { md: 20 }, radius: { card: 16 } },
        initialScreen: 'Home',
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest).toEqual(JSON.parse(read(jsonDir, 'interactive.json')));
    }
  });
});

describe('compileManifest — state merge conflicts', () => {
  it('last writer wins across screens, with a warning', () => {
    const screenWith = (name: string, value: boolean) =>
      `import { Screen, Toggle } from '../components/proto';
export default function ${name}() {
  return (
    <Screen state={{ darkMode: ${value} }}>
      <Toggle label="X" bind="darkMode" />
    </Screen>
  );
}`;
    const result = compileManifest(
      [
        { name: 'A', source: screenWith('A', true) },
        { name: 'B', source: screenWith('B', false) },
      ],
      { name: 'X', initialScreen: 'A' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.state).toEqual({ darkMode: false });
      expect(result.warnings.join(' ')).toContain('darkMode');
    }
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
