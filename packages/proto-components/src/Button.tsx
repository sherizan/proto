import { Pressable, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme, useAccent } from './useTheme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
};

export function Button({ label, variant = 'primary', onPress, disabled = false }: ButtonProps) {
  const theme = useTheme();
  const accent = useAccent();
  const scale = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withTiming(0.96, { duration: 80 });
  };
  const handlePressOut = () => {
    if (disabled) return;
    scale.value = withTiming(1, { duration: 120 });
  };
  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress?.();
  };

  const palette: Record<ButtonVariant, { bg: string; fg: string }> = {
    primary: { bg: accent, fg: '#FFFFFF' },
    secondary: { bg: theme.surface.secondary, fg: theme.text.primary },
    ghost: { bg: 'transparent', fg: accent },
    destructive: { bg: theme.text.destructive, fg: '#FFFFFF' },
  };
  const { bg, fg } = palette[variant];

  const baseStyle: ViewStyle = {
    backgroundColor: bg,
    borderRadius: theme.radius.button,
    paddingVertical: theme.space.sm + 4,
    paddingHorizontal: theme.space.md,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <Pressable disabled={disabled} onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress}>
      <Animated.View style={[baseStyle, animated]}>
        <Text size="label" style={{ color: fg }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
