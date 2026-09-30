import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { messages } from '../messages.js';

// Tap and scroll the booted Simulator, so the agent can check pressed states,
// navigation and anything below the fold instead of only the first screenful.
// Touches go through serve-sim's native HID addon — the same injector Prototo
// Desktop streams with — called in-process: no helper server, no port, works
// with or without Desktop. Coordinates are fractions (0–1) of the screen, so
// they read straight off get_simulator_screenshot on any device.

type TouchType = 'begin' | 'move' | 'end';
type Hid = {
  touch(type: TouchType, x: number, y: number, w: number, h: number, edge: number): Promise<void>;
};

export type SimInputDeps = {
  run: (cmd: string, args: string[]) => string;
  sleep: (ms: number) => Promise<void>;
  openHid: (udid: string) => Hid;
};

// serve-sim/dist/native/serve-sim-native.node isn't an export, so locate it next
// to an exported file. Pinned serve-sim version: this path is internal.
function openHid(udid: string): Hid {
  const require = createRequire(import.meta.url);
  const addonPath = join(
    dirname(require.resolve('serve-sim/middleware')),
    'native',
    'serve-sim-native.node',
  );
  const addon = require(addonPath) as { SimHID: new (udid: string) => Hid };
  return new addon.SimHID(udid);
}

const defaultDeps: SimInputDeps = {
  run: (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  openHid,
};

// ponytail: first booted device only; take a udid param if multi-sim ever matters.
function bootedUdid(run: SimInputDeps['run']): string | null {
  try {
    const { devices } = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'])) as {
      devices: Record<string, Array<{ udid: string; state: string }>>;
    };
    return (
      Object.values(devices)
        .flat()
        .find((d) => d.state === 'Booted')?.udid ?? null
    );
  } catch {
    return null;
  }
}

async function withHid(
  deps: SimInputDeps,
  gesture: (touch: (type: TouchType, x: number, y: number) => Promise<void>) => Promise<void>,
): Promise<string | null> {
  const udid = bootedUdid(deps.run);
  if (!udid) return messages.reloadNoSimulator;
  let hid: Hid;
  try {
    hid = deps.openHid(udid);
  } catch {
    return messages.simInputUnavailable;
  }
  // w/h are unused for normalized touches; the addon only needs them for scroll deltas.
  await gesture((type, x, y) => hid.touch(type, x, y, 1, 1, 0));
  await deps.sleep(600); // let the UI settle before the agent screenshots
  return null;
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

export async function runTap(opts: {
  x: number;
  y: number;
  deps?: Partial<SimInputDeps>;
}): Promise<string> {
  const deps = { ...defaultDeps, ...opts.deps };
  const x = clamp(opts.x);
  const y = clamp(opts.y);
  const failed = await withHid(deps, async (touch) => {
    await touch('begin', x, y);
    await deps.sleep(50);
    await touch('end', x, y);
  });
  return failed ?? messages.simTapped(x, y);
}

export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

// "down" shows content further down, so the finger moves up. The drag holds
// still before lifting, so it stops where it's put instead of flinging on.
export async function runScroll(opts: {
  direction: ScrollDirection;
  amount?: number;
  deps?: Partial<SimInputDeps>;
}): Promise<string> {
  const deps = { ...defaultDeps, ...opts.deps };
  const half = Math.min(0.8, Math.max(0.05, opts.amount ?? 0.5)) / 2;
  const sign = opts.direction === 'down' || opts.direction === 'right' ? 1 : -1;
  const vertical = opts.direction === 'up' || opts.direction === 'down';
  const point = (t: number): [number, number] => {
    const along = 0.5 + sign * half * (1 - 2 * t); // 0.5+half → 0.5-half for down/right
    return vertical ? [0.5, along] : [along, 0.5];
  };
  const steps = 12;
  const failed = await withHid(deps, async (touch) => {
    await touch('begin', ...point(0));
    for (let i = 1; i <= steps; i++) {
      await deps.sleep(16);
      await touch('move', ...point(i / steps));
    }
    await deps.sleep(150);
    await touch('end', ...point(1));
  });
  return failed ?? messages.simScrolled(opts.direction);
}
