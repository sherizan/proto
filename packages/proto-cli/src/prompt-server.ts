import http from 'node:http';
import type { AddressInfo } from 'node:net';

export type StartServerOptions = { port?: number };
export type ServerHandle = {
  port: number;
  close: () => Promise<void>;
};

export function startPromptServer(options: StartServerOptions = {}): Promise<ServerHandle> {
  return new Promise((resolve, reject) => {
    // Recording flag: `proto record` POSTs it around the capture; the scaffold's
    // dev-only TouchDots overlay polls GET so taps are drawn on-device and land
    // in the recorded video (simctl captures only what the app renders).
    let recording = false;
    const server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      if (req.url === '/recording' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ recording }));
        return;
      }
      if (req.url === '/recording' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            recording = (JSON.parse(body) as { recording?: boolean }).recording === true;
            res.writeHead(204);
          } catch {
            res.writeHead(400);
          }
          res.end();
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });

    server.once('error', (err) => {
      reject(err);
    });

    server.listen(options.port ?? 3001, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({
        port: addr.port,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => {
              if (err) rejectClose(err);
              else resolveClose();
            });
          }),
      });
    });
  });
}
