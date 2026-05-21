import os from 'node:os';

export type Iface = {
  family: 'IPv4' | 'IPv6' | string;
  address: string;
  internal: boolean;
};

export function pickLanIp(ifaces: Record<string, Iface[] | undefined>): string {
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

export function getLanIp(): string {
  return pickLanIp(os.networkInterfaces() as Record<string, Iface[]>);
}
