import { describe, expect, it } from 'vitest';
import { renderTemplate, type TemplateName } from './new-screen-templates';

const TEMPLATES: TemplateName[] = ['empty', 'home', 'list', 'detail', 'form', 'modal'];

describe('renderTemplate', () => {
  for (const tpl of TEMPLATES) {
    it(`${tpl} template renders non-empty TSX with the screen name substituted`, () => {
      const out = renderTemplate(tpl, 'Profile');
      expect(out.length).toBeGreaterThan(20);
      expect(out).toContain('export default function Profile');
      expect(out).not.toContain('{{name}}');
    });

    it(`${tpl} template references only Proto components`, () => {
      const out = renderTemplate(tpl, 'Profile');
      expect(out).toContain("from '../components/proto'");
      expect(out).not.toContain("from 'react-native'");
      expect(out).not.toContain("from 'react-native/'");
    });
  }

  it('substitutes the name into Screen title as well', () => {
    const out = renderTemplate('empty', 'Settings');
    expect(out).toContain('title="Settings"');
  });

  it('throws for an unknown template name', () => {
    expect(() => renderTemplate('does-not-exist' as TemplateName, 'X')).toThrow();
  });
});
