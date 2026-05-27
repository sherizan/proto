import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeDesignDoc } from './write-design.js';

describe('writeDesignDoc', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-proto-design-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes a DESIGN.md at the destination root', async () => {
    await writeDesignDoc({ destRoot: tmpDir, projectName: 'demo', date: '2026-05-27' });
    const md = fs.readFileSync(path.join(tmpDir, 'DESIGN.md'), 'utf8');
    expect(md).toContain("Source of truth for demo's design system.");
    expect(md).toContain('Last updated: 2026-05-27');
  });

  it('defaults to the liquidGlass theme and the proto library', async () => {
    await writeDesignDoc({ destRoot: tmpDir, projectName: 'demo', date: '2026-05-27' });
    const md = fs.readFileSync(path.join(tmpDir, 'DESIGN.md'), 'utf8');
    expect(md).toContain('- Theme: liquidGlass');
    expect(md).toContain('- Package: proto (built-in)');
    expect(md).toContain('- Import from: ../components/proto');
  });

  it('emits the motion / gestures / lottie / canvas subpath lines for the proto library', async () => {
    await writeDesignDoc({ destRoot: tmpDir, projectName: 'demo', date: '2026-05-27' });
    const md = fs.readFileSync(path.join(tmpDir, 'DESIGN.md'), 'utf8');
    expect(md).toContain(
      '- Motion (declarative transitions, preferred for animations): ../components/proto/motion',
    );
    expect(md).toContain(
      '- Gestures (drag / scroll / shared-value animations): ../components/proto/gestures',
    );
    expect(md).toContain(
      '- Lottie (timeline animations from /assets/lottie/): ../components/proto/lottie',
    );
    expect(md).toContain('- Canvas (custom drawing): ../components/proto/canvas');
  });

  it('defaults accent to iOS system blue when not overridden', async () => {
    await writeDesignDoc({ destRoot: tmpDir, projectName: 'demo', date: '2026-05-27' });
    const md = fs.readFileSync(path.join(tmpDir, 'DESIGN.md'), 'utf8');
    expect(md).toContain('- Accent: #007AFF');
  });
});
