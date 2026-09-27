import { Platform, Pressable, type ViewStyle } from 'react-native';
import { useContext, type ComponentProps } from 'react';
import { Host, Button as SwiftUIButton, Image as SwiftUIImage, Label as SwiftUILabel } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  resizable,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useTheme, useAccent } from './useTheme';
import { Text } from './Text';
import { RowContext } from './Row';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type SFSymbol = NonNullable<ComponentProps<typeof SwiftUIButton>['systemImage']>;

export type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  systemImage?: SFSymbol;
  image?: string;
};

const STYLE = {
  primary: 'glassProminent',
  secondary: 'glass',
  ghost: 'borderless',
  destructive: 'glassProminent',
} as const;

/**
 * Apple's own button: Liquid Glass on iOS 26 (SwiftUI `buttonStyle`), tinted with the
 * prototype's accent. `systemImage` is an SF Symbol name shown before the label; `image` is a
 * picture URL (https or data) for a brand mark instead.
 */
export function Button({ label, variant = 'primary', onPress, disabled = false, systemImage, image }: ButtonProps) {
  const theme = useTheme();
  const accent = useAccent();
  const inRow = useContext(RowContext);

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress?.();
  };

  if (Platform.OS === 'ios') {
    return (
      // ponytail: a fixed-height host, like Slider, fills a Stack; matchContents measures the
      // button unconstrained (SwiftUI fixedSize) so inside a Row it hugs its label instead.
      <Host
        matchContents={inRow ? { horizontal: true } : undefined}
        style={inRow ? { height: 50 } : { alignSelf: 'stretch', height: 50 }}
      >
        <SwiftUIButton
          role={variant === 'destructive' ? 'destructive' : undefined}
          onPress={handlePress}
          modifiers={[
            buttonStyle(STYLE[variant]),
            controlSize('large'),
            tint(variant === 'destructive' ? theme.text.destructive : accent),
            disabledModifier(disabled),
          ]}
        >
          {/* ponytail: the frame goes on the label so the glass stretches with it; SwiftUI's
              `.infinity` has no JSON form, a huge maxWidth stretches the same way. */}
          <SwiftUILabel
            title={label}
            systemImage={systemImage}
            icon={image ? <SwiftUIImage uiImage={image} modifiers={[resizable(), frame({ width: 18, height: 18 })]} /> : undefined}
            modifiers={[frame({ maxWidth: 100000 })]}
          />
        </SwiftUIButton>
      </Host>
    );
  }

  // ponytail: iOS-first product; Android keeps a plain themed Pressable.
  const palette: Record<ButtonVariant, { bg: string; fg: string }> = {
    primary: { bg: accent, fg: '#FFFFFF' },
    secondary: { bg: theme.surface.secondary, fg: theme.text.primary },
    ghost: { bg: 'transparent', fg: accent },
    destructive: { bg: theme.text.destructive, fg: '#FFFFFF' },
  };
  const { bg, fg } = palette[variant];
  const style: ViewStyle = {
    backgroundColor: bg,
    borderRadius: theme.radius.button,
    paddingVertical: theme.space.sm + 4,
    paddingHorizontal: theme.space.md,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
  };
  return (
    <Pressable disabled={disabled} onPress={handlePress} style={style}>
      <Text size="label" style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
  );
}
