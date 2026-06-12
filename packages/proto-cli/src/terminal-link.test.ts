import { describe, expect, it } from 'vitest';
import { terminalLink } from './terminal-link.js';

const URL = 'https://prototo.app/p/YNRE5DK8QE6J';
const OPEN = (target: string) => `]8;;${target}`;
const CLOSE = ']8;;';

describe('terminalLink', () => {
  it('returns the bare URL when output is not a TTY (pipes/logs stay clean)', () => {
    expect(terminalLink(URL, { isTTY: false })).toBe(URL);
  });

  it('wraps the URL in an OSC 8 hyperlink on a TTY', () => {
    expect(terminalLink(URL, { isTTY: true })).toBe(`${OPEN(URL)}${URL}${CLOSE}`);
  });

  it('lets a custom label be shown while still linking to the URL', () => {
    expect(terminalLink(URL, { isTTY: true, label: 'Open prototype' })).toBe(
      `${OPEN(URL)}Open prototype${CLOSE}`,
    );
  });

  it('falls back to the bare URL (not the label) off-TTY so the link is never lost', () => {
    expect(terminalLink(URL, { isTTY: false, label: 'Open prototype' })).toBe(URL);
  });
});
