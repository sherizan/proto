import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(here, '../template');

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

describe('template integrity', () => {
  it('never ships test files into a designer project (they import vitest)', () => {
    // proto-components keeps tests beside source; sync-template must strip them.
    const vendored = path.join(templateDir, 'components/proto');
    const tests = walkFiles(vendored).filter((f) => /\.test\.tsx?$/.test(f));
    expect(tests).toEqual([]);
  });

  it('pins react-dom to the same version as react (avoids the ERESOLVE that breaks proto add)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(templateDir, 'package.json'), 'utf8'));
    const react = pkg.dependencies?.react;
    const reactDom = pkg.dependencies?.['react-dom'];
    expect(react).toBeTruthy();
    // expo-router pulls react-dom as an optional peer; if it's unpinned it floats to a
    // newer patch that demands a newer react, and every `expo install` / `proto add` fails.
    expect(reactDom).toBe(react);
  });

  it('declares @sherizan/proto-cli exactly once, pinned to the current CLI minor', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(templateDir, 'package.json'), 'utf8'));
    // Declaring it in BOTH dependencies and devDependencies with disjoint ^ ranges
    // (the 0.7.0-release bug: a stray deps ^0.7.0 left the old devDeps ^0.6.0 behind)
    // makes npm resolve the LOWER range and ship a stale CLI — no `proto record`, no
    // share gate. It must live in exactly one section.
    const declarations = [
      pkg.dependencies?.['@sherizan/proto-cli'],
      pkg.devDependencies?.['@sherizan/proto-cli'],
    ].filter(Boolean);
    expect(declarations).toHaveLength(1);
    // A 0.x caret locks the minor, so the pin's minor must match the CLI this monorepo
    // would propagate, or fresh scaffolds can't resolve to the current CLI line.
    const cliVersion = JSON.parse(
      fs.readFileSync(path.resolve(here, '../../proto-cli/package.json'), 'utf8'),
    ).version as string;
    const [maj, min] = cliVersion.split('.');
    expect(declarations[0]).toBe(`^${maj}.${min}.0`);
  });

  it('ships a .mcp.json that auto-connects Claude Code to the prototo MCP server', () => {
    // Wires the local feedback-loop tools (compile_check + get_simulator_screenshot).
    // The `proto-mcp` bin is provided by @sherizan/proto-cli, already a project dep.
    const raw = fs.readFileSync(path.join(templateDir, '.mcp.json'), 'utf8');
    const config = JSON.parse(raw);
    expect(config.mcpServers?.prototo).toEqual({ command: 'npx', args: ['proto-mcp'] });
  });
});
