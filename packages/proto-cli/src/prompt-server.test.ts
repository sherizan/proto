import { describe, expect, it } from 'vitest';
import {
  type InspectFrame,
  parseStackFrames,
  pickProjectFrame,
  startPromptServer,
} from './prompt-server';

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

describe('prompt-server /inspect (point-and-edit)', () => {
  const root = '/Users/d/Prototo/instagram';
  const bundle =
    'http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true';
  // A React 19 `_debugStack` for the tapped element's owner chain: React
  // internals first, then the JSX call site inside the designer's screen.
  const stacks = [
    `Error: react-stack-top-frame\n    at jsxDEV (${bundle}:10:5)\n    at Home (${bundle}:200:9)\n    at anonymous (address at :1:1)`,
    `Error: react-stack-top-frame\n    at jsxDEV (${bundle}:10:5)\n    at RootLayout (${bundle}:300:9)`,
  ];
  const symbolicate = async (frames: InspectFrame[]) =>
    frames.map((f) => {
      if (f.lineNumber === 10)
        return { ...f, file: `${root}/node_modules/react/jsx-dev-runtime.js` };
      if (f.lineNumber === 200) return { ...f, file: `${root}/screens/Home.tsx`, lineNumber: 42 };
      return { ...f, file: `${root}/app/_layout.tsx`, lineNumber: 8 };
    });

  it('parses bundle frames out of stacks and skips address-only frames', () => {
    expect(parseStackFrames(stacks)).toEqual([
      { file: bundle, lineNumber: 10, column: 5, methodName: 'jsxDEV' },
      { file: bundle, lineNumber: 200, column: 9, methodName: 'Home' },
      { file: bundle, lineNumber: 10, column: 5, methodName: 'jsxDEV' },
      { file: bundle, lineNumber: 300, column: 9, methodName: 'RootLayout' },
    ]);
  });

  it('picks the first frame inside the project, never node_modules or the managed components', () => {
    const frames = [
      { file: `${root}/node_modules/react/x.js`, lineNumber: 1, column: 1, methodName: 'a' },
      {
        file: `${root}/components/proto/button.tsx`,
        lineNumber: 5,
        column: 1,
        methodName: 'Button',
      },
      { file: `${root}/screens/Home.tsx`, lineNumber: 42, column: 9, methodName: 'Home' },
      { file: `${root}/app/_layout.tsx`, lineNumber: 8, column: 9, methodName: 'RootLayout' },
    ];
    expect(pickProjectFrame(frames, root)).toEqual({ file: 'screens/Home.tsx', line: 42 });
    expect(pickProjectFrame(frames.slice(0, 2), root)).toBeNull();
    expect(
      pickProjectFrame(
        [{ file: '/elsewhere/screens/Home.tsx', lineNumber: 1, column: 1, methodName: 'x' }],
        root,
      ),
    ).toBeNull();
  });

  it('hands the pending tap to the app via GET /recording and answers POST /inspect with the symbolicated file:line', async () => {
    const server = await startPromptServer({ port: 0, root, symbolicate });
    const base = `http://127.0.0.1:${server.port}`;
    try {
      const inspecting = fetch(`${base}/inspect`, {
        method: 'POST',
        body: JSON.stringify({ x: 0.5, y: 0.25 }),
      });
      await new Promise((r) => setTimeout(r, 20));
      const poll = JSON.parse((await fetchJson(`${base}/recording`)).body) as {
        inspect?: { id: number; x: number; y: number };
      };
      expect(poll.inspect).toMatchObject({ x: 0.5, y: 0.25 });
      expect(typeof poll.inspect?.id).toBe('number');

      const answered = await fetch(`${base}/inspect/result`, {
        method: 'POST',
        body: JSON.stringify({ id: poll.inspect?.id, stacks }),
      });
      expect(answered.status).toBe(204);

      const res = await inspecting;
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ file: 'screens/Home.tsx', line: 42 });
      // answered → no longer pending
      expect(JSON.parse((await fetchJson(`${base}/recording`)).body)).toEqual({ recording: false });
    } finally {
      await server.close();
    }
  });

  it('answers 204 when the app never replies, when symbolication fails, or when no project frame exists', async () => {
    const server = await startPromptServer({
      port: 0,
      root,
      inspectTimeoutMs: 30,
      symbolicate: async () => {
        throw new Error('metro down');
      },
    });
    const base = `http://127.0.0.1:${server.port}`;
    try {
      const silent = await fetch(`${base}/inspect`, {
        method: 'POST',
        body: JSON.stringify({ x: 0.1, y: 0.1 }),
      });
      expect(silent.status).toBe(204);

      const inspecting = fetch(`${base}/inspect`, {
        method: 'POST',
        body: JSON.stringify({ x: 0.1, y: 0.1 }),
      });
      await new Promise((r) => setTimeout(r, 5));
      const { inspect } = JSON.parse((await fetchJson(`${base}/recording`)).body) as {
        inspect?: { id: number };
      };
      await fetch(`${base}/inspect/result`, {
        method: 'POST',
        body: JSON.stringify({ id: inspect?.id, stacks }),
      });
      expect((await inspecting).status).toBe(204);
    } finally {
      await server.close();
    }
  });

  it('rejects malformed inspect bodies and ignores results for a stale id', async () => {
    const server = await startPromptServer({ port: 0, root, inspectTimeoutMs: 30, symbolicate });
    const base = `http://127.0.0.1:${server.port}`;
    try {
      expect((await fetch(`${base}/inspect`, { method: 'POST', body: 'nope' })).status).toBe(400);
      expect(
        (await fetch(`${base}/inspect`, { method: 'POST', body: JSON.stringify({ x: 'a' }) }))
          .status,
      ).toBe(400);
      expect((await fetch(`${base}/inspect/result`, { method: 'POST', body: '{' })).status).toBe(
        400,
      );
      const inspecting = fetch(`${base}/inspect`, {
        method: 'POST',
        body: JSON.stringify({ x: 0.1, y: 0.1 }),
      });
      await new Promise((r) => setTimeout(r, 5));
      await fetch(`${base}/inspect/result`, {
        method: 'POST',
        body: JSON.stringify({ id: -1, stacks }),
      });
      expect((await inspecting).status).toBe(204);
    } finally {
      await server.close();
    }
  });
});

