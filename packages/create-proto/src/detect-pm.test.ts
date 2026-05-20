import { describe, expect, it } from 'vitest';
import { detectPm } from './detect-pm';

describe('detectPm', () => {
  it('detects pnpm from user agent', () => {
    expect(detectPm('pnpm/9.0.0 npm/? node/v20.0.0 darwin arm64')).toBe('pnpm');
  });

  it('detects yarn from user agent', () => {
    expect(detectPm('yarn/4.0.0 npm/? node/v20.0.0 darwin arm64')).toBe('yarn');
  });

  it('detects npm from user agent', () => {
    expect(detectPm('npm/10.0.0 node/v20.0.0 darwin arm64')).toBe('npm');
  });

  it('falls back to npm when user agent is undefined', () => {
    expect(detectPm(undefined)).toBe('npm');
  });

  it('falls back to npm when user agent is empty', () => {
    expect(detectPm('')).toBe('npm');
  });

  it('falls back to npm for unrecognised user agents', () => {
    expect(detectPm('something/1.0.0 node/v20.0.0')).toBe('npm');
  });
});
