import type { LibraryDescriptor } from './design-libraries.js';

export type ThemeName = 'liquidGlass' | 'materialYou' | 'base';

export type DesignInputs = {
  appName: string;
  theme: ThemeName;
  accent: string;
  library: LibraryDescriptor;
  date: string;
};

type ThemePreset = {
  surface: { primary: string; secondary: string; card: string; nav: string };
  text: { primary: string; secondary: string; tertiary: string; destructive: string };
  shape: { card: number; button: number; modal: number; input: number };
  effects: { cardBlur: number; navBlur: number; modalBlur: number; border: string };
};

const PRESETS: Record<ThemeName, ThemePreset> = {
  liquidGlass: {
    surface: {
      primary: 'rgba(255,255,255,0.72)',
      secondary: 'rgba(255,255,255,0.48)',
      card: 'rgba(255,255,255,0.60)',
      nav: 'rgba(255,255,255,0.82)',
    },
    text: {
      primary: '#000000',
      secondary: 'rgba(0,0,0,0.5)',
      tertiary: 'rgba(0,0,0,0.3)',
      destructive: '#FF3B30',
    },
    shape: { card: 22, button: 14, modal: 44, input: 12 },
    effects: { cardBlur: 20, navBlur: 40, modalBlur: 60, border: 'rgba(255,255,255,0.4)' },
  },
  materialYou: {
    surface: {
      primary: '#FFFBFE',
      secondary: '#E6E1E5',
      card: '#F4EFF4',
      nav: '#FFFBFE',
    },
    text: {
      primary: '#1C1B1F',
      secondary: '#49454F',
      tertiary: '#79747E',
      destructive: '#B3261E',
    },
    shape: { card: 12, button: 20, modal: 28, input: 8 },
    effects: { cardBlur: 0, navBlur: 0, modalBlur: 0, border: '#CAC4D0' },
  },
  base: {
    surface: {
      primary: '#FFFFFF',
      secondary: '#F2F2F7',
      card: '#FFFFFF',
      nav: '#FFFFFF',
    },
    text: {
      primary: '#000000',
      secondary: 'rgba(0,0,0,0.6)',
      tertiary: 'rgba(0,0,0,0.4)',
      destructive: '#D70015',
    },
    shape: { card: 12, button: 10, modal: 24, input: 8 },
    effects: { cardBlur: 0, navBlur: 0, modalBlur: 0, border: 'rgba(0,0,0,0.1)' },
  },
};

const SUBPATH_TITLES: Record<string, string> = {
  motion: 'Motion',
  gestures: 'Gestures',
  lottie: 'Lottie',
  canvas: 'Canvas',
};

export function renderDesignDoc(inputs: DesignInputs): string {
  const p = PRESETS[inputs.theme];
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
- Surface primary: ${p.surface.primary}
- Surface secondary: ${p.surface.secondary}
- Surface card: ${p.surface.card}
- Surface nav: ${p.surface.nav}
- Text primary: ${p.text.primary}
- Text secondary: ${p.text.secondary}
- Text tertiary: ${p.text.tertiary}
- Destructive: ${p.text.destructive}

## Typography
- Title: 34px / bold / tracking -0.4
- Headline: 22px / semibold / tracking -0.4
- Body: 17px / regular
- Caption: 12px / regular / text-secondary
- Label: 13px / medium

## Spacing
- xs: 4 / sm: 8 / md: 16 / lg: 24 / xl: 32

## Shape
- Card radius: ${p.shape.card}
- Button radius: ${p.shape.button}
- Modal radius: ${p.shape.modal}
- Input radius: ${p.shape.input}

## Effects
- Card blur: ${p.effects.cardBlur}
- Nav blur: ${p.effects.navBlur}
- Modal blur: ${p.effects.modalBlur}
- Border: ${p.effects.border}

## Components in use
- Screen, Stack, Row, Text, Card, Button, Toggle, Nav, Modal, Divider

## Screens
- Home (initial) — starter screen
`;
}
