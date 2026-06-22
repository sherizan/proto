import { describe, it, expect } from 'vitest';
import { authErrorMessage, extractOAuthCode } from './auth-errors';

describe('extractOAuthCode', () => {
  it('reads code from the query string', () => {
    expect(extractOAuthCode('prototo://auth-callback?code=abc123')).toBe('abc123');
  });
  it('reads code from the URL fragment', () => {
    expect(extractOAuthCode('prototo://auth-callback#code=frag456&x=1')).toBe('frag456');
  });
  it('returns null when there is no code', () => {
    expect(extractOAuthCode('prototo://auth-callback?error=denied')).toBeNull();
  });
  it('returns null for an unparseable url', () => {
    expect(extractOAuthCode('not a url')).toBeNull();
  });
});

describe('authErrorMessage', () => {
  it('maps rate limiting (status 429)', () => {
    expect(authErrorMessage({ status: 429, message: 'x' })).toMatch(/too many/i);
  });
  it('maps an invalid/expired code', () => {
    expect(authErrorMessage({ message: 'Token has expired or is invalid' })).toMatch(/code/i);
  });
  it('maps network failures', () => {
    expect(authErrorMessage({ message: 'Network request failed' })).toMatch(/connection/i);
  });
  it('falls back for unknown errors', () => {
    expect(authErrorMessage(null)).toMatch(/something went wrong/i);
  });
});
