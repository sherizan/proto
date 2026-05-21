import path from 'node:path';
import fs from 'node:fs';
import { messages } from '../messages.js';
import { findConfig } from '../find-config.js';
import { startPromptServer, type ServerHandle } from '../prompt-server.js';
import { spawnExpo } from '../expo-spawn.js';
import { makeKillPort } from '../kill-port.js';
import { renderHeader } from '../header.js';
import { renderQr } from '../render-qr.js';
import { getLanIp } from '../lan-ip.js';

export type StartOptions = { verbose: boolean };

const APP_STORE_URL = 'https://apps.apple.com/app/expo-go/id982107779';

export async function runStart(_options: StartOptions): Promise<void> {
  const config = findConfig(process.cwd());
  if (!config.ok) {
    console.error(messages.noConfig);
    process.exit(1);
  }

  const themeName = readThemeFromConfig(config.configPath);
  const cliVersion = readCliVersion();

  // 1. Header
  console.log(
    renderHeader({
      brand: 'Proto',
      version: cliVersion,
      theme: themeName,
      target: 'iOS preview',
      cwd: config.root,
    }),
  );
  console.log('');

  // 2. Free port + start prompt server (existing infrastructure)
  const killPort = makeKillPort();
  const cleared = await killPort(8081);
  if (cleared.killed > 0) {
    console.log(`●  ${messages.stoppedPrevious}`);
  }

  let server: ServerHandle | null = null;
  try {
    server = await startPromptServer({ port: 3001 });
  } catch (err) {
    if (err instanceof Error && /EADDRINUSE/.test(err.message)) {
      console.error(messages.portInUse);
      process.exit(1);
    }
    throw err;
  }

  // 3. Step 1 — install Proto Preview
  console.log(messages.step1Header);
  console.log('');
  console.log(renderQr(APP_STORE_URL));
  console.log('');
  console.log(messages.step1Body);
  console.log('');

  // 4. Step 2 — open prototype
  console.log(messages.step2Header);
  console.log('');
  const projectUrl = `exp://${getLanIp()}:8081`;
  console.log(renderQr(projectUrl));
  console.log('');
  console.log(messages.step2Body);
  console.log('');

  // 5. Next-step block
  console.log(messages.nextStepsHeader);
  console.log('');
  console.log(messages.nextStepsBody.replace('<project>', path.basename(config.root)));
  console.log('');

  // 6. Footer + spawn Expo (Expo's output follows below)
  console.log(messages.metroRunning);
  console.log('');

  const expo = spawnExpo({ cwd: config.root });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await Promise.all([expo.kill(), server?.close()]);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await expo.waitUntilExit;
  await server?.close();
}

function readThemeFromConfig(configPath: string): string {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const m = /theme\s*:\s*['"]([^'"]+)['"]/.exec(raw);
    return m?.[1] ?? 'liquidGlass';
  } catch {
    return 'liquidGlass';
  }
}

function readCliVersion(): string {
  try {
    const here = import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname);
    const pkgPath = path.resolve(here, '../../package.json');
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const json = JSON.parse(raw) as { version?: string };
    return json.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
