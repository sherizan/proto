import { describe, expect, it } from 'vitest';
import { translateMetroError } from './error-translation';

describe('translateMetroError', () => {
  it('maps "Unable to resolve module" to component-not-found', () => {
    expect(translateMetroError('Unable to resolve module ./Foo')).toMatch(/component/i);
  });

  it('maps SyntaxError to screen-syntax', () => {
    expect(translateMetroError('SyntaxError: Unexpected token')).toMatch(/screen has an error/i);
  });

  it('maps "Network request failed" to no-device-connection', () => {
    expect(translateMetroError('Network request failed at ...')).toMatch(/wifi/i);
  });

  it('maps EADDRINUSE to port-in-use', () => {
    expect(translateMetroError('Error: listen EADDRINUSE')).toMatch(/already running/i);
  });

  it('returns the generic message for unrecognised input', () => {
    expect(translateMetroError('Wat')).toMatch(/something went wrong/i);
  });
});
