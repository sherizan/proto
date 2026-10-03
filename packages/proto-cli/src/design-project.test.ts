import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyProjectProfile, listProjectProfiles } from './design-project.js';
let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'profiles-'));
  fs.mkdirSync(path.join(root, 'components/proto/design'), { recursive: true });
  fs.writeFileSync(path.join(root, 'components/proto/design/capabilities.json'), '{"profiles":1,"typography":1}');
  fs.writeFileSync(path.join(root, 'proto.config.js'), "module.exports = { name: 'Demo' };");
  fs.writeFileSync(path.join(root, 'DESIGN.md'), '# My notes\n');
});
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });
const apply = () => applyProjectProfile(root, { expectedRevision: listProjectProfiles(root).revision, profileId: 'warm', version: '1.0.0' });
it('updates config and documentation together, returning a new revision', () => {
  const before = listProjectProfiles(root);
  const after = apply();
  expect(after.revision).not.toBe(before.revision);
  expect(listProjectProfiles(root).config.designProfile?.id).toBe('warm');
  expect(fs.readFileSync(path.join(root, 'DESIGN.md'), 'utf8')).toContain('warm@1.0.0');
});
it('refuses stale revisions without overwriting changes', () => {
  const before = listProjectProfiles(root);
  fs.appendFileSync(path.join(root, 'DESIGN.md'), 'New note');
  expect(() => applyProjectProfile(root, { expectedRevision: before.revision, profileId: 'warm', version: '1.0.0' })).toThrow(/changed/);
  expect(fs.readFileSync(path.join(root, 'DESIGN.md'), 'utf8')).toContain('New note');
});
it('rolls back both files if the second rename fails', () => {
  const before = listProjectProfiles(root);
  const rename = fs.renameSync;
  vi.spyOn(fs, 'renameSync').mockImplementation((a, b) => {
    if (String(b).endsWith('DESIGN.md')) throw Error('disk failure');
    return rename(a, b);
  });
  expect(apply).toThrow('disk failure');
  expect(listProjectProfiles(root).revision).toBe(before.revision);
  expect(fs.readdirSync(root).some(name => name.endsWith('.tmp') || name.endsWith('.lock'))).toBe(false);
});
it('refuses old component capabilities', () => {
  fs.rmSync(path.join(root, 'components/proto/design/capabilities.json'));
  expect(apply).toThrow(/managed components/);
});
it('reports optional recipe capabilities independently of profile support', () => {
  expect(listProjectProfiles(root).capabilities).toEqual({ profiles: true, typography: true, screenFooter: false, purchaseAction: false, skeleton: false });
  fs.writeFileSync(path.join(root, 'components/proto/design/capabilities.json'), '{"profiles":1,"typography":1,"screenFooter":1,"purchaseAction":1,"skeleton":1}');
  expect(listProjectProfiles(root).capabilities.screenFooter).toBe(true);
  expect(listProjectProfiles(root).capabilities.purchaseAction).toBe(true);
  expect(listProjectProfiles(root).capabilities.skeleton).toBe(true);
});
it('refuses a symlinked design document', () => {
  fs.renameSync(path.join(root, 'DESIGN.md'), path.join(root, 'other.md'));
  fs.symlinkSync(path.join(root, 'other.md'), path.join(root, 'DESIGN.md'));
  expect(apply).toThrow(/symbolic links/);
});
