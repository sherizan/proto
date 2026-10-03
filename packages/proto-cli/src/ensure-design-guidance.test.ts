import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureDesignGuidance } from './ensure-design-guidance.js';
import { DESIGN_GUIDANCE } from './design-guidance-source.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-design-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
describe('shared design guidance delivery', () => {
  it('adds discoverable guidance for both agents while preserving custom instructions and design decisions', () => {
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Custom project\nUse the existing palette.\n');
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# Legacy instructions\nKeep my flows.\n');
    fs.writeFileSync(path.join(root, 'DESIGN.md'), 'My design choices');
    ensureDesignGuidance(root);
    expect(read('AGENTS.md')).toMatch(/^# Custom project\nUse the existing palette\.\n/);
    expect(read('CLAUDE.md')).toMatch(/^# Legacy instructions\nKeep my flows\.\n/);
    expect(read('AGENTS.md')).toContain('.proto/design/GUIDE.md');
    expect(read('CLAUDE.md')).toContain('.proto/design/GUIDE.md');
    expect(read('.proto/design/GUIDE.md')).toBe(DESIGN_GUIDANCE);
    expect(read('DESIGN.md')).toBe('My design choices');
  });
  it('refreshes only the managed block and is idempotent', () => {
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'Before\n<!-- prototo-design:start -->\nOld guide\n<!-- prototo-design:end -->\nAfter\n');
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '@AGENTS.md\n');
    ensureDesignGuidance(root);
    const once = read('AGENTS.md');
    ensureDesignGuidance(root);
    expect(read('AGENTS.md')).toBe(once);
    expect(once).toMatch(/^Before\n/);
    expect(once).toMatch(/\nAfter\n$/);
    expect(once).not.toContain('Old guide');
    expect(read('CLAUDE.md')).toBe('@AGENTS.md\n');
  });
  it('leaves malformed managed blocks alone', () => {
    const custom = 'Before\n<!-- prototo-design:start -->\nUnfinished edits';
    fs.writeFileSync(path.join(root, 'AGENTS.md'), custom);
    ensureDesignGuidance(root);
    expect(read('AGENTS.md')).toBe(custom);
  });
  it('does not follow symlinks out of the project', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-design-outside-'));
    try {
      fs.writeFileSync(path.join(outside, 'AGENTS.md'), 'Keep this');
      fs.symlinkSync(path.join(outside, 'AGENTS.md'), path.join(root, 'AGENTS.md'));
      fs.symlinkSync(outside, path.join(root, '.proto'));
      ensureDesignGuidance(root);
      expect(fs.readFileSync(path.join(outside, 'AGENTS.md'), 'utf8')).toBe('Keep this');
      expect(fs.existsSync(path.join(outside, 'design'))).toBe(false);
    } finally { fs.rmSync(outside, { recursive: true, force: true }); }
  });
  it('fails open without creating a missing project or inventing agent documents', () => {
    expect(() => ensureDesignGuidance(path.join(root, 'absent'))).not.toThrow();
    expect(fs.existsSync(path.join(root, 'absent'))).toBe(false);
    ensureDesignGuidance(root);
    expect(fs.existsSync(path.join(root, 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'CLAUDE.md'))).toBe(false);
  });
});
