import { messages } from '../messages.js';

// Matches both tsc output formats:
//   non-pretty: screens/Home.tsx(8,12): error TS2322: ...
//   pretty:     screens/Home.tsx:8:12 - error TS2322: ...
const ERROR_LINE = /^(.*?\.tsx?)[(:].*?\berror TS\d+:\s*(.*)$/;

function fileLabel(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function translateOne(file: string, message: string): string {
  if (/Cannot find module/.test(message)) return messages.compileImportError(file);
  if (/Property '.*' does not exist/.test(message)) return messages.compilePropError(file);
  if (/is not assignable to/.test(message)) return messages.compileTypeError(file);
  return messages.compileGenericError(file);
}

/**
 * The raw tsc diagnostic lines (`file(line,col): error TSxxxx: message`),
 * deduped, order preserved. The MCP caller is Claude Code — it needs the real
 * error text to act; the friendly summary alone forced a tsc re-run every time
 * (PERF-REPORT fix 1).
 */
export function extractTscErrorLines(raw: string): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const line of raw.split('\n')) {
    if (!ERROR_LINE.test(line)) continue;
    const trimmed = line.trim();
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    lines.push(trimmed);
  }
  return lines;
}

export function translateTscError(raw: string): string {
  const friendly: string[] = [];
  const seen = new Set<string>();

  for (const line of raw.split('\n')) {
    const match = line.match(ERROR_LINE);
    if (!match) continue;
    const path = match[1];
    const message = match[2];
    if (!path || !message) continue;
    const translated = translateOne(fileLabel(path), message);
    if (seen.has(translated)) continue;
    seen.add(translated);
    friendly.push(translated);
  }

  if (friendly.length === 0) return messages.compileNoErrors;
  return friendly.join('\n');
}
