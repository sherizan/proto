import { View } from 'react-native';
import { useTheme } from './useTheme';
import { Text } from './Text';

export type DividerProps = {
  label?: string;
};

export function Divider({ label }: DividerProps) {
  const theme = useTheme();

  if (!label) {
    return (
      <View style={{ height: 1, width: '100%', backgroundColor: theme.border.default }} />
    );
  }

  const line = <View style={{ flex: 1, height: 1, backgroundColor: theme.border.default }} />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
      {line}
      <Text size="caption" color="secondary">
        {label}
      </Text>
      {line}
    </View>
  );
}
