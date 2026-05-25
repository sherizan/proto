import { describe, it, expect, vi } from 'vitest';
import { redirectToDevClient, buildDevClientUrl } from './viewer-redirect';

describe('buildDevClientUrl', () => {
  it('builds the canonical prototo://expo-development-client URL', () => {
    const url = buildDevClientUrl('https://abc.trycloudflare.com');
    expect(url).toBe(
      'prototo://expo-development-client/?url=https%3A%2F%2Fabc.trycloudflare.com',
    );
  });

  it('URL-encodes special characters in the tunnel URL', () => {
    const url = buildDevClientUrl('https://abc.trycloudflare.com/?x=1&y=2');
    expect(url).toBe(
      'prototo://expo-development-client/?url=https%3A%2F%2Fabc.trycloudflare.com%2F%3Fx%3D1%26y%3D2',
    );
  });
});

describe('redirectToDevClient', () => {
  it('calls linking.openURL with the constructed dev-client URL', async () => {
    const openURL = vi.fn(async () => true);
    await redirectToDevClient('https://abc.trycloudflare.com', {
      linking: { openURL },
    });
    expect(openURL).toHaveBeenCalledWith(
      'prototo://expo-development-client/?url=https%3A%2F%2Fabc.trycloudflare.com',
    );
  });

  it('rejects when linking.openURL rejects', async () => {
    const openURL = vi.fn(async () => {
      throw new Error('iOS denied URL open');
    });
    await expect(
      redirectToDevClient('https://abc.trycloudflare.com', {
        linking: { openURL },
      }),
    ).rejects.toThrow(/iOS denied/);
  });
});
