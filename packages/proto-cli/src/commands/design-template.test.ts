import { describe, expect, it } from 'vitest';
import { renderDesignDoc, type DesignInputs } from './design-template.js';
import { getLibrary, resolveCustomLibrary } from './design-libraries.js';

function baseInputs(): DesignInputs {
  return {
    appName: 'Acme',
    theme: 'liquidGlass',
    accent: '#007AFF',
    library: getLibrary('proto'),
    date: '2026-05-21',
  };
}

describe('renderDesignDoc — liquidGlass', () => {
  it('renders the app header, theme, and date', () => {
    const md = renderDesignDoc(baseInputs());
    expect(md).toContain(`Source of truth for Acme's design system.`);
    expect(md).toContain('Last updated: 2026-05-21');
    expect(md).toContain('- Name: Acme');
    expect(md).toContain('- Theme: liquidGlass');
    expect(md).toContain('- Platform: iOS');
  });

  it('uses the liquid-glass colour and effect defaults', () => {
    const md = renderDesignDoc(baseInputs());
    expect(md).toContain('- Accent: #007AFF');
    expect(md).toContain('- Surface primary: rgba(255,255,255,0.72)');
    expect(md).toContain('- Card blur: 20');
    expect(md).toContain('- Nav blur: 40');
    expect(md).toContain('- Modal blur: 60');
  });

  it('honours an accent override', () => {
    const md = renderDesignDoc({ ...baseInputs(), accent: '#FF2D55' });
    expect(md).toContain('- Accent: #FF2D55');
    expect(md).not.toContain('- Accent: #007AFF');
  });
});

describe('renderDesignDoc — materialYou', () => {
  it('renders Material You surface, text, and shape defaults', () => {
    const md = renderDesignDoc({
      ...baseInputs(),
      theme: 'materialYou',
      accent: '#6750A4',
    });
    expect(md).toContain('- Theme: materialYou');
    expect(md).toContain('- Accent: #6750A4');
    expect(md).toContain('- Surface primary: #FFFBFE');
    expect(md).toContain('- Text primary: #1C1B1F');
    expect(md).toContain('- Card radius: 12');
    expect(md).toContain('- Button radius: 20');
    expect(md).toContain('- Card blur: 0');
  });
});

describe('renderDesignDoc — base', () => {
  it('renders flat surfaces and no blur', () => {
    const md = renderDesignDoc({
      ...baseInputs(),
      theme: 'base',
      accent: '#000000',
    });
    expect(md).toContain('- Theme: base');
    expect(md).toContain('- Accent: #000000');
    expect(md).toContain('- Surface primary: #FFFFFF');
    expect(md).toContain('- Card blur: 0');
    expect(md).toContain('- Nav blur: 0');
  });
});

describe('renderDesignDoc — component library section', () => {
  it('writes the built-in Proto library section', () => {
    const md = renderDesignDoc(baseInputs());
    expect(md).toContain('## Component Library');
    expect(md).toContain('- Package: proto (built-in)');
    expect(md).toContain('- Import from: ../components/proto');
    expect(md).toContain('- Fallback: proto');
    expect(md).not.toMatch(/^- Docs:/m);
  });

  it('writes motion / gestures / lottie / canvas subpath lines for the proto library', () => {
    const md = renderDesignDoc(baseInputs());
    expect(md).toContain(
      '- Motion (declarative transitions, preferred for animations): ../components/proto/motion',
    );
    expect(md).toContain(
      '- Gestures (drag / scroll / shared-value animations): ../components/proto/gestures',
    );
    expect(md).toContain(
      '- Lottie (timeline animations from /assets/lottie/): ../components/proto/lottie',
    );
    expect(md).toContain('- Canvas (custom drawing): ../components/proto/canvas');
  });

  it('does not write subpath lines for non-proto libraries', () => {
    const md = renderDesignDoc({ ...baseInputs(), library: getLibrary('tamagui') });
    expect(md).not.toContain('../components/proto/motion');
    expect(md).not.toContain('../components/proto/gestures');
    expect(md).not.toContain('../components/proto/lottie');
    expect(md).not.toContain('../components/proto/canvas');
  });

  it('writes Tamagui docs and import path', () => {
    const md = renderDesignDoc({ ...baseInputs(), library: getLibrary('tamagui') });
    expect(md).toContain('- Package: @tamagui/core');
    expect(md).toContain('- Import from: @tamagui/core');
    expect(md).toContain('- Docs: https://tamagui.dev/docs/components');
    expect(md).toContain('- Fallback: proto');
  });

  it('writes a custom library with optional docs', () => {
    const md = renderDesignDoc({
      ...baseInputs(),
      library: resolveCustomLibrary({ packageName: '@acme/ui', docs: 'https://acme.dev' }),
    });
    expect(md).toContain('- Package: @acme/ui');
    expect(md).toContain('- Import from: @acme/ui');
    expect(md).toContain('- Docs: https://acme.dev');
  });

  it('omits the docs line when a custom library has no docs', () => {
    const md = renderDesignDoc({
      ...baseInputs(),
      library: resolveCustomLibrary({ packageName: '@acme/ui' }),
    });
    expect(md).toContain('- Package: @acme/ui');
    expect(md).not.toMatch(/^- Docs:/m);
  });
});

describe('renderDesignDoc — invariant sections', () => {
  it('always includes typography, spacing, shape, components and screens sections', () => {
    const md = renderDesignDoc(baseInputs());
    expect(md).toContain('## Typography');
    expect(md).toContain('- Title: 34px / bold / tracking -0.4');
    expect(md).toContain('## Spacing');
    expect(md).toContain('- xs: 4 / sm: 8 / md: 16 / lg: 24 / xl: 32');
    expect(md).toContain('## Shape');
    expect(md).toContain('## Effects');
    expect(md).toContain('## Components in use');
    expect(md).toContain('- Screen, Stack, Row, Text, Card, Button, Toggle, Nav, Modal, Divider');
    expect(md).toContain('## Screens');
    expect(md).toContain('- Home (initial) — starter screen');
  });
});
