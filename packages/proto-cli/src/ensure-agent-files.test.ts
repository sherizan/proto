import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureAgentFiles } from './ensure-agent-files.js';

const OLD_CLAUDE_MD = `# Prototo Project — Claude Code Instructions

You're the design tool inside a Prototo project.

## Proto MCP tools

Call get_metro_errors first.
`;

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-agent-files-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('ensureAgentFiles', () => {
  it('backfills AGENTS.md from a pre-0.7.11 CLAUDE.md, retitled, leaving CLAUDE.md untouched', () => {
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), OLD_CLAUDE_MD);

    ensureAgentFiles(root);

    const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('# Prototo Project — Agent Instructions');
    expect(agents).not.toContain('Claude Code Instructions');
    expect(agents).toContain('get_metro_errors');
    // the designer's existing file is never rewritten
    expect(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8')).toBe(OLD_CLAUDE_MD);
  });

  it('backfills .codex/config.toml registering the prototo MCP server', () => {
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), OLD_CLAUDE_MD);

    ensureAgentFiles(root);

    const toml = fs.readFileSync(path.join(root, '.codex/config.toml'), 'utf8');
    expect(toml).toContain('[mcp_servers.prototo]');
    expect(toml).toContain('command = "npx"');
    expect(toml).toContain('args = ["proto-mcp"]');
  });

  it('is idempotent on a post-0.7.11 project: never overwrites existing files', () => {
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'custom agents doc');
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '@AGENTS.md\n');
    fs.mkdirSync(path.join(root, '.codex'));
    fs.writeFileSync(path.join(root, '.codex/config.toml'), '# custom codex config\n');

    ensureAgentFiles(root);

    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toBe('custom agents doc');
    expect(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n');
    expect(fs.readFileSync(path.join(root, '.codex/config.toml'), 'utf8')).toBe(
      '# custom codex config\n',
    );
  });

  it('does not turn a pointer CLAUDE.md into AGENTS.md when the canonical file was deleted', () => {
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '@AGENTS.md\n');

    ensureAgentFiles(root);

    // copying the pointer would give agents a one-line doc; better to leave it absent
    expect(fs.existsSync(path.join(root, 'AGENTS.md'))).toBe(false);
    // the MCP registration is independent and still lands
    expect(fs.existsSync(path.join(root, '.codex/config.toml'))).toBe(true);
  });

  it('writes the codex config even when the project has no CLAUDE.md', () => {
    ensureAgentFiles(root);

    expect(fs.existsSync(path.join(root, 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.codex/config.toml'))).toBe(true);
  });

  it('fails open when the project dir is not writable or missing', () => {
    expect(() => ensureAgentFiles(path.join(root, 'does-not-exist'))).not.toThrow();
  });
});
