export type PackageManager = 'npm' | 'pnpm' | 'yarn';

export function detectPm(userAgent: string | undefined): PackageManager {
  if (!userAgent) return 'npm';
  if (userAgent.startsWith('pnpm/')) return 'pnpm';
  if (userAgent.startsWith('yarn/')) return 'yarn';
  if (userAgent.startsWith('npm/')) return 'npm';
  return 'npm';
}
