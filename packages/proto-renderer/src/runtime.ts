import type { Action, Manifest } from '@sherizan/proto-manifest';

/** The renderer's live state: a navigation stack of screen names + the manifest state map. */
export type Runtime = {
  navStack: string[];
  state: Record<string, boolean | string>;
};

export function initialRuntime(manifest: Manifest): Runtime {
  return {
    navStack: [manifest.initialScreen],
    state: { ...(manifest.state ?? {}) },
  };
}

export function currentScreen(runtime: Runtime): string {
  return runtime.navStack[runtime.navStack.length - 1] ?? '';
}

/** Apply one enumerated manifest action, returning a new Runtime (never mutates). */
export function applyAction(runtime: Runtime, action: Action): Runtime {
  switch (action.action) {
    case 'navigate':
      return { ...runtime, navStack: [...runtime.navStack, action.to] };
    case 'dismiss':
      return runtime.navStack.length > 1
        ? { ...runtime, navStack: runtime.navStack.slice(0, -1) }
        : runtime;
    case 'setState':
      return { ...runtime, state: { ...runtime.state, [action.key]: action.value } };
    case 'toggleState':
      return { ...runtime, state: { ...runtime.state, [action.key]: !runtime.state[action.key] } };
    case 'showModal':
      return { ...runtime, state: { ...runtime.state, [action.key]: true } };
    case 'hideModal':
      return { ...runtime, state: { ...runtime.state, [action.key]: false } };
    default:
      return runtime;
  }
}
