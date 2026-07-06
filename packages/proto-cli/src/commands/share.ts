import { isCancel, text } from '@clack/prompts';
import { readCliToken as defaultReadCliToken } from '../cli-token.js';
import { getDesignerName as defaultGetDesignerName } from '../designer-identity.js';
import { type ConfigLookup, findConfig as defaultFindConfig } from '../find-config.js';
import { messages } from '../messages.js';
import { openBrowser as defaultOpenBrowser } from '../open-browser.js';
import {
  type PublishUpdateResult,
  publishUpdate as defaultPublishUpdate,
} from '../publish-update.js';
import { renderQr as defaultRenderQr } from '../render-qr.js';
import {
  ShareApiError,
  type ShareCreateInput,
  type ShareCreateResponse,
  type SharePreflightResponse,
  accountUrl,
  createShare as defaultCreateShare,
  preflightShare as defaultPreflightShare,
} from '../share-api.js';
import { ensureShareConfig as defaultEnsureShareConfig } from '../share-config.js';
import { type GatheredProject, gatherProject as defaultGatherProject } from '../share-project.js';
import { getOrCreateToken as defaultGetOrCreateToken } from '../share-token.js';
import { terminalLink } from '../terminal-link.js';
import { runLogin as defaultRunLogin } from './login.js';

export type ShareOrchestratorDeps = {
  findConfig: (cwd: string) => ConfigLookup;
  gatherProject: (root: string) => GatheredProject;
  getDesignerName: (opts: { cliOverride?: string }) => Promise<string>;
  getCliToken: () => string | null;
  login: () => Promise<string | null>;
  ensureShareConfig: (root: string) => boolean;
  getOrCreateToken: (root: string) => string;
  publishUpdate: (input: {
    root: string;
    token: string;
    accountToken: string;
  }) => Promise<PublishUpdateResult>;
  createShare: (input: ShareCreateInput, token: string) => Promise<ShareCreateResponse>;
  preflightShare: (token: string, accountToken: string) => Promise<SharePreflightResponse | null>;
  renderQr: (url: string) => string;
  openBrowser: (url: string) => void;
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
    getCliToken: () => defaultReadCliToken(),
    login: () => defaultRunLogin(),
    ensureShareConfig: defaultEnsureShareConfig,
    getOrCreateToken: defaultGetOrCreateToken,
    publishUpdate: (input) => defaultPublishUpdate(input),
    createShare: (input, token) => defaultCreateShare(input, { token }),
    preflightShare: (token, accountToken) => defaultPreflightShare(token, { token: accountToken }),
    renderQr: defaultRenderQr,
    openBrowser: defaultOpenBrowser,
    log: (m) => console.log(m),
    error: (m) => console.error(m),
    exit: (code) => process.exit(code),
  };
}

/** Tell the designer they've hit their share cap and send them to upgrade.
 * PROTO_NO_BROWSER=1 (set by Prototo Desktop on its share spawn) suppresses the
 * browser open — the desktop shows its own upgrade UI instead. Scoped to the
 * cap path only: login and record→Studio browser opens are unaffected. */
function handleCapReached(deps: ShareOrchestratorDeps): void {
  deps.log(messages.shareProjectCap);
  if (process.env.PROTO_NO_BROWSER !== '1') deps.openBrowser(accountUrl());
}

// Map a publishUpdate failure to a designer-friendly message. Known causes get a
// specific line; anything else (export/upload failures, which carry raw Metro/HTTP
// detail) falls back to the generic message so no engineering jargon leaks.
function mapPublishError(error: string): string {
  if (error === 'unauthorized') return messages.shareLoginExpired;
  if (error === 'owner-mismatch') return messages.shareOwnerMismatch;
  if (error === 'network') return messages.shareApiUnreachable;
  return messages.sharePublishFailed;
}

function mapShareError(err: unknown): string | null {
  if (err instanceof ShareApiError) {
    if (err.kind === 'unauthorized') return messages.shareLoginExpired;
    // cap-reached is handled by handleCapReached (opens the upgrade page) before this.
    if (err.kind === 'owner-mismatch') return messages.shareOwnerMismatch;
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

  // Shares attach to an account. Resolve the login token first (before the slow
  // publish) so an unsigned-in designer is taken through sign-in, not stranded.
  let accountToken = deps.getCliToken();
  if (!accountToken) {
    deps.log(messages.shareNeedsLogin);
    accountToken = await deps.login();
    if (!accountToken) return;
  }

  // Point the prototype's managed config at the central project + runtime, then
  // mint/reuse its stable token (the EAS Update branch).
  deps.ensureShareConfig(config.root);
  const token = deps.getOrCreateToken(config.root);

  // Gate BEFORE the slow publish: ask the server whether this share fits the
  // designer's tier. Capped → nudge to upgrade and open the account page, no
  // publish. Fail-open (null) → continue; the 403 backstop below still enforces.
  const preflight = await deps.preflightShare(token, accountToken);
  if (preflight && !preflight.allowed) {
    handleCapReached(deps);
    return;
  }

  deps.log(messages.sharePublishing);
  const published = await deps.publishUpdate({
    root: config.root,
    token,
    accountToken,
  });
  if (!published.ok) {
    deps.log(mapPublishError(published.error));
    return;
  }

  let share: ShareCreateResponse;
  try {
    share = await deps.createShare(
      {
        token,
        designerName,
        appName: project.config.name,
        deepLink: published.deepLink,
      },
      accountToken,
    );
  } catch (err) {
    // Backstop: the server is the authority on the cap. If preflight was skipped
    // (fail-open) or the count changed mid-publish, the 403 still routes to upgrade.
    if (err instanceof ShareApiError && err.kind === 'cap-reached') {
      handleCapReached(deps);
      return;
    }
    deps.log(mapShareError(err) ?? messages.shareApiUnreachable);
    return;
  }

  deps.log(messages.shareLive(terminalLink(share.url)));
  deps.log('');
  deps.log(messages.shareScanCopy);
  deps.log(deps.renderQr(share.url));
}
