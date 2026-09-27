import { Platform, Pressable } from 'react-native';
import { Host, Picker as SwiftUIPicker, Text as SwiftUIText } from '@expo/ui/swift-ui';
import { pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
import { useAccent, useTheme } from './useTheme';
import { Row } from './Row';
import { Text } from './Text';

export type PickerVariant = 'segmented' | 'menu' | 'wheel';

export type PickerProps = {
  options: string[];
  value: string;
  onChange?: (value: string) => void;
  label?: string;
  variant?: PickerVariant;
};

/**
 * Apple's own picker: segmented control by default, or a pull-down menu / wheel.
 */
export function Picker({ options, value, onChange, label, variant = 'segmented' }: PickerProps) {
  const theme = useTheme();
  const accent = useAccent();

  if (Platform.OS === 'ios') {
    return (
      <Host style={{ alignSelf: 'stretch', height: variant === 'wheel' ? 200 : 36 }}>
        <SwiftUIPicker
          label={label}
          selection={value}
          onSelectionChange={(next) => onChange?.(String(next))}
          modifiers={[pickerStyle(variant), tint(accent)]}
        >
          {options.map((option) => (
            <SwiftUIText key={option} modifiers={[tag(option)]}>
              {option}
            </SwiftUIText>
          ))}
        </SwiftUIPicker>
      </Host>
    );
  }

  // ponytail: iOS-first product; Android shows a plain row of options.
  return (
    <Row gap={theme.space.md} align="center">
      {label ? <Text size="body">{label}</Text> : null}
      {options.map((option) => (
        <Pressable key={option} onPress={() => onChange?.(option)}>
          <Text size="label" color={option === value ? 'accent' : 'secondary'}>
            {option}
          </Text>
        </Pressable>
      ))}
    </Row>
  );
}
