#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { findConfig } from '../find-config.js';
import { createServer } from './server.js';

// Resolve the Prototo project root. The MCP server is spawned by Claude Code
// with cwd set to the project, so this is the project dir in practice; fall
// back to cwd so the tools still run (and report their own friendly states).
function projectRoot(): string {
  const cwd = process.cwd();
  const found = findConfig(cwd);
  return found.ok ? found.root : cwd;
}

async function main(): Promise<void> {
  const server = createServer(projectRoot());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`prototo-mcp failed to start: ${err?.message ?? err}\n`);
  process.exit(1);
});
