import { listProjectProfiles, applyProjectProfile } from '../design-project.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runCompileCheck } from './compile-check.js';
import { runGetMetroErrors } from './metro-errors-tool.js';
import { runReloadApp } from './reload-app.js';
import { getSimulatorScreenshot } from './screenshot.js';
import { runScroll, runTap } from './sim-input.js';

// The prototo MCP server's tools. index.ts is the stdio entry (proto-mcp);
// kept apart so tests can build the server without starting stdio.
export function createServer(cwd: string): McpServer {
  const server = new McpServer({ name: 'prototo', version: '1.0.0' });

  server.registerTool(
    'get_simulator_screenshot',
    {
      description:
        'See what the prototype actually renders right now. Call this after writing a screen to confirm it rendered, instead of assuming.',
    },
    async () => getSimulatorScreenshot({ cwd }),
  );

  server.registerTool(
    'tap_simulator',
    {
      description:
        'Tap the Simulator screen, like a finger. x and y are fractions (0–1) of the width and height of the latest get_simulator_screenshot: (0.5, 0.5) is the centre. Use it to open screens, press buttons, go back, and check pressed or selected states. Screenshot again afterwards to see the result.',
      inputSchema: {
        x: z.number().min(0).max(1).describe('0 = left edge, 1 = right edge'),
        y: z.number().min(0).max(1).describe('0 = top edge, 1 = bottom edge'),
      },
    },
    async ({ x, y }) => {
      const text = await runTap({ x, y });
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.registerTool(
    'scroll_simulator',
    {
      description:
        'Scroll the Simulator screen with a finger drag through the middle of the screen. "down" shows content further down. Use it to check anything below the fold, then screenshot again.',
      inputSchema: {
        direction: z.enum(['up', 'down', 'left', 'right']),
        amount: z
          .number()
          .min(0.05)
          .max(0.8)
          .optional()
          .describe('How far to drag, as a fraction of the screen. Default 0.5 (half a screen).'),
      },
    },
    async ({ direction, amount }) => {
      const text = await runScroll({ direction, amount });
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.registerTool(
    'compile_check',
    {
      description:
        'Type-check the project and report any errors in designer-friendly language. Call this after writing a screen to catch problems before the designer sees them.',
      inputSchema: {
        screenName: z
          .string()
          .optional()
          .describe('Only report errors for this screen, e.g. "Settings"'),
      },
    },
    async ({ screenName }) => {
      const text = await runCompileCheck({ cwd, screenName });
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.registerTool(
    'reload_app',
    {
      description:
        'Cold-restart the prototype in the Simulator and reconnect it to Metro. Call this after changing app/_layout.tsx or any navigator — root-layout changes do NOT apply via Fast Refresh, and screenshots of the stale UI look plausible.',
    },
    async () => {
      const text = await runReloadApp();
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.registerTool(
    'get_metro_errors',
    {
      description:
        'Check the current error state of the running prototype — build failures and runtime crashes, in designer-friendly language plus the raw error. Call this first in any fix session instead of asking the designer to paste errors.',
    },
    async () => {
      const text = await runGetMetroErrors({ cwd });
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  const designReply = (run: () => unknown) => {
    try { return { content: [{ type: 'text' as const, text: JSON.stringify(run()) }] }; }
    catch (error) { return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }] }; }
  };
  server.registerTool('list_design_profiles', {
    description: 'Read this project’s design, revision, supported capabilities and shared design profiles. Choose a direction suited to the brief; preserve existing branding. This does not change the project.',
    annotations: { readOnlyHint: true },
  }, async () => designReply(() => listProjectProfiles(cwd)));
  server.registerTool('apply_design_profile', {
    description: 'Apply a versioned shared design profile and refresh its design notes together. Read list_design_profiles first. Preserve existing overrides unless the user explicitly requests replacing their branding. Existing projects need compatible managed components.',
    inputSchema: {
      expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
      profileId: z.enum(['warm', 'utility', 'editorial', 'expressive']),
      version: z.string().max(30), overrides: z.record(z.unknown()).optional(),
      preserveExisting: z.boolean().default(true),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async options => designReply(() => applyProjectProfile(cwd, options)));

  return server;
}
