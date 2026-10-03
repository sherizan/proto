import type { LibraryDescriptor } from './design-libraries.js';
import type { ThemeName, ProtoConfig } from '../design/types.js';
import { renderDesignSection } from '../design/document.js';

export type { ThemeName };

export type DesignInputs = {
  config?: ProtoConfig;
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
  const config = inputs.config ?? { theme: inputs.theme, accentColor: inputs.accent };
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
> Brand values (accent, theme, colours, radius, spacing) live in proto.config.js; refresh the generated section from that configuration.
> Last updated: ${inputs.date}

## App
- Name: ${inputs.appName}
- Platform: iOS

## Component Library
${libLines}

${renderDesignSection(config)}

## Data
- Mock values are wrapped in mock() from ../components/proto — drop the wrapper when wiring a real source.

## Components in use
- Screen, Stack, Row, Text, Card, Button, Toggle, Slider, Stepper, Picker, DatePicker, Menu, Alert, Modal, Divider, Input, Lottie

## Screens
- Home (initial) — starter screen
- Components — every component, live, in this brand
`;
}
