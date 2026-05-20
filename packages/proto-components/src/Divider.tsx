import { View } from 'react-native';
import { useTheme } from './useTheme';

export function Divider() {
  const theme = useTheme();
  return (
    <View
      style={{
        height: 1,
        width: '100%',
        backgroundColor: theme.border.default,
      }}
    />
  );
}
