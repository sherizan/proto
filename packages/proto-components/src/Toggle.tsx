import { Switch, View } from 'react-native';
import { useAccent, useTheme } from './useTheme';
import { Text } from './Text';

export type ToggleProps = {
  label: string;
  value: boolean;
  onChange?: (value: boolean) => void;
};

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
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.border.default, true: accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}
