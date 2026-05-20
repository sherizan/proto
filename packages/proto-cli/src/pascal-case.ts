export type PascalCaseResult =
  | { ok: true; name: string }
  | { ok: false };

export function toPascalCase(input: string): PascalCaseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false };
  const parts = trimmed.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return { ok: false };
  const name = parts
    .map((part) => {
      const lower = part.toLowerCase();
      const first = lower.charAt(0);
      return first.toUpperCase() + lower.slice(1);
    })
    .join('');
  if (!/^[A-Za-z]/.test(name)) return { ok: false };
  return { ok: true, name };
}
