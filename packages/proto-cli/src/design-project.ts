import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { findConfig } from './find-config.js';
import { prepareProfileEdit, readDesignConfig } from './design/config.js';
import { listProfiles } from './design/profiles.js';

function safe(root: string, relative: string) {
  let cursor = root;
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    try {
      if (fs.lstatSync(cursor).isSymbolicLink()) throw Error('Design files must be inside the project, without symbolic links.');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return cursor;
}
function snapshot(root: string) {
  const found = findConfig(root);
  if (!found.ok) throw Error(found.reason);
  const configPath = safe(root, path.basename(found.configPath));
  const documentPath = safe(root, 'DESIGN.md');
  const source = fs.readFileSync(configPath, 'utf8');
  const document = fs.existsSync(documentPath) ? fs.readFileSync(documentPath, 'utf8') : '';
  const revision = createHash('sha256').update(JSON.stringify([source, document])).digest('hex');
  return { configPath, documentPath, source, document, revision };
}
export function designCapabilities(root: string) {
  try {
    const file = safe(root, 'components/proto/design/capabilities.json');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { profiles: value.profiles === 1, typography: value.typography === 1, screenFooter: value.screenFooter === 1, purchaseAction: value.purchaseAction === 1, skeleton: value.skeleton === 1 };
  } catch { return { profiles: false, typography: false, screenFooter: false, purchaseAction: false, skeleton: false }; }
}
export function listProjectProfiles(root: string) {
  const current = snapshot(root);
  return { revision: current.revision, capabilities: designCapabilities(root), config: readDesignConfig(current.source), profiles: listProfiles() };
}
export function applyProjectProfile(root: string, options: { expectedRevision: string; profileId: string; version: string; overrides?: unknown; preserveExisting?: boolean }) {
  const capabilities = designCapabilities(root);
  if (!capabilities.profiles || !capabilities.typography) throw Error('Update this prototype’s managed components before using design profiles. Your current design has been kept.');
  const lock = safe(root, '.proto-design-profile.lock');
  let fd: number;
  try { fd = fs.openSync(lock, 'wx'); } catch { throw Error('Another design update is in progress. Wait for it to finish.'); }
  const temporary: string[] = [];
  try {
    const current = snapshot(root);
    if (options.expectedRevision !== current.revision) throw Error('The design changed. Read the available profiles again before applying.');
    const next = prepareProfileEdit(current.source, current.document, { id: options.profileId, version: options.version }, options.overrides, options.preserveExisting ?? true);
    const before = [current.configPath, current.documentPath].map(file => ({ file, content: fs.existsSync(file) ? fs.readFileSync(file) : null }));
    for (const [index, text] of [next.source, next.document].entries()) {
      const file = before[index]!.file + '.' + randomUUID() + '.tmp';
      fs.writeFileSync(file, text, { flag: 'wx' }); temporary.push(file);
    }
    try { for (const [index, file] of temporary.entries()) fs.renameSync(file, before[index]!.file); }
    catch (error) {
      for (const entry of before) {
        if (entry.content === null) fs.rmSync(entry.file, { force: true });
        else fs.writeFileSync(entry.file, entry.content);
      }
      throw error;
    }
    return { revision: snapshot(root).revision, config: next.config, capabilities: designCapabilities(root) };
  } finally {
    for (const file of temporary) fs.rmSync(file, { force: true });
    fs.closeSync(fd); fs.rmSync(lock, { force: true });
  }
}
