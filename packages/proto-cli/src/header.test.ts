import { describe, expect, it } from 'vitest';
import { renderHeader, type HeaderInputs } from './header.js';

function base(): HeaderInputs {
  return {
    brand: 'Proto',
    version: '0.1.0',
    theme: 'liquidGlass',
    target: 'iOS preview',
    cwd: '/private/tmp/myapp',
  };
}

describe('renderHeader', () => {
  it('renders three lines with mark + brand version + theme + cwd', () => {
    const out = renderHeader(base());
    const lines = out.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Proto v0.1.0');
    expect(lines[1]).toContain('Liquid Glass · iOS preview');
    expect(lines[2]).toContain('/private/tmp/myapp');
  });

  it('renders the Option D dotted-grid mark on the left of each line', () => {
    const out = renderHeader(base());
    const lines = out.split('\n');
    expect(lines[0].startsWith('▗ ▗ ▗')).toBe(true);
    expect(lines[1].startsWith(' ▗ ▗')).toBe(true);
    expect(lines[2].startsWith('▗ ▗ ▗')).toBe(true);
  });

  it('formats theme names humanly', () => {
    expect(renderHeader({ ...base(), theme: 'liquidGlass' })).toContain('Liquid Glass');
    expect(renderHeader({ ...base(), theme: 'materialYou' })).toContain('Material You');
    expect(renderHeader({ ...base(), theme: 'base' })).toContain('Base');
  });

  it('falls back to liquidGlass label for unknown themes', () => {
    expect(renderHeader({ ...base(), theme: 'somethingNew' })).toContain('Liquid Glass');
  });
});
