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
  it('exposes the keys the start command uses', () => {
    expect(messages.startingHeader).toBe('Proto');
    expect(messages.noConfig).toBeTruthy();
    expect(messages.starting).toBeTruthy();
    expect(messages.ready).toBeTruthy();
    expect(messages.stopped).toBeTruthy();
    expect(messages.portInUse).toBeTruthy();
    expect(messages.componentNotFound).toBeTruthy();
    expect(messages.screenSyntax).toBeTruthy();
    expect(messages.noDeviceConnection).toBeTruthy();
    expect(messages.generic).toBeTruthy();
  });

  it('contains no engineering jargon (case-insensitive)', () => {
    for (const value of Object.values(messages)) {
      const text = typeof value === 'string' ? value : '';
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
