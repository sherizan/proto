import type { Theme } from '../types';

export const materialYou: Theme = {
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
  blur: {
    nav: 0,
    card: 0,
    modal: 0,
  },
  border: {
    default: '#CAC4D0',
    strong: '#79747E',
  },
  radius: {
    card: 12,
    button: 20,
    nav: 0,
    modal: 28,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};
