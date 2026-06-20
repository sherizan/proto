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

  it('accepts loopback and localhost hosts', () => {
    expect(parseConnectUrl('exp://127.0.0.1:8081')).toBe(
      'prototo://expo-development-client/?url=exp://127.0.0.1:8081',
    );
    expect(parseConnectUrl('exp://localhost:8081')).toBe(
      'prototo://expo-development-client/?url=exp://localhost:8081',
    );
  });

  it('accepts the full RFC-1918 private ranges', () => {
    expect(parseConnectUrl('exp://10.1.2.3:8081')).not.toBeNull();
    expect(parseConnectUrl('exp://172.16.0.5:8081')).not.toBeNull();
    expect(parseConnectUrl('exp://172.31.255.254:8081')).not.toBeNull();
    expect(parseConnectUrl('exp://192.168.0.1:8081')).not.toBeNull();
  });

  it('rejects hosts just outside the 172.16/12 range', () => {
    expect(parseConnectUrl('exp://172.15.0.1:8081')).toBeNull();
    expect(parseConnectUrl('exp://172.32.0.1:8081')).toBeNull();
  });

  it('rejects a dev-client link whose inner url targets a PUBLIC host (RCE guard)', () => {
    expect(parseConnectUrl('prototo://expo-development-client/?url=exp://8.8.8.8:8081')).toBeNull();
    expect(
      parseConnectUrl('prototo://expo-development-client/?url=http://evil.example.com:8081'),
    ).toBeNull();
  });

  it('rejects a bare exp:// URL pointing at a public IP', () => {
    expect(parseConnectUrl('exp://93.184.216.34:8081')).toBeNull();
  });

  it('decodes a url-encoded inner target and canonicalizes it', () => {
    expect(
      parseConnectUrl('prototo://expo-development-client/?url=exp%3A%2F%2F192.168.1.10%3A8081'),
    ).toBe('prototo://expo-development-client/?url=exp://192.168.1.10:8081');
  });
});
