import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureTouchDots } from './ensure-touch-dots.js';
import { TOUCH_DOTS_SOURCE } from './touch-dots-source.js';

const LAYOUT = `import { Stack } from 'expo-router';
import { GestureHandlerRootView } from '../components/proto/gestures';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
`;

let root: string;
const overlayPath = () => path.join(root, 'components', 'proto', 'touch-dots.tsx');
const layoutPath = () => path.join(root, 'app', '_layout.tsx');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-touch-dots-'));
  fs.mkdirSync(path.join(root, 'components', 'proto'), { recursive: true });
  fs.mkdirSync(path.join(root, 'app'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('ensureTouchDots', () => {
  it('embeds the current overlay source (kept in sync by create-proto sync-template)', () => {
    const live = fs.readFileSync(
      path.resolve(__dirname, '../../proto-components/src/touch-dots.tsx'),
      'utf8',
    );
    expect(TOUCH_DOTS_SOURCE).toBe(live);
    expect(TOUCH_DOTS_SOURCE).toContain('/inspect/result');
  });

  it('adds the overlay and wraps the root layout in a pre-0.7.10 project', () => {
    fs.writeFileSync(layoutPath(), LAYOUT);

    ensureTouchDots(root);

    expect(fs.readFileSync(overlayPath(), 'utf8')).toBe(TOUCH_DOTS_SOURCE);
    const layout = fs.readFileSync(layoutPath(), 'utf8');
    expect(layout).toContain("import TouchDots from '../components/proto/touch-dots';");
    expect(layout).toMatch(/return \(\n\s*<TouchDots>\n\s*<GestureHandlerRootView/);
    expect(layout).toMatch(/<\/GestureHandlerRootView>\n\s*<\/TouchDots>\n\s*\);\n}\n$/);
    // the import lands after the existing imports, before the component
    expect(layout.indexOf('import TouchDots')).toBeGreaterThan(layout.indexOf('gestures'));
    expect(layout.indexOf('import TouchDots')).toBeLessThan(layout.indexOf('export default'));
  });

  it('refreshes a stale Proto-managed overlay in place but never a customised one', () => {
    fs.writeFileSync(layoutPath(), LAYOUT);
    fs.writeFileSync(overlayPath(), '// Proto-managed. Old overlay without the inspect hook.\n');
    ensureTouchDots(root);
    expect(fs.readFileSync(overlayPath(), 'utf8')).toBe(TOUCH_DOTS_SOURCE);

    // A managed overlay that already has the inspect hook but drifted from the
    // CLI's copy (older POLL_MS etc.) is refreshed too.
    fs.writeFileSync(
      overlayPath(),
      TOUCH_DOTS_SOURCE.replace('const POLL_MS = ', 'const POLL_MS = 1'),
    );
    ensureTouchDots(root);
    expect(fs.readFileSync(overlayPath(), 'utf8')).toBe(TOUCH_DOTS_SOURCE);

    const custom =
      '// My own overlay\nexport default function TouchDots({ children }) { return children; }\n';
    fs.writeFileSync(overlayPath(), custom);
    ensureTouchDots(root);
    expect(fs.readFileSync(overlayPath(), 'utf8')).toBe(custom);
  });

  it('is idempotent and leaves a layout that already mounts the overlay alone', () => {
    fs.writeFileSync(layoutPath(), LAYOUT);
    ensureTouchDots(root);
    const once = fs.readFileSync(layoutPath(), 'utf8');
    ensureTouchDots(root);
    expect(fs.readFileSync(layoutPath(), 'utf8')).toBe(once);
  });

  it('skips a layout it cannot wrap safely (several returns) and never throws', () => {
    const twoReturns = `${LAYOUT.replace('  return (', '  if (!ready) return (\n    null\n  );\n  return (')}`;
    fs.writeFileSync(layoutPath(), twoReturns);
    ensureTouchDots(root);
    expect(fs.readFileSync(layoutPath(), 'utf8')).toBe(twoReturns);
    // overlay still lands (harmless on its own)
    expect(fs.existsSync(overlayPath())).toBe(true);

    fs.rmSync(path.join(root, 'app'), { recursive: true });
    expect(() => ensureTouchDots(root)).not.toThrow();
  });
});
