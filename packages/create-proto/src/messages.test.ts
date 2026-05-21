import { describe, expect, it } from 'vitest';
import { messages } from './messages';

describe('messages', () => {
  it('exposes the header', () => {
    expect(messages.header).toBe('Proto');
  });

  it('formats settingUp with project name', () => {
    expect(messages.settingUp('myapp')).toBe('Setting up myapp...');
  });

  it('formats installed with integer elapsed seconds', () => {
    expect(messages.installed(47)).toBe('Installed in 47s');
    expect(messages.installed(3)).toBe('Installed in 3s');
  });

  it('exposes folderExists with name reference and copy-paste-friendly recovery', () => {
    const m = messages.folderExists('myapp');
    expect(m).toContain('myapp');
    expect(m).toContain('npm create proto@latest');
  });

  it('exposes install failure recovery hint with project name', () => {
    const m = messages.installFailedHint('myapp');
    expect(m).toContain('cd myapp');
    expect(m).toContain('pnpm install');
    expect(m).toContain('proto start');
  });

  it('exposes protoCliNotFound recovery hint with project name', () => {
    const m = messages.protoCliNotFound('myapp');
    expect(m).toContain('cd myapp');
    expect(m).toContain('proto start');
  });

  it('exposes network/permission/space translations', () => {
    expect(messages.noNetwork).toMatch(/internet|network/i);
    expect(messages.noPermission).toMatch(/permission/i);
    expect(messages.noSpace).toMatch(/space|disk/i);
  });

  it('exposes cancelled message', () => {
    expect(messages.cancelled).toBe('Cancelled. Folder removed.');
  });

  it('formats usingDefaultName with name + override hint', () => {
    const m = messages.usingDefaultName('my-prototype');
    expect(m).toContain('my-prototype');
    expect(m).toContain('first argument to override');
  });
});
