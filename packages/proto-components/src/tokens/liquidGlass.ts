import type { Theme } from '../types';

export const liquidGlass: Theme = {
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
  blur: {
    nav: 40,
    card: 20,
    modal: 60,
  },
  border: {
    default: 'rgba(0, 0, 0, 0.08)',
    strong: 'rgba(0, 0, 0, 0.16)',
  },
  radius: {
    card: 22,
    button: 14,
    nav: 0,
    modal: 44,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

export const liquidGlassDark: Theme = {
  surface: {
    primary: 'rgba(28, 28, 30, 0.72)',
    secondary: 'rgba(28, 28, 30, 0.48)',
    card: '#1c1c1e',
    nav: 'rgba(28, 28, 30, 0.82)',
  },
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.6)',
    tertiary: 'rgba(255, 255, 255, 0.4)',
    destructive: '#FF453A',
  },
  blur: {
    nav: 40,
    card: 20,
    modal: 60,
  },
  border: {
    default: 'rgba(255, 255, 255, 0.12)',
    strong: 'rgba(255, 255, 255, 0.24)',
  },
  radius: {
    card: 22,
    button: 14,
    nav: 0,
    modal: 44,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};
