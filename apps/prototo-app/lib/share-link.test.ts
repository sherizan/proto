import { describe, expect, it } from 'vitest';
import { parseShareLink } from './share-link';

const TOKEN = 'TVY8DNDW8G4V';

describe('parseShareLink', () => {
  it('extracts the token from a prototo.app share URL', () => {
    expect(parseShareLink(`https://prototo.app/p/${TOKEN}`)).toBe(TOKEN);
  });

  it('tolerates a trailing slash, query, fragment, and surrounding whitespace', () => {
    expect(parseShareLink(`  https://prototo.app/p/${TOKEN}/  `)).toBe(TOKEN);
    expect(parseShareLink(`https://prototo.app/p/${TOKEN}?utm=x`)).toBe(TOKEN);
    expect(parseShareLink(`https://prototo.app/p/${TOKEN}#top`)).toBe(TOKEN);
  });

  it('accepts a bare valid token', () => {
    expect(parseShareLink(TOKEN)).toBe(TOKEN);
    expect(parseShareLink(`  ${TOKEN}\n`)).toBe(TOKEN);
  });

  it('rejects a share URL on a different host (anti-spoof)', () => {
    expect(parseShareLink(`https://evil.example.com/p/${TOKEN}`)).toBeNull();
    expect(parseShareLink(`https://prototo.app.evil.com/p/${TOKEN}`)).toBeNull();
  });

  it('rejects a malformed token (wrong length or excluded letters)', () => {
    expect(parseShareLink('https://prototo.app/p/TOOSHORT')).toBeNull();
    expect(parseShareLink(`https://prototo.app/p/${TOKEN}EXTRA`)).toBeNull();
    expect(parseShareLink('https://prototo.app/p/ILOU01234567')).toBeNull();
  });

  it('extracts the token from a scheme-normalized deep link (iOS re-emission forms)', () => {
    expect(parseShareLink(`prototo:///p/${TOKEN}`)).toBe(TOKEN);
    expect(parseShareLink(`prototo://p/${TOKEN}`)).toBe(TOKEN);
    expect(parseShareLink(`prototo:///p/${TOKEN}/`)).toBe(TOKEN);
  });

  it('rejects prototo links that are not share paths', () => {
    expect(parseShareLink('prototo:///connect')).toBeNull();
    expect(parseShareLink('prototo:///p/TOOSHORT')).toBeNull();
    expect(parseShareLink(`prototo://evil/p/${TOKEN}`)).toBeNull();
  });

  it('rejects non-share inputs', () => {
    expect(parseShareLink('')).toBeNull();
    expect(parseShareLink('   ')).toBeNull();
    expect(parseShareLink('https://prototo.app/account')).toBeNull();
    expect(parseShareLink('prototo://expo-development-client/?url=exp://10.0.0.2:8081')).toBeNull();
  });
});
