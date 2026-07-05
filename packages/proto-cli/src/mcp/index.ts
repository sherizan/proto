#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { findConfig } from '../find-config.js';
import { runCompileCheck } from './compile-check.js';
import { runGetMetroErrors } from './metro-errors-tool.js';
import { getSimulatorScreenshot } from './screenshot.js';

// Resolve the Prototo project root. The MCP server is spawned by Claude Code
// with cwd set to the project, so this is the project dir in practice; fall
// back to cwd so the tools still run (and report their own friendly states).
function projectRoot(): string {
  const cwd = process.cwd();
  const found = findConfig(cwd);
  return found.ok ? found.root : cwd;
}

export function createServer(cwd: string): McpServer {
  const server = new McpServer({ name: 'prototo', version: '1.0.0' });

  server.tool(
    'get_simulator_screenshot',
    'See what the prototype actually renders right now. Call this after writing a screen to confirm it rendered, instead of assuming.',
    async () => getSimulatorScreenshot({ cwd }),
  );

  server.tool(
    'compile_check',
    'Type-check the project and report any errors in designer-friendly language. Call this after writing a screen to catch problems before the designer sees them.',
    {
      screenName: z
        .string()
        .optional()
        .describe('Only report errors for this screen, e.g. "Settings"'),
    },
    async ({ screenName }) => {
      const text = await runCompileCheck({ cwd, screenName });
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.tool(
    'get_metro_errors',
    'Check the current error state of the running prototype — build failures and runtime crashes, in designer-friendly language plus the raw error. Call this first in any fix session instead of asking the designer to paste errors.',
    async () => {
      const text = await runGetMetroErrors({ cwd });
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  return server;
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
