import { describe, expect, it } from 'vitest';
import { pickLanIp, type Iface } from './lan-ip.js';

describe('pickLanIp', () => {
  it('returns the first non-internal IPv4 address', () => {
    const ifaces: Record<string, Iface[]> = {
      lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
      en0: [{ family: 'IPv4', address: '192.168.1.42', internal: false }],
      en1: [{ family: 'IPv4', address: '10.0.0.5', internal: false }],
    };
    expect(pickLanIp(ifaces)).toBe('192.168.1.42');
  });

  it('skips IPv6 addresses', () => {
    const ifaces: Record<string, Iface[]> = {
      en0: [
        { family: 'IPv6', address: 'fe80::1', internal: false },
        { family: 'IPv4', address: '192.168.1.42', internal: false },
      ],
    };
    expect(pickLanIp(ifaces)).toBe('192.168.1.42');
  });

  it('falls back to localhost when no non-internal IPv4 found', () => {
    const ifaces: Record<string, Iface[]> = {
      lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
    };
    expect(pickLanIp(ifaces)).toBe('localhost');
  });

  it('falls back to localhost when no interfaces present', () => {
    expect(pickLanIp({})).toBe('localhost');
  });
});
