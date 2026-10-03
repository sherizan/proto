import { resolveDesign } from './profiles.js';
import type { ProtoConfig } from './types.js';

export const DESIGN_START = '<!-- prototo-tokens:start -->';
export const DESIGN_END = '<!-- prototo-tokens:end -->';
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const weights: Record<string, string> = { '400': 'regular', '500': 'medium', '600': 'semibold', '700': 'bold', '800': 'extra bold' };

export function renderDesignSection(config: ProtoConfig): string {
  const { theme: t, accent } = resolveDesign(config, false);
  const dark = resolveDesign(config, true);
  const profile = config.designProfile;
  const typography = Object.entries(t.typography).map(([role, style]) => `- ${title(role)}: ${style.fontSize}px / ${weights[style.fontWeight]}${style.lineHeight === undefined ? '' : ` / line height ${style.lineHeight}`}${style.letterSpacing === undefined ? '' : ` / tracking ${style.letterSpacing}`}`).join('\n');
  const darkRows = (['surface', 'text', 'border'] as const).flatMap(group => Object.entries(t[group]).map(([key, value]) => `| ${group}.${key} | ${value} | ${dark.theme[group][key as keyof typeof dark.theme[typeof group]]} |`));
  return `${DESIGN_START}
## Resolved design
Generated from proto.config.js. Refresh this section after changing the configuration; keep project rationale and references outside these markers. These effective values take precedence over older handwritten token notes elsewhere in this document.

- Theme: ${config.theme ?? 'liquidGlass'}
- Appearance: ${config.colorScheme ?? 'system'}
- Profile: ${profile ? `${profile.id}@${profile.version}` : 'Custom / existing defaults'}

## Colour
- Accent: ${accent}
- Surface primary: ${t.surface.primary}
- Surface secondary: ${t.surface.secondary}
- Surface card: ${t.surface.card}
- Surface nav: ${t.surface.nav}
- Text primary: ${t.text.primary}
- Text secondary: ${t.text.secondary}
- Text tertiary: ${t.text.tertiary}
- Destructive: ${t.text.destructive}

### Light and dark values
| Token | Light | Dark |
|---|---|---|
| accent | ${accent} | ${dark.accent} |
${darkRows.join('\n')}

## Typography
${typography}

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
- Strong border: ${t.border.strong}
${DESIGN_END}`;
}

export function updateDesignSection(document: string, config: ProtoConfig): string {
  const start = document.indexOf(DESIGN_START), end = document.indexOf(DESIGN_END);
  if ((start < 0) !== (end < 0) || (start >= 0 && (end < start || document.indexOf(DESIGN_START, start + DESIGN_START.length) >= 0 || document.indexOf(DESIGN_END, end + DESIGN_END.length) >= 0))) throw Error('The managed design section is malformed. Repair its markers before updating.');
  const section = renderDesignSection(config);
  return start < 0 ? document + (document.endsWith('\n\n') ? '' : document.endsWith('\n') ? '\n' : '\n\n') + section + '\n' : document.slice(0, start) + section + document.slice(end + DESIGN_END.length);
}
