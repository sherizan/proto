import { isCancel, text } from '@clack/prompts';
import { readCliToken as defaultReadCliToken } from '../cli-token.js';
import { getDesignerName as defaultGetDesignerName } from '../designer-identity.js';
import { type ConfigLookup, findConfig as defaultFindConfig } from '../find-config.js';
import { messages } from '../messages.js';
import { openBrowser as defaultOpenBrowser } from '../open-browser.js';
import { publishFiles as defaultPublishFiles } from '../publish-update.js';
import {
  type FlowCreateInput,
  type FlowCreateResponse,
  ShareApiError,
  type SharePreflightResponse,
  createFlow as defaultCreateFlow,
  preflightShare as defaultPreflightShare,
  pricingUrl,
} from '../share-api.js';
import {
  type FlowFile,
  captureFlow as defaultCaptureFlow,
  defaultCaptureFlowDeps,
} from '../share-flow.js';
import { type GatheredProject, gatherProject as defaultGatherProject } from '../share-project.js';
import { getOrCreateToken as defaultGetOrCreateToken } from '../share-token.js';
import { runLogin as defaultRunLogin } from './login.js';

// `proto flow` (#25): export the prototype's flow, every screen and how they
// link, to its own link prototo.app/f/<token>, without publishing the app.
// Prototo Desktop runs it from the Flow view's "Export flow" (and hides the
// screen walk behind its Publish-style modal). Same token, login and trial gate
// as `proto share`.

export type FlowOrchestratorDeps = {
  findConfig: (cwd: string) => ConfigLookup;
  gatherProject: (root: string) => GatheredProject;
  getDesignerName: (opts: { cliOverride?: string }) => Promise<string>;
  getCliToken: () => string | null;
  login: () => Promise<string | null>;
  getOrCreateToken: (root: string) => string;
  preflightShare: (token: string, accountToken: string) => Promise<SharePreflightResponse | null>;
  captureFlow: (
    root: string,
    onWalk: (done: number, total: number) => void,
  ) => Promise<{ files: FlowFile[]; screenCount: number } | null>;
  publishFiles: (input: {
    token: string;
    accountToken: string;
    files: FlowFile[];
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  createFlow: (input: FlowCreateInput, accountToken: string) => Promise<FlowCreateResponse>;
  openBrowser: (url: string) => void;
  log: (m: string) => void;
  error?: (m: string) => void;
  exit?: (code: number) => void;
};

function buildDefaults(): FlowOrchestratorDeps {
  return {
    findConfig: defaultFindConfig,
    gatherProject: defaultGatherProject,
    getDesignerName: ({ cliOverride }) =>
      defaultGetDesignerName({
        cliOverride,
        deps: {
          prompt: async (message) => {
            const result = await text({ message });
            if (isCancel(result) || typeof result !== 'string') process.exit(0);
            return result;
          },
        },
      }),
    getCliToken: () => defaultReadCliToken(),
    login: () => defaultRunLogin(),
    getOrCreateToken: defaultGetOrCreateToken,
    preflightShare: (token, accountToken) => defaultPreflightShare(token, { token: accountToken }),
    captureFlow: (root, onWalk) =>
      defaultCaptureFlow(root, { ...defaultCaptureFlowDeps(), onWalk }),
    publishFiles: (input) => defaultPublishFiles(input),
    createFlow: (input, token) => defaultCreateFlow(input, { token }),
    openBrowser: defaultOpenBrowser,
    log: (m) => console.log(m),
    error: (m) => console.error(m),
    exit: (code) => process.exit(code),
  };
}

// Same "publish trial has ended" phrase as proto share: the desktop's upgrade
// modal keys on it (CONTRACTS.md).
function trialEnded(deps: FlowOrchestratorDeps): void {
  deps.log(messages.sharePublishTrialEnded(pricingUrl()));
  if (process.env.PROTO_NO_BROWSER !== '1') deps.openBrowser(pricingUrl());
}

export async function runFlow(
  opts: { cliOverride: string | undefined },
  injected?: Partial<FlowOrchestratorDeps>,
): Promise<void> {
  const deps: FlowOrchestratorDeps = { ...buildDefaults(), ...injected };
  const exit = deps.exit ?? (() => {});

  const config = deps.findConfig(process.cwd());
  if (!config.ok) {
    (deps.error ?? deps.log)(config.reason);
    exit(1);
    return;
  }
  deps.log(messages.flowStarting);

  const designerName = await deps.getDesignerName({ cliOverride: opts.cliOverride });
  let project: GatheredProject;
  try {
    project = deps.gatherProject(config.root);
  } catch {
    deps.log(messages.shareBadInput);
    return;
  }

  let accountToken = deps.getCliToken();
  if (!accountToken) {
    deps.log(messages.shareNeedsLogin);
    accountToken = await deps.login();
    if (!accountToken) return;
  }

  const token = deps.getOrCreateToken(config.root);
  const preflight = await deps.preflightShare(token, accountToken);
  if (preflight && !preflight.allowed) {
    trialEnded(deps);
    return;
  }

  const flow = await deps.captureFlow(config.root, (done, total) =>
    deps.log(messages.shareCapturingScreens(done, total)),
  );
  if (!flow) {
    deps.log(messages.flowEmpty);
    return;
  }

  deps.log(messages.flowUploading);
  const uploaded = await deps.publishFiles({ token, accountToken, files: flow.files });
  if (!uploaded.ok) {
    if (uploaded.error === 'trial-expired') return trialEnded(deps);
    if (uploaded.error === 'unauthorized') return deps.log(messages.shareLoginExpired);
    if (uploaded.error === 'owner-mismatch') return deps.log(messages.flowOwnerMismatch);
    return deps.log(messages.flowFailed);
  }

  let created: FlowCreateResponse;
  try {
    created = await deps.createFlow(
      { token, designerName, appName: project.config.name, screenCount: flow.screenCount },
      accountToken,
    );
  } catch (err) {
    if (err instanceof ShareApiError) {
      if (err.kind === 'trial-expired') return trialEnded(deps);
      if (err.kind === 'unauthorized') return deps.log(messages.shareLoginExpired);
      if (err.kind === 'owner-mismatch') return deps.log(messages.flowOwnerMismatch);
      if (err.kind === 'rate-limited') return deps.log(messages.shareRateLimited);
    }
    deps.log(messages.flowFailed);
    return;
  }

  deps.log(messages.flowLive(created.url));
  if (created.trialJustStarted)
    deps.log(messages.shareTrialStarted(created.trialEndsAt, pricingUrl()));
}
