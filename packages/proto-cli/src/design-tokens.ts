// Single source of truth for theme values: packages/proto-components/src/tokens/*.ts
// This file is a CLI-local mirror so the published proto-cli (which can't import the
// private, RN-coupled proto-components package) can render DESIGN.md from the same
// numbers the components actually render. design-tokens.test.ts asserts this mirror
// stays byte-for-byte in sync with the canonical tokens — if a token changes there
// and not here, that test fails. Keep them identical.

export type ThemeName = 'liquidGlass' | 'materialYou' | 'base';

export type ThemeTokens = {
  surface: { primary: string; secondary: string; card: string; nav: string };
  text: { primary: string; secondary: string; tertiary: string; destructive: string };
  blur: { nav: number; card: number; modal: number };
  border: { default: string; strong: string };
  radius: { card: number; button: number; nav: number; modal: number };
  space: { xs: number; sm: number; md: number; lg: number; xl: number };
};

export const themeTokens: Record<ThemeName, ThemeTokens> = {
  liquidGlass: {
    surface: {
      primary: 'rgba(255, 255, 255, 0.72)',
      secondary: 'rgba(255, 255, 255, 0.48)',
      card: '#f3f5f8',
      nav: 'rgba(255, 255, 255, 0.82)',
    },
    text: {
      primary: '#000000',
      secondary: 'rgba(0, 0, 0, 0.5)',
      tertiary: 'rgba(0, 0, 0, 0.3)',
      destructive: '#FF3B30',
    },
    blur: { nav: 40, card: 20, modal: 60 },
    border: { default: 'rgba(0, 0, 0, 0.08)', strong: 'rgba(0, 0, 0, 0.16)' },
    radius: { card: 22, button: 14, nav: 0, modal: 44 },
    space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
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
    blur: { nav: 0, card: 0, modal: 0 },
    border: { default: '#CAC4D0', strong: '#79747E' },
    radius: { card: 12, button: 20, nav: 0, modal: 28 },
    space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
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
      secondary: 'rgba(0, 0, 0, 0.6)',
      tertiary: 'rgba(0, 0, 0, 0.4)',
      destructive: '#D70015',
    },
    blur: { nav: 0, card: 0, modal: 0 },
    border: { default: 'rgba(0, 0, 0, 0.1)', strong: 'rgba(0, 0, 0, 0.2)' },
    radius: { card: 12, button: 10, nav: 0, modal: 24 },
    space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  },
};
