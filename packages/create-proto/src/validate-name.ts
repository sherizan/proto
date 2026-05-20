import validate from 'validate-npm-package-name';

export type NameValidation =
  | { ok: true; sanitized: string }
  | { ok: false; reason: string };

const RESERVED = new Set(['node_modules', '.proto', 'proto']);

export function validateName(input: string): NameValidation {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, reason: 'Give your prototype a name.' };
  }
  if (/\s/.test(trimmed)) {
    return {
      ok: false,
      reason: 'No spaces allowed. Try hyphens instead, like "my-app".',
    };
  }
  const sanitized = trimmed.toLowerCase();
  if (RESERVED.has(sanitized)) {
    return { ok: false, reason: 'That name is reserved. Pick something else.' };
  }
  if (/^\d/.test(sanitized)) {
    return {
      ok: false,
      reason: 'That name has characters that cause trouble. Use letters, numbers, and hyphens.',
    };
  }
  const result = validate(sanitized);
  if (!result.validForNewPackages) {
    return {
      ok: false,
      reason: 'That name has characters that cause trouble. Use letters, numbers, and hyphens.',
    };
  }
  return { ok: true, sanitized };
}
