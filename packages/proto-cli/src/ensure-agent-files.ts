// Backfill for projects scaffolded before create-proto 0.7.11 made the
// template agent-agnostic: Codex reads AGENTS.md (never CLAUDE.md) and gets
// the prototo MCP tools from project-scoped .codex/config.toml. Old projects
// have neither, so under Codex they'd run with no instructions and no tools.
// Runs on every `proto start`; only acts when a file is missing, never
// overwrites, and fails open — instruction files must never block a start.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Mirrors create-proto template/.codex/config.toml — keep the two in sync.
const CODEX_CONFIG = `# Prototo: connects Codex to this project's MCP tools (compile_check,
# get_metro_errors, get_simulator_screenshot, reload_app). Codex loads this
# once you trust the project. Claude Code uses .mcp.json for the same server.
[mcp_servers.prototo]
command = "npx"
args = ["proto-mcp"]
`;

export function ensureAgentFiles(root: string): void {
  try {
    const agentsPath = join(root, 'AGENTS.md');
    const claudePath = join(root, 'CLAUDE.md');
    if (!existsSync(agentsPath) && existsSync(claudePath)) {
      const claude = readFileSync(claudePath, 'utf8');
      // A pointer CLAUDE.md (@AGENTS.md) with a missing AGENTS.md means the
      // canonical doc was deleted — a copied pointer would be a one-line doc.
      if (!claude.includes('@AGENTS.md')) {
        writeFileSync(
          agentsPath,
          claude.replace(
            '# Prototo Project — Claude Code Instructions',
            '# Prototo Project — Agent Instructions',
          ),
        );
      }
    }

    const codexConfigPath = join(root, '.codex', 'config.toml');
    if (!existsSync(codexConfigPath)) {
      mkdirSync(join(root, '.codex'), { recursive: true });
      writeFileSync(codexConfigPath, CODEX_CONFIG);
    }
  } catch {
    // fail open: never block proto start over agent instruction files
  }
}
