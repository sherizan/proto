import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateManifest } from './validate.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));
}

describe('validateManifest — valid fixtures', () => {
  const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

  it('finds the fixture corpus', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(7);
  });

  for (const file of readdirSync(fixturesDir).filter((f) => f.endsWith('.json'))) {
    it(`accepts ${file}`, () => {
      const result = validateManifest(loadFixture(file));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.manifest.manifestVersion).toBe('1');
      }
    });
  }
});

describe('validateManifest — structural rejections', () => {
  const base = () => loadFixture('home.json') as Record<string, unknown>;

  it('rejects an unknown node type', () => {
    const result = validateManifest({
      manifestVersion: '1',
      app: { name: 'X' },
      initialScreen: 'Home',
      screens: { Home: { type: 'Screen', children: [{ type: 'Banana', value: 'x' }] } },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a Button with no label', () => {
    const result = validateManifest({
      manifestVersion: '1',
      app: { name: 'X' },
      initialScreen: 'Home',
      screens: { Home: { type: 'Screen', children: [{ type: 'Button', variant: 'primary' }] } },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an out-of-enum Text size', () => {
    const result = validateManifest({
      manifestVersion: '1',
      app: { name: 'X' },
      initialScreen: 'Home',
      screens: { Home: { type: 'Screen', children: [{ type: 'Text', size: 'huge', value: 'x' }] } },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown action', () => {
    const result = validateManifest({
      manifestVersion: '1',
      app: { name: 'X' },
      initialScreen: 'Home',
      screens: {
        Home: {
          type: 'Screen',
          children: [{ type: 'Button', label: 'Go', onTap: { action: 'explode' } }],
        },
      },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a navigate action with no target', () => {
    const result = validateManifest({
      manifestVersion: '1',
      app: { name: 'X' },
      initialScreen: 'Home',
      screens: {
        Home: {
          type: 'Screen',
          children: [{ type: 'Button', label: 'Go', onTap: { action: 'navigate' } }],
        },
      },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an unsupported manifestVersion', () => {
    const m = base();
    m.manifestVersion = '2';
    expect(validateManifest(m).ok).toBe(false);
  });

  it('rejects a manifest with no screens', () => {
    const result = validateManifest({
      manifestVersion: '1',
      app: { name: 'X' },
      initialScreen: 'Home',
    });
    expect(result.ok).toBe(false);
  });
});

describe('validateManifest — referential integrity', () => {
  it('rejects an initialScreen that is not a defined screen', () => {
    const m = loadFixture('home.json') as Record<string, unknown>;
    m.initialScreen = 'Nope';
    const result = validateManifest(m);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('Nope');
    }
  });

  it('rejects a navigate action pointing at a missing screen', () => {
    const result = validateManifest({
      manifestVersion: '1',
      app: { name: 'X' },
      initialScreen: 'Home',
      screens: {
        Home: {
          type: 'Screen',
          children: [{ type: 'Button', label: 'Go', onTap: { action: 'navigate', to: 'Ghost' } }],
        },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('Ghost');
    }
  });

  it('rejects a state action referencing an undeclared state key', () => {
    const result = validateManifest({
      manifestVersion: '1',
      app: { name: 'X' },
      initialScreen: 'Home',
      state: { darkMode: false },
      screens: {
        Home: {
          type: 'Screen',
          children: [
            { type: 'Button', label: 'Go', onTap: { action: 'toggleState', key: 'missingKey' } },
          ],
        },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('missingKey');
    }
  });

  it('rejects a bound Toggle referencing an undeclared state key', () => {
    const result = validateManifest({
      manifestVersion: '1',
      app: { name: 'X' },
      initialScreen: 'Home',
      state: { darkMode: false },
      screens: {
        Home: {
          type: 'Screen',
          children: [{ type: 'Toggle', label: 'X', bind: 'notDeclared' }],
        },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('notDeclared');
    }
  });
});