describe('prompt-server /navigate (flow view → live route)', () => {
  it('hands the path to the app via GET /recording and answers 200 once the app confirms', async () => {
    const server = await startPromptServer({ port: 0 });
    const base = `http://127.0.0.1:${server.port}`;
    try {
      const navigating = fetch(`${base}/navigate`, {
        method: 'POST',
        body: JSON.stringify({ path: '/feed' }),
      });
      await new Promise((r) => setTimeout(r, 20));
      const poll = JSON.parse((await fetchJson(`${base}/recording`)).body) as {
        navigate?: { id: number; path: string };
      };
      expect(poll.navigate).toMatchObject({ path: '/feed' });

      const answered = await fetch(`${base}/navigate/result`, {
        method: 'POST',
        body: JSON.stringify({ id: poll.navigate?.id, ok: true }),
      });
      expect(answered.status).toBe(204);

      const res = await navigating;
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(JSON.parse((await fetchJson(`${base}/recording`)).body)).toEqual({ recording: false });
    } finally {
      await server.close();
    }
  });

  it('answers 204 when the app never replies (an overlay without navigate)', async () => {
    const server = await startPromptServer({ port: 0, navigateTimeoutMs: 50 });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/navigate`, {
        method: 'POST',
        body: JSON.stringify({ path: '/feed' }),
      });
      expect(res.status).toBe(204);
    } finally {
      await server.close();
    }
  });

  it('a newer request supersedes an unanswered one, and a stale result is ignored', async () => {
    const server = await startPromptServer({ port: 0 });
    const base = `http://127.0.0.1:${server.port}`;
    const nav = (path: string) =>
      fetch(`${base}/navigate`, { method: 'POST', body: JSON.stringify({ path }) });
    try {
      const first = nav('/feed');
      await new Promise((r) => setTimeout(r, 20));
      const firstId = (JSON.parse((await fetchJson(`${base}/recording`)).body) as {
        navigate: { id: number };
      }).navigate.id;
      const second = nav('/search');
      expect((await first).status).toBe(204);

      await fetch(`${base}/navigate/result`, {
        method: 'POST',
        body: JSON.stringify({ id: firstId, ok: true }),
      });
      const poll = JSON.parse((await fetchJson(`${base}/recording`)).body) as {
        navigate: { id: number; path: string };
      };
      expect(poll.navigate.path).toBe('/search');

      await fetch(`${base}/navigate/result`, {
        method: 'POST',
        body: JSON.stringify({ id: poll.navigate.id, ok: false }),
      });
      expect(await (await second).json()).toEqual({ ok: false });
    } finally {
      await server.close();
    }
  });

  it('rejects a path that is not an absolute route', async () => {
    const server = await startPromptServer({ port: 0 });
    const base = `http://127.0.0.1:${server.port}`;
    try {
      for (const body of [{}, { path: 'feed' }, { path: 42 }, { path: `/${'a'.repeat(600)}` }]) {
        const res = await fetch(`${base}/navigate`, { method: 'POST', body: JSON.stringify(body) });
        expect(res.status).toBe(400);
      }
      expect(JSON.parse((await fetchJson(`${base}/recording`)).body)).toEqual({ recording: false });
    } finally {
      await server.close();
    }
  });
});
