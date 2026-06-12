import { isCancel, text } from '@clack/prompts';
import { getDesignerName as defaultGetDesignerName } from '../designer-identity.js';
import { type ConfigLookup, findConfig as defaultFindConfig } from '../find-config.js';
import { messages } from '../messages.js';
import {
  type PublishUpdateResult,
  publishUpdate as defaultPublishUpdate,
} from '../publish-update.js';
import { renderQr as defaultRenderQr } from '../render-qr.js';
import {
  ShareApiError,
  type ShareCreateInput,
  type ShareCreateResponse,
  createShare as defaultCreateShare,
} from '../share-api.js';
import { SHARE_PROJECT_ID, ensureShareConfig as defaultEnsureShareConfig } from '../share-config.js';
import { type GatheredProject, gatherProject as defaultGatherProject } from '../share-project.js';
import { getOrCreateToken as defaultGetOrCreateToken } from '../share-token.js';

export type ShareOrchestratorDeps = {
  findConfig: (cwd: string) => ConfigLookup;
  gatherProject: (root: string) => GatheredProject;
  getDesignerName: (opts: { cliOverride?: string }) => Promise<string>;
  ensureShareConfig: (root: string) => boolean;
  getOrCreateToken: (root: string) => string;
  publishUpdate: (input: {
    root: string;
    branch: string;
    projectId: string;
  }) => Promise<PublishUpdateResult>;
  createShare: (input: ShareCreateInput) => Promise<ShareCreateResponse>;
  renderQr: (url: string) => string;
  log: (m: string) => void;
  error?: (m: string) => void;
  exit?: (code: number) => void;
};

export type ShareCliOptions = {
  cliOverride: string | undefined;
};

function buildDefaults(): ShareOrchestratorDeps {
  return {
    findConfig: defaultFindConfig,
    gatherProject: defaultGatherProject,
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
    ensureShareConfig: defaultEnsureShareConfig,
    getOrCreateToken: defaultGetOrCreateToken,
    publishUpdate: (input) => defaultPublishUpdate(input),
    createShare: (input) => defaultCreateShare(input),
    renderQr: defaultRenderQr,
    log: (m) => console.log(m),
    error: (m) => console.error(m),
    exit: (code) => process.exit(code),
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

/**
 * `proto share` — publish the project's real bundle as an EAS Update and register
 * a `prototo.app/p/<token>` link. The link opens a web page that streams the live
 * prototype running on a cloud device (Appetize) — full fidelity, no install.
 */
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

  let project: GatheredProject;
  try {
    project = deps.gatherProject(config.root);
  } catch {
    deps.log(messages.shareBadInput);
    return;
  }

  // Point the prototype's managed config at the central project + runtime, then
  // mint/reuse its stable token (the EAS Update branch).
  deps.ensureShareConfig(config.root);
  const token = deps.getOrCreateToken(config.root);

  deps.log(messages.sharePublishing);
  const published = await deps.publishUpdate({
    root: config.root,
    branch: token,
    projectId: SHARE_PROJECT_ID,
  });
  if (!published.ok) {
    deps.log(messages.sharePublishFailed);
    return;
  }

  let share: ShareCreateResponse;
  try {
    share = await deps.createShare({
      token,
      designerName,
      appName: project.config.name,
      deepLink: published.deepLink,
    });
  } catch (err) {
    deps.log(mapShareError(err) ?? messages.shareApiUnreachable);
    return;
  }

  deps.log(messages.shareLive(share.url));
  deps.log('');
  deps.log(messages.shareScanCopy);
  deps.log(deps.renderQr(share.url));
}
