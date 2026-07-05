import { Platform, View } from 'react-native';
import { Host, Slider as SwiftUISlider } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import { useAccent, useTheme } from './useTheme';
import { Text } from './Text';

export type SliderProps = {
  value: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
};

export function Slider({ value, onChange, min = 0, max = 1, step, label }: SliderProps) {
  const theme = useTheme();
  const accent = useAccent();

  const control =
    Platform.OS === 'ios' ? (
      <Host style={{ width: '100%', height: 44 }}>
        <SwiftUISlider
          value={value}
          min={min}
          max={max}
          step={step}
          onValueChange={(next) => onChange?.(next)}
          modifiers={[tint(accent)]}
        />
      </Host>
    ) : (
      // ponytail: iOS-first product; Android renders a read-only track (no core RN slider, and
      // adding @react-native-community/slider for a path that never ships isn't worth it).
      <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.border.default }}>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: accent,
            width: `${((value - min) / (max - min)) * 100}%`,
          }}
        />
      </View>
    );

  if (!label) return control;

  return (
    <View style={{ gap: theme.space.xs }}>
      <Text size="label">{label}</Text>
      {control}
    </View>
  );
}
