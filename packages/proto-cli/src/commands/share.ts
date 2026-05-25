import { text, isCancel } from '@clack/prompts';
import { messages } from '../messages.js';
import { findConfig as defaultFindConfig, type ConfigLookup } from '../find-config.js';
import { startPromptServer as defaultStartPromptServer, type ServerHandle } from '../prompt-server.js';
import { spawnExpo as defaultSpawnExpo, type ExpoHandle } from '../expo-spawn.js';
import { makeKillPort } from '../kill-port.js';
import { ensurePrototoAppMatchesProject as defaultEnsurePrototoApp } from '../ensure-prototo-app.js';
import { readProjectMetadata as defaultReadProjectMetadata, type ProjectMetadata } from '../project-metadata.js';
import { getDesignerName as defaultGetDesignerName } from '../designer-identity.js';
import { ensureCloudflared as defaultEnsureCloudflared } from '../ensure-cloudflared.js';
import { startCloudflareTunnel as defaultStartCloudflareTunnel, type TunnelHandle } from '../tunnel-cloudflare.js';
import { createShare as defaultCreateShare, ShareApiError, type ShareCreateResponse } from '../share-api.js';
import { renderQr as defaultRenderQr } from '../render-qr.js';

export type ShareOrchestratorDeps = {
  findConfig: (cwd: string) => ConfigLookup;
  readProjectMetadata: (cwd: string) => ProjectMetadata;
  getDesignerName: (opts: { cliOverride?: string }) => Promise<string>;
  killPort: (port: number) => Promise<{ killed: number }>;
  startPromptServer: (opts: { port?: number }) => Promise<ServerHandle>;
  ensurePrototoAppMatchesProject: (opts: {
    cwd: string;
    deps?: { log?: (m: string) => void };
  }) => Promise<void>;
  spawnExpo: (opts: { cwd: string }) => ExpoHandle;
  waitForMetroReady: (handle: ExpoHandle) => Promise<void>;
  ensureCloudflared: () => Promise<string>;
  startCloudflareTunnel: (opts: { localPort: number; cloudflaredPath: string }) => TunnelHandle;
  createShare: (body: {
    designerName: string;
    appName: string;
    screenCount: number;
    theme: 'liquid-glass' | 'material-you';
    tunnelUrl: string;
  }) => Promise<ShareCreateResponse>;
  renderQr: (url: string) => string;
  log: (m: string) => void;
  error?: (m: string) => void;
  exit?: (code: number) => void;
  onShutdown?: (fn: () => Promise<void>) => void;
};

export type ShareCliOptions = {
  cliOverride: string | undefined;
};

function buildDefaults(): ShareOrchestratorDeps {
  const killPortImpl = makeKillPort();
  return {
    findConfig: defaultFindConfig,
    readProjectMetadata: defaultReadProjectMetadata,
    getDesignerName: ({ cliOverride }) =>
      defaultGetDesignerName({
        cliOverride,
        deps: {
          prompt: async (message) => {
            const result = await text({ message });
            if (isCancel(result) || typeof result !== 'string') {
              process.exit(0);
            }
            return result;
          },
        },
      }),
    killPort: killPortImpl,
    startPromptServer: defaultStartPromptServer,
    ensurePrototoAppMatchesProject: defaultEnsurePrototoApp,
    spawnExpo: defaultSpawnExpo,
    waitForMetroReady: async () => {
      await new Promise((r) => setTimeout(r, 2000));
    },
    ensureCloudflared: () => defaultEnsureCloudflared(),
    startCloudflareTunnel: ({ localPort, cloudflaredPath }) =>
      defaultStartCloudflareTunnel({ localPort, cloudflaredPath }),
    createShare: (body) => defaultCreateShare(body),
    renderQr: defaultRenderQr,
    log: (m) => console.log(m),
    error: (m) => console.error(m),
    exit: (code) => process.exit(code),
    onShutdown: (fn) => {
      process.on('SIGINT', fn);
      process.on('SIGTERM', fn);
    },
  };
}

function mapShareError(err: unknown): string | null {
  if (err instanceof ShareApiError) {
    if (err.kind === 'rate-limited') return messages.shareRateLimited;
    if (err.kind === 'network' || err.kind === 'server' || err.kind === 'bad-response')
      return messages.shareApiUnreachable;
    if (err.kind === 'bad-input') return messages.shareBadInput;
  }
  return null;
}

export async function runShare(
  opts: ShareCliOptions,
  injected?: Partial<ShareOrchestratorDeps>,
): Promise<void> {
  const defaults = buildDefaults();
  const deps: ShareOrchestratorDeps = { ...defaults, ...injected };

  const config = deps.findConfig(process.cwd());
  if (!config.ok) {
    (deps.error ?? deps.log)(config.reason);
    (deps.exit ?? (() => {}))(1);
    return;
  }

  deps.log(messages.shareStarting);

  const designerName = await deps.getDesignerName({ cliOverride: opts.cliOverride });
  const metadata = deps.readProjectMetadata(config.root);

  let cloudflaredPath: string;
  try {
    cloudflaredPath = await deps.ensureCloudflared();
  } catch {
    deps.log(messages.shareTunnelFailed);
    return;
  }

  const cleared = await deps.killPort(8081);
  if (cleared.killed > 0) deps.log(messages.stoppedPrevious);

  let server: ServerHandle | null = null;
  try {
    server = await deps.startPromptServer({ port: 3001 });
  } catch (err) {
    if (err instanceof Error && /EADDRINUSE/.test(err.message)) {
      (deps.error ?? deps.log)(messages.portInUse);
      (deps.exit ?? (() => {}))(1);
      return;
    }
    throw err;
  }

  await deps.ensurePrototoAppMatchesProject({
    cwd: config.root,
    deps: { log: deps.log },
  });

  const expo = deps.spawnExpo({ cwd: config.root });
  await deps.waitForMetroReady(expo);

  deps.log(messages.shareTunnelStarting);
  const tunnel = deps.startCloudflareTunnel({ localPort: 8081, cloudflaredPath });

  let tunnelUrl: string;
  try {
    tunnelUrl = await tunnel.tunnelUrl;
  } catch {
    deps.log(messages.shareTunnelFailed);
    await tunnel.kill().catch(() => undefined);
    await expo.kill().catch(() => undefined);
    await server?.close().catch(() => undefined);
    return;
  }

  let share: ShareCreateResponse;
  try {
    share = await deps.createShare({
      designerName,
      appName: metadata.appName,
      screenCount: metadata.screenCount,
      theme: metadata.theme,
      tunnelUrl,
    });
  } catch (err) {
    const mapped = mapShareError(err);
    if (mapped) deps.log(mapped);
    await tunnel.kill().catch(() => undefined);
    await expo.kill().catch(() => undefined);
    await server?.close().catch(() => undefined);
    return;
  }

  deps.log(messages.shareLive(share.url));
  deps.log('');
  deps.log(messages.shareScanCopy);
  deps.log(deps.renderQr(share.url));
  deps.log(messages.shareKeepRunning);

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await tunnel.kill().catch(() => undefined);
    await expo.kill().catch(() => undefined);
    await server?.close().catch(() => undefined);
  };
  deps.onShutdown?.(shutdown);

  // Keep alive until Metro exits or shutdown fires
  await expo.waitUntilExit;
  await shutdown();
}
