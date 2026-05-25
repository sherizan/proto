import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDesignerName, type IdentityDeps } from './designer-identity.js';

function makeConfigRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'proto-identity-'));
}

function makeDeps(overrides: Partial<IdentityDeps>): IdentityDeps {
  return {
    run: () => '',
    prompt: async () => '',
    configRoot: '',
    ...overrides,
  };
}

describe('getDesignerName', () => {
  let configRoot: string;
  beforeEach(() => {
    configRoot = makeConfigRoot();
  });
  afterEach(() => {
    if (fs.existsSync(configRoot)) fs.rmSync(configRoot, { recursive: true, force: true });
  });

  it('uses --as CLI override first, ignoring everything else', async () => {
    const name = await getDesignerName({
      cliOverride: 'CLI Sheri',
      deps: makeDeps({ configRoot, run: () => 'git Sheri', prompt: async () => 'prompt Sheri' }),
    });
    expect(name).toBe('CLI Sheri');
  });

  it('reads cached name from ~/.prototo/config.json second', async () => {
    fs.mkdirSync(path.join(configRoot, '.prototo'), { recursive: true });
    fs.writeFileSync(
      path.join(configRoot, '.prototo', 'config.json'),
      JSON.stringify({ designerName: 'Cached Sheri' }),
    );
    const name = await getDesignerName({
      deps: makeDeps({ configRoot, run: () => 'git Sheri', prompt: async () => 'prompt Sheri' }),
    });
    expect(name).toBe('Cached Sheri');
  });

  it('reads git config user.name third + persists it to config.json', async () => {
    const name = await getDesignerName({
      deps: makeDeps({
        configRoot,
        run: (cmd, args) => {
          if (cmd === 'git' && args.join(' ') === 'config user.name') return 'Git Sheri\n';
          return '';
        },
        prompt: async () => 'prompt Sheri',
      }),
    });
    expect(name).toBe('Git Sheri');
    const persisted = JSON.parse(
      fs.readFileSync(path.join(configRoot, '.prototo', 'config.json'), 'utf8'),
    );
    expect(persisted.designerName).toBe('Git Sheri');
  });

  it('prompts when git is empty + persists the prompted value', async () => {
    const name = await getDesignerName({
      deps: makeDeps({
        configRoot,
        run: () => '', // git returns empty
        prompt: async () => 'Prompted Sheri',
      }),
    });
    expect(name).toBe('Prompted Sheri');
    const persisted = JSON.parse(
      fs.readFileSync(path.join(configRoot, '.prototo', 'config.json'), 'utf8'),
    );
    expect(persisted.designerName).toBe('Prompted Sheri');
  });

  it('prompts when git throws (no git installed)', async () => {
    const name = await getDesignerName({
      deps: makeDeps({
        configRoot,
        run: () => {
          throw new Error('git: command not found');
        },
        prompt: async () => 'No-git Sheri',
      }),
    });
    expect(name).toBe('No-git Sheri');
  });

  it('trims whitespace from the resolved name', async () => {
    const name = await getDesignerName({
      deps: makeDeps({ configRoot, run: () => '  Sheri  \n' }),
    });
    expect(name).toBe('Sheri');
  });

  it('rejects empty name from prompt by re-prompting (loops once for test simplicity)', async () => {
    let promptCalls = 0;
    const name = await getDesignerName({
      deps: makeDeps({
        configRoot,
        run: () => '',
        prompt: async () => {
          promptCalls += 1;
          return promptCalls === 1 ? '   ' : 'Eventually Sheri';
        },
      }),
    });
    expect(name).toBe('Eventually Sheri');
    expect(promptCalls).toBe(2);
  });

  it('truncates names longer than 60 chars (share-api ceiling)', async () => {
    const longName = 'A'.repeat(120);
    const name = await getDesignerName({
      cliOverride: longName,
      deps: makeDeps({ configRoot }),
    });
    expect(name.length).toBe(60);
  });
});
