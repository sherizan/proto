import { execFileSync } from 'node:child_process';

/**
 * Open a URL in the designer's default browser. Best-effort and cross-platform —
 * any failure is swallowed because every caller also prints the URL for manual
 * opening. Used by `proto login`, `proto record`, and `proto share`'s upgrade nudge.
 */
export function openBrowser(url: string): void {
  try {
    if (process.platform === 'darwin') execFileSync('open', [url], { stdio: 'ignore' });
    else if (process.platform === 'win32')
      execFileSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' });
    else execFileSync('xdg-open', [url], { stdio: 'ignore' });
  } catch {
    // best-effort — the URL is also printed for manual opening
  }
}
