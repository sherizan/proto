import { describe, expect, it } from 'vitest';
import { validateName } from './validate-name';

describe('validateName', () => {
  it('accepts a simple lowercase name', () => {
    expect(validateName('my-app')).toEqual({ ok: true, sanitized: 'my-app' });
  });

  it('trims surrounding whitespace', () => {
    expect(validateName('  my-app  ')).toEqual({ ok: true, sanitized: 'my-app' });
  });

  it('lowercases uppercase input', () => {
    expect(validateName('My-App')).toEqual({ ok: true, sanitized: 'my-app' });
  });

  it('rejects names with spaces', () => {
    const result = validateName('my app');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/space/i);
  });

  it('rejects empty input', () => {
    expect(validateName('').ok).toBe(false);
    expect(validateName('   ').ok).toBe(false);
  });

  it('rejects reserved names', () => {
    expect(validateName('node_modules').ok).toBe(false);
    expect(validateName('.proto').ok).toBe(false);
    expect(validateName('proto').ok).toBe(false);
  });

  it('rejects names starting with a digit', () => {
    expect(validateName('1app').ok).toBe(false);
  });

  it('rejects names longer than 214 characters', () => {
    expect(validateName('a'.repeat(215)).ok).toBe(false);
  });

  it('rejects names with uppercase that contain invalid chars after lowercasing', () => {
    expect(validateName('My App').ok).toBe(false);
  });
});
