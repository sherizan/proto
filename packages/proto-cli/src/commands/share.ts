import { isCancel, text } from '@clack/prompts';
import { compileManifest as defaultCompileManifest } from '@sherizan/proto-compile';
import { getDesignerName as defaultGetDesignerName } from '../designer-identity.js';
import { type ConfigLookup, findConfig as defaultFindConfig } from '../find-config.js';
import { messages } from '../messages.js';
import { renderQr as defaultRenderQr } from '../render-qr.js';
import {
  ShareApiError,
  type ShareCreateInput,
  type ShareCreateResponse,
  createShare as defaultCreateShare,
} from '../share-api.js';
import { type GatheredProject, gatherProject as defaultGatherProject } from '../share-project.js';

export type ShareOrchestratorDeps = {
  findConfig: (cwd: string) => ConfigLookup;
  gatherProject: (root: string) => GatheredProject;
  compileManifest: typeof defaultCompileManifest;
  getDesignerName: (opts: { cliOverride?: string }) => Promise<string>;
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
    compileManifest: defaultCompileManifest,
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
 * `proto share` — compile the project's screens to a declarative manifest and
 * upload it. The shareable `prototo.app/p/<token>` link opens an App Clip that
 * renders the manifest natively; no code crosses the wire.
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

  const compiled = deps.compileManifest(project.screens, project.config);
  if (!compiled.ok) {
    deps.log(messages.shareCompileFailed(compiled.errors));
    return;
  }
  if (compiled.warnings.length > 0) {
    deps.log(messages.shareWarnings(compiled.warnings));
  }

  let share: ShareCreateResponse;
  try {
    share = await deps.createShare({
      designerName,
      appName: project.config.name,
      manifest: compiled.manifest,
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
