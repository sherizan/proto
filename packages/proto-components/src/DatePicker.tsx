import { Platform } from 'react-native';
import { Host, DatePicker as SwiftUIDatePicker } from '@expo/ui/swift-ui';
import { datePickerStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { useAccent } from './useTheme';
import { Text } from './Text';

export type DatePickerMode = 'date' | 'time' | 'dateTime';

export type DatePickerProps = {
  value: Date;
  onChange?: (date: Date) => void;
  label?: string;
  mode?: DatePickerMode;
  min?: Date;
  max?: Date;
};

const COMPONENTS = {
  date: ['date'],
  time: ['hourAndMinute'],
  dateTime: ['date', 'hourAndMinute'],
} as const;

/**
 * Apple's own compact date picker (label left, tappable value right).
 */
export function DatePicker({ value, onChange, label, mode = 'date', min, max }: DatePickerProps) {
  const accent = useAccent();

  if (Platform.OS !== 'ios') {
    // ponytail: iOS-first product; Android shows the value read-only.
    return (
      <Text size="body">
        {label ? `${label}: ` : ''}
        {value.toLocaleString()}
      </Text>
    );
  }

  return (
    <Host style={{ alignSelf: 'stretch', height: 44 }}>
      <SwiftUIDatePicker
        title={label}
        selection={value}
        range={{ start: min, end: max }}
        displayedComponents={[...COMPONENTS[mode]]}
        onDateChange={(next) => onChange?.(next)}
        modifiers={[datePickerStyle('compact'), tint(accent)]}
      />
    </Host>
  );
}
