import { describe, expect, it, vi } from 'vitest';
import { ShareApiError } from '../share-api.js';
import { type FlowOrchestratorDeps, runFlow } from './flow.js';

const FILES = [
  { uploadPath: 'screen-index.png', bytes: Buffer.from('png'), contentType: 'image/png' },
  { uploadPath: 'flow.json', bytes: Buffer.from('{}'), contentType: 'application/json' },
];

function makeDeps(over: Partial<FlowOrchestratorDeps> = {}) {
  const log = vi.fn();
  const deps: FlowOrchestratorDeps = {
    findConfig: () => ({ ok: true, root: '/proj', configPath: '/proj/proto.config.js' }) as never,
    gatherProject: () =>
      ({ screens: [], config: { name: 'Atlas', initialScreen: 'Home' } }) as never,
    getDesignerName: async () => 'Sheri',
    getCliToken: () => 'proto_acct',
    login: async () => null,
    getOrCreateToken: () => 'XK92MABCDEFG',
    preflightShare: async () => ({ allowed: true }) as never,
    captureFlow: async (_root, onWalk) => {
      onWalk(1, 1);
      return { files: FILES, screenCount: 3 };
    },
    publishFiles: vi.fn(async () => ({ ok: true as const })),
    createFlow: vi.fn(async () => ({ url: 'https://prototo.app/f/XK92MABCDEFG' })),
    openBrowser: vi.fn(),
    log,
    ...over,
  };
  return { deps, log };
}

const said = (log: ReturnType<typeof vi.fn>) => log.mock.calls.map((c) => String(c[0])).join('\n');

describe('proto flow (#25)', () => {
  it('captures, uploads the flow files, registers it, and prints the /f link', async () => {
    const { deps, log } = makeDeps();
    await runFlow({ cliOverride: undefined }, deps);
    expect(deps.publishFiles).toHaveBeenCalledWith({
      token: 'XK92MABCDEFG',
      accountToken: 'proto_acct',
      files: FILES,
    });
    expect(deps.createFlow).toHaveBeenCalledWith(
      { token: 'XK92MABCDEFG', designerName: 'Sheri', appName: 'Atlas', screenCount: 3 },
      'proto_acct',
    );
    expect(said(log)).toContain('Capturing your screens… 1 of 1');
    expect(said(log)).toContain('Your flow is live\n  https://prototo.app/f/XK92MABCDEFG');
  });

  it('stops before capturing when the Publish trial has ended (same phrase as proto share)', async () => {
    const captureFlow = vi.fn();
    const { deps, log } = makeDeps({
      preflightShare: async () => ({ allowed: false }) as never,
      captureFlow,
    });
    await runFlow({ cliOverride: undefined }, deps);
    expect(captureFlow).not.toHaveBeenCalled();
    expect(said(log)).toMatch(/publish trial has ended/i);
  });

  it('maps a 403 from the register call to the trial message too', async () => {
    const { deps, log } = makeDeps({
      createFlow: async () => {
        throw new ShareApiError('trial-expired', 'x');
      },
    });
    await runFlow({ cliOverride: undefined }, deps);
    expect(said(log)).toMatch(/publish trial has ended/i);
    expect(said(log)).not.toContain('Your flow is live');
  });

  it('says so when the project has no screens, and uploads nothing', async () => {
    const { deps, log } = makeDeps({ captureFlow: async () => null });
    await runFlow({ cliOverride: undefined }, deps);
    expect(deps.publishFiles).not.toHaveBeenCalled();
    expect(said(log)).toContain('No screens in this project yet');
  });

  it('reports another account owning the token', async () => {
    const { deps, log } = makeDeps({
      publishFiles: async () => ({ ok: false as const, error: 'owner-mismatch' }),
    });
    await runFlow({ cliOverride: undefined }, deps);
    expect(said(log)).toContain('belongs to another account');
    expect(deps.createFlow).not.toHaveBeenCalled();
  });
});
