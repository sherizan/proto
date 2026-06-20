import { describe, expect, it } from 'vitest';
import { parseConnectUrl } from './connect-url';

describe('parseConnectUrl', () => {
  it('passes through a Prototo dev-client deep link unchanged', () => {
    const link = 'prototo://expo-development-client/?url=exp://192.168.1.10:8081';
    expect(parseConnectUrl(link)).toBe(link);
  });

  it('wraps a bare exp:// Metro URL into the dev-client deep link', () => {
    expect(parseConnectUrl('exp://192.168.1.10:8081')).toBe(
      'prototo://expo-development-client/?url=exp://192.168.1.10:8081',
    );
  });

  it('trims surrounding whitespace before matching', () => {
    expect(parseConnectUrl('  exp://10.0.0.2:8081\n')).toBe(
      'prototo://expo-development-client/?url=exp://10.0.0.2:8081',
    );
  });

  it('rejects an unrelated QR code', () => {
    expect(parseConnectUrl('https://example.com')).toBeNull();
    expect(parseConnectUrl('WIFI:S:home;T:WPA;P:secret;;')).toBeNull();
  });

  it('rejects a deep link for a different scheme', () => {
    expect(
      parseConnectUrl('exp+other://expo-development-client/?url=exp://1.2.3.4:8081'),
    ).toBeNull();
  });

  it('rejects empty / blank input', () => {
    expect(parseConnectUrl('')).toBeNull();
    expect(parseConnectUrl('   ')).toBeNull();
  });
});
