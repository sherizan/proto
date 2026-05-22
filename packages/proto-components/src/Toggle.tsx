import { NativeModules, Platform, Switch as RNSwitch, View } from 'react-native';
import { Host, Toggle as SwiftUIToggle } from '@expo/ui/swift-ui';
import { useAccent, useTheme } from './useTheme';
import { Text } from './Text';

export type ToggleProps = {
  label: string;
  value: boolean;
  onChange?: (value: boolean) => void;
};

const hasExpoUINative = Platform.OS === 'ios' && 'ExpoUI' in NativeModules;

export function Toggle({ label, value, onChange }: ToggleProps) {
  const theme = useTheme();
  const accent = useAccent();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.space.sm,
      }}
    >
      <Text size="body">{label}</Text>
      {hasExpoUINative ? (
        <Host matchContents>
          <SwiftUIToggle isOn={value} onIsOnChange={(next) => onChange?.(next)} />
        </Host>
      ) : (
        <RNSwitch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: theme.border.default, true: accent }}
          thumbColor="#FFFFFF"
        />
      )}
    </View>
  );
}
