import { describe, expect, it } from 'vitest';
import { startPromptServer } from './prompt-server';

async function fetchJson(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url);
  return { status: res.status, body: await res.text() };
}

describe('prompt-server', () => {
  it('responds to GET /health with { status: "ok" }', async () => {
    const server = await startPromptServer({ port: 0 });
    try {
      const { status, body } = await fetchJson(`http://127.0.0.1:${server.port}/health`);
      expect(status).toBe(200);
      expect(JSON.parse(body)).toEqual({ status: 'ok' });
    } finally {
      await server.close();
    }
  });

  it('returns 404 for unknown paths', async () => {
    const server = await startPromptServer({ port: 0 });
    try {
      const { status } = await fetchJson(`http://127.0.0.1:${server.port}/nope`);
      expect(status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it('rejects when the port is already in use', async () => {
    const first = await startPromptServer({ port: 0 });
    try {
      await expect(startPromptServer({ port: first.port })).rejects.toThrow(/EADDRINUSE/);
    } finally {
      await first.close();
    }
  });

  it('close() resolves and the server stops accepting connections', async () => {
    const server = await startPromptServer({ port: 0 });
    const port = server.port;
    await server.close();
    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
  });
});
