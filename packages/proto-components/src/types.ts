export type ThemeName = 'liquidGlass' | 'materialYou' | 'base';

export type Theme = {
  surface: {
    primary: string;
    secondary: string;
    card: string;
    nav: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    destructive: string;
  };
  blur: {
    nav: number;
    card: number;
    modal: number;
  };
  border: {
    default: string;
    strong: string;
  };
  radius: {
    card: number;
    button: number;
    nav: number;
    modal: number;
  };
  space: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
};

// A config colour: one value for both schemes, or a light/dark pair.
export type SchemeColor = string | { light: string; dark: string };

type ColorOverrides<K extends string> = Partial<Record<K, SchemeColor>>;

export type ThemeOverrides = Partial<{
  surface: ColorOverrides<keyof Theme['surface']>;
  text: ColorOverrides<keyof Theme['text']>;
  blur: Partial<Theme['blur']>;
  border: ColorOverrides<keyof Theme['border']>;
  radius: Partial<Theme['radius']>;
  space: Partial<Theme['space']>;
}>;

export type ProtoConfig = {
  name?: string;
  theme?: ThemeName;
  // 'system' (default) follows the device; 'light' / 'dark' pin the scheme.
  colorScheme?: 'system' | 'light' | 'dark';
  accentColor?: SchemeColor;
  tokens?: ThemeOverrides;
  screens?: { initial?: string };
};
