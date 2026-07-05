import { Platform, Pressable, View } from 'react-native';
import { Host, Stepper as SwiftUIStepper } from '@expo/ui/swift-ui';
import { useTheme } from './useTheme';
import { Text } from './Text';

export type StepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export function Stepper({ label, value, onChange, min, max, step = 1 }: StepperProps) {
  const theme = useTheme();

  if (Platform.OS === 'ios') {
    return (
      <Host matchContents>
        <SwiftUIStepper
          label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          onValueChange={(next) => onChange(next)}
        />
      </Host>
    );
  }

  // ponytail: iOS-first product; minimal functional RN fallback for Android (no core RN stepper).
  const clamp = (n: number) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text size="body">{label}</Text>
      <View style={{ flexDirection: 'row', gap: theme.space.md }}>
        <Pressable onPress={() => onChange(clamp(value - step))}>
          <Text size="headline">−</Text>
        </Pressable>
        <Pressable onPress={() => onChange(clamp(value + step))}>
          <Text size="headline">＋</Text>
        </Pressable>
      </View>
    </View>
  );
}
