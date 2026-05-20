import { describe, expect, it } from 'vitest';
import { messages } from './messages';

const bannedFragments = [
  'npm',
  'pnpm',
  'yarn',
  'node',
  'expo',
  'metro',
  'error code',
  'stack',
];

describe('messages', () => {
  it('exposes the keys the CLI uses', () => {
    expect(messages.header).toBe('Proto');
    expect(messages.namePrompt).toMatch(/prototype/i);
    expect(messages.settingUp).toBeTruthy();
    expect(messages.installing).toBeTruthy();
    expect(messages.ready).toBeTruthy();
    expect(messages.folderExists('demo')).toContain('demo');
    expect(messages.installFailed).toBeTruthy();
    expect(messages.final).toBeTruthy();
  });

  it('contains no engineering jargon (case-insensitive)', () => {
    const allStrings: string[] = [];
    for (const value of Object.values(messages)) {
      if (typeof value === 'string') allStrings.push(value);
      if (typeof value === 'function') allStrings.push(value('example'));
    }
    for (const text of allStrings) {
      for (const banned of bannedFragments) {
        expect(text.toLowerCase()).not.toContain(banned);
      }
    }
  });

  it('contains no version-like substrings', () => {
    const versionPattern = /\d+\.\d+\.\d+/;
    for (const value of Object.values(messages)) {
      if (typeof value === 'string') {
        expect(value).not.toMatch(versionPattern);
      }
    }
  });
});
