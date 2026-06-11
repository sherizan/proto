import type { Manifest } from '@sherizan/proto-manifest';
import { describe, expect, it } from 'vitest';
import { applyAction, currentScreen, initialRuntime } from './runtime.js';

const manifest = (over: Partial<Manifest> = {}): Manifest => ({
  manifestVersion: '1',
  app: { name: 'T' },
  initialScreen: 'Home',
  screens: { Home: { type: 'Screen', children: [] }, Detail: { type: 'Screen', children: [] } },
  ...over,
});

describe('initialRuntime', () => {
  it('starts on the initial screen with a copy of the manifest state', () => {
    const m = manifest({ state: { darkMode: true, plan: 'free' } });
    const rt = initialRuntime(m);
    expect(rt.navStack).toEqual(['Home']);
    expect(rt.state).toEqual({ darkMode: true, plan: 'free' });
  });

  it('defaults to empty state when the manifest declares none', () => {
    expect(initialRuntime(manifest()).state).toEqual({});
  });

  it('does not alias the manifest state object', () => {
    const m = manifest({ state: { darkMode: false } });
    const rt = initialRuntime(m);
    rt.state.darkMode = true;
    expect(m.state).toEqual({ darkMode: false });
  });
});

describe('currentScreen', () => {
  it('returns the top of the nav stack', () => {
    expect(currentScreen({ navStack: ['Home', 'Detail'], state: {} })).toBe('Detail');
  });
});

describe('applyAction — navigation', () => {
  const rt = { navStack: ['Home'], state: {} };

  it('navigate pushes a screen', () => {
    expect(applyAction(rt, { action: 'navigate', to: 'Detail' }).navStack).toEqual([
      'Home',
      'Detail',
    ]);
  });

  it('dismiss pops a screen', () => {
    const r = { navStack: ['Home', 'Detail'], state: {} };
    expect(applyAction(r, { action: 'dismiss' }).navStack).toEqual(['Home']);
  });

  it('dismiss at the root is a no-op (never empties the stack)', () => {
    expect(applyAction(rt, { action: 'dismiss' }).navStack).toEqual(['Home']);
  });
});

describe('applyAction — state', () => {
  it('setState sets a value', () => {
    expect(
      applyAction({ navStack: ['H'], state: {} }, { action: 'setState', key: 'plan', value: 'pro' })
        .state,
    ).toEqual({ plan: 'pro' });
  });

  it('toggleState flips a boolean, treating absent as false', () => {
    expect(
      applyAction({ navStack: ['H'], state: {} }, { action: 'toggleState', key: 'd' }).state.d,
    ).toBe(true);
    expect(
      applyAction({ navStack: ['H'], state: { d: true } }, { action: 'toggleState', key: 'd' })
        .state.d,
    ).toBe(false);
  });

  it('showModal sets true, hideModal sets false', () => {
    expect(
      applyAction({ navStack: ['H'], state: {} }, { action: 'showModal', key: 'm' }).state.m,
    ).toBe(true);
    expect(
      applyAction({ navStack: ['H'], state: { m: true } }, { action: 'hideModal', key: 'm' }).state
        .m,
    ).toBe(false);
  });
});

describe('applyAction — immutability', () => {
  it('returns a new runtime and does not mutate the input', () => {
    const rt = { navStack: ['Home'], state: { d: false } };
    const next = applyAction(rt, { action: 'toggleState', key: 'd' });
    expect(next).not.toBe(rt);
    expect(rt).toEqual({ navStack: ['Home'], state: { d: false } });
  });
});
