import { describe, expect, it } from 'vitest';
import { appleSignInErrorMessage, formatAppleFullName } from './apple-auth';

describe('formatAppleFullName', () => {
  it('joins given, middle, and family names with single spaces', () => {
    expect(
      formatAppleFullName({ givenName: 'Ada', middleName: 'M', familyName: 'Lovelace' }),
    ).toBe('Ada M Lovelace');
  });

  it('skips parts Apple did not provide', () => {
    expect(formatAppleFullName({ givenName: 'Ada', familyName: 'Lovelace' })).toBe('Ada Lovelace');
  });

  it('ignores blank/whitespace-only parts', () => {
    expect(formatAppleFullName({ givenName: 'Ada', middleName: '   ', familyName: '' })).toBe('Ada');
  });

  it('returns an empty string when there is no name', () => {
    expect(formatAppleFullName(null)).toBe('');
    expect(formatAppleFullName(undefined)).toBe('');
  });
});

describe('appleSignInErrorMessage', () => {
  it('returns an empty string when the user cancels (no error to show)', () => {
    expect(appleSignInErrorMessage('ERR_REQUEST_CANCELED')).toBe('');
  });

  it('returns friendly, jargon-free copy for any other failure', () => {
    expect(appleSignInErrorMessage('ERR_INVALID_RESPONSE')).toBe(
      "Couldn't sign in with Apple. Please try again.",
    );
    expect(appleSignInErrorMessage(undefined)).toBe(
      "Couldn't sign in with Apple. Please try again.",
    );
  });
});
