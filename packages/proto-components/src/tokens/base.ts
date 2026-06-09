import type { Theme } from '../types';

export const base: Theme = {
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
  blur: {
    nav: 0,
    card: 0,
    modal: 0,
  },
  border: {
    default: 'rgba(0, 0, 0, 0.1)',
    strong: 'rgba(0, 0, 0, 0.2)',
  },
  radius: {
    card: 12,
    button: 10,
    nav: 0,
    modal: 24,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

export const baseDark: Theme = {
  surface: {
    primary: '#000000',
    secondary: '#1C1C1E',
    card: '#1C1C1E',
    nav: '#000000',
  },
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.6)',
    tertiary: 'rgba(255, 255, 255, 0.4)',
    destructive: '#FF453A',
  },
  blur: {
    nav: 0,
    card: 0,
    modal: 0,
  },
  border: {
    default: 'rgba(255, 255, 255, 0.15)',
    strong: 'rgba(255, 255, 255, 0.3)',
  },
  radius: {
    card: 12,
    button: 10,
    nav: 0,
    modal: 24,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};
