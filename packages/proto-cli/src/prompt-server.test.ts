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

  it('tracks the recording flag: false by default, set via POST, read via GET', async () => {
    const server = await startPromptServer({ port: 0 });
    const base = `http://127.0.0.1:${server.port}`;
    try {
      expect(JSON.parse((await fetchJson(`${base}/recording`)).body)).toEqual({ recording: false });

      const on = await fetch(`${base}/recording`, {
        method: 'POST',
        body: JSON.stringify({ recording: true }),
      });
      expect(on.status).toBe(204);
      expect(JSON.parse((await fetchJson(`${base}/recording`)).body)).toEqual({ recording: true });

      const off = await fetch(`${base}/recording`, {
        method: 'POST',
        body: JSON.stringify({ recording: false }),
      });
      expect(off.status).toBe(204);
      expect(JSON.parse((await fetchJson(`${base}/recording`)).body)).toEqual({ recording: false });
    } finally {
      await server.close();
    }
  });

  it('rejects a malformed recording POST without changing the flag', async () => {
    const server = await startPromptServer({ port: 0 });
    const base = `http://127.0.0.1:${server.port}`;
    try {
      const bad = await fetch(`${base}/recording`, { method: 'POST', body: 'not json' });
      expect(bad.status).toBe(400);
      expect(JSON.parse((await fetchJson(`${base}/recording`)).body)).toEqual({ recording: false });
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
