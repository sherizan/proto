import { describe, expect, it } from 'vitest';
import { toPascalCase } from './pascal-case.js';

describe('toPascalCase', () => {
  it('PascalCases a multi-word lowercase name', () => {
    expect(toPascalCase('my profile')).toEqual({ ok: true, name: 'MyProfile' });
  });

  it('handles hyphens', () => {
    expect(toPascalCase('todo-list')).toEqual({ ok: true, name: 'TodoList' });
  });

  it('handles underscores', () => {
    expect(toPascalCase('user_settings')).toEqual({ ok: true, name: 'UserSettings' });
  });

  it('keeps an already-PascalCased single word', () => {
    expect(toPascalCase('Settings')).toEqual({ ok: true, name: 'Settings' });
  });

  it('lowercases then PascalCases mixed case input', () => {
    expect(toPascalCase('MyProfile')).toEqual({ ok: true, name: 'Myprofile' });
  });

  it('trims surrounding whitespace', () => {
    expect(toPascalCase('  hello world  ')).toEqual({ ok: true, name: 'HelloWorld' });
  });

  it('rejects empty input', () => {
    expect(toPascalCase('')).toEqual({ ok: false });
    expect(toPascalCase('   ')).toEqual({ ok: false });
  });

  it('rejects names that start with a digit after normalisation', () => {
    expect(toPascalCase('1app')).toEqual({ ok: false });
    expect(toPascalCase('123')).toEqual({ ok: false });
  });

  it('rejects names that contain only non-alphanumeric characters', () => {
    expect(toPascalCase('---')).toEqual({ ok: false });
    expect(toPascalCase('!@#')).toEqual({ ok: false });
  });
});
