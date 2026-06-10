/**
 * Prototo manifest types — the declarative contract.
 *
 * A manifest describes a whole prototype as data: which pre-reviewed components
 * to render, with what props, and which enumerated actions wire them together.
 * No code crosses the wire — the App Clip renderer (and parent app) own the
 * actual component implementations and apply theme tokens at render time.
 *
 * These types mirror the shipped Proto component library in
 * `packages/proto-components/src/`. When a component's props change, this
 * contract and `manifest.schema.json` change with it.
 */

export type ManifestVersion = '1';

export type ThemeName = 'liquidGlass' | 'materialYou' | 'base';
export type ColorScheme = 'system' | 'light' | 'dark';

// Bounded enums lifted verbatim from the component library.
export type TextSize = 'title' | 'headline' | 'body' | 'caption' | 'label';
export type TextColor = 'primary' | 'secondary' | 'accent' | 'destructive';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type RowAlign = 'start' | 'center' | 'end';

/**
 * Partial token overrides, same shape and intent as `ProtoConfig.tokens` in
 * `proto-components`. Only the groups a designer overrides need appear.
 */
export type ThemeOverrides = Partial<{
  surface: Partial<Record<'primary' | 'secondary' | 'card' | 'nav', string>>;
  text: Partial<Record<'primary' | 'secondary' | 'tertiary' | 'destructive', string>>;
  blur: Partial<Record<'nav' | 'card' | 'modal', number>>;
  border: Partial<Record<'default' | 'strong', string>>;
  radius: Partial<Record<'card' | 'button' | 'nav' | 'modal', number>>;
  space: Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number>>;
}>;

/**
 * The complete set of interactions a v1 manifest can express. Anything that
 * cannot be reduced to one of these (async work, data fetching, gestures,
 * per-item callbacks) is out of schema and the compiler must reject it.
 */
export type Action =
  | { action: 'navigate'; to: string }
  | { action: 'dismiss' }
  | { action: 'setState'; key: string; value: boolean | string }
  | { action: 'toggleState'; key: string }
  | { action: 'showModal'; key: string }
  | { action: 'hideModal'; key: string };

export type ScreenNode = {
  type: 'Screen';
  // Nav large-title. The current proto-components Screen ignores this prop;
  // the manifest renderer honors it as the navigation title.
  title?: string;
  scrollable?: boolean;
  children: Node[];
};

export type StackNode = {
  type: 'Stack';
  gap?: number;
  padding?: number;
  children: Node[];
};

export type RowNode = {
  type: 'Row';
  gap?: number;
  align?: RowAlign;
  children: Node[];
};

export type TextNode = {
  type: 'Text';
  value: string;
  size?: TextSize;
  color?: TextColor;
};

export type CardNode = {
  type: 'Card';
  glass?: boolean;
  padding?: number;
  // Tappable card — the primary click-through affordance (tap a card to drill in).
  onTap?: Action;
  children: Node[];
};

export type ButtonNode = {
  type: 'Button';
  label: string;
  variant?: ButtonVariant;
  onTap?: Action;
};

export type ToggleNode = {
  type: 'Toggle';
  label: string;
  // Static value, or `bind` to a state key for a live toggle. At least one.
  value?: boolean;
  bind?: string;
  onChange?: Action;
};

export type DividerNode = {
  type: 'Divider';
};

export type ModalNode = {
  type: 'Modal';
  title: string;
  // Static visibility, or `bind` to a state key. At least one.
  visible?: boolean;
  bind?: string;
  onClose?: Action;
  children: Node[];
};

export type Node =
  | ScreenNode
  | StackNode
  | RowNode
  | TextNode
  | CardNode
  | ButtonNode
  | ToggleNode
  | DividerNode
  | ModalNode;

export type Manifest = {
  manifestVersion: ManifestVersion;
  app: {
    name: string;
    theme?: ThemeName;
    colorScheme?: ColorScheme;
    accentColor?: string;
    tokens?: ThemeOverrides;
  };
  // Must be a key in `screens`.
  initialScreen: string;
  // Enumerated boolean/string state addressed by the action set above.
  state?: Record<string, boolean | string>;
  // Each screen's root must be a Screen node.
  screens: Record<string, ScreenNode>;
};
