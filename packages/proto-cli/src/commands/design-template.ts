import type { LibraryDescriptor } from './design-libraries.js';
import { themeTokens, type ThemeName } from '../design-tokens.js';

export type { ThemeName };

export type DesignInputs = {
  appName: string;
  theme: ThemeName;
  accent: string;
  library: LibraryDescriptor;
  date: string;
};

const SUBPATH_TITLES: Record<string, string> = {
  motion: 'Motion',
  gestures: 'Gestures',
  lottie: 'Lottie',
  canvas: 'Canvas',
  svg: 'SVG',
};

export function renderDesignDoc(inputs: DesignInputs): string {
  const t = themeTokens[inputs.theme];
  const lib = inputs.library;
  const subpathLines = (lib.subpaths ?? []).map((s) => {
    const title = SUBPATH_TITLES[s.name] ?? s.name;
    return `- ${title} (${s.purpose}): ${s.importFrom}`;
  });
  const libLines = [
    `- Package: ${lib.designPackage}`,
    `- Import from: ${lib.importFrom}`,
    ...subpathLines,
    ...(lib.docs ? [`- Docs: ${lib.docs}`] : []),
    `- Fallback: ${lib.fallback}`,
  ].join('\n');

  return `# DESIGN.md
> Source of truth for ${inputs.appName}'s design system.
> Update by prompting Claude Code: "update DESIGN.md, [what to change]"
> Last updated: ${inputs.date}

## App
- Name: ${inputs.appName}
- Theme: ${inputs.theme}
- Platform: iOS

## Component Library
${libLines}

## Colour
- Accent: ${inputs.accent}
- Surface primary: ${t.surface.primary}
- Surface secondary: ${t.surface.secondary}
- Surface card: ${t.surface.card}
- Surface nav: ${t.surface.nav}
- Text primary: ${t.text.primary}
- Text secondary: ${t.text.secondary}
- Text tertiary: ${t.text.tertiary}
- Destructive: ${t.text.destructive}

## Typography
- Title: 34px / bold / tracking -0.4
- Headline: 22px / semibold / tracking -0.4
- Body: 17px / regular
- Caption: 12px / regular / text-secondary
- Label: 13px / medium

## Spacing
- xs: ${t.space.xs} / sm: ${t.space.sm} / md: ${t.space.md} / lg: ${t.space.lg} / xl: ${t.space.xl}

## Shape
- Card radius: ${t.radius.card}
- Button radius: ${t.radius.button}
- Nav radius: ${t.radius.nav}
- Modal radius: ${t.radius.modal}

## Effects
- Card blur: ${t.blur.card}
- Nav blur: ${t.blur.nav}
- Modal blur: ${t.blur.modal}
- Border: ${t.border.default}

## Data
- Mock values are wrapped in mock() from ../components/proto — drop the wrapper when wiring a real source.

## Components in use
- Screen, Stack, Row, Text, Card, Button, Toggle, Nav, Modal, Divider

## Screens
- Home (initial) — starter screen
`;
}
