import { useTheme, useAccent } from '../../../components/proto';
import { Stack } from 'expo-router';
export default function MenuLayout() { const theme = useTheme(); const accent = useAccent();
  return <Stack screenOptions={{ headerStyle: { backgroundColor: 'transparent' }, headerTintColor: accent, headerTitleStyle: { color: theme.text.primary }, headerShadowVisible: false, contentStyle: { backgroundColor: theme.surface.primary } }}><Stack.Screen name="index" options={{ title: 'Coffee Club', headerLargeTitleEnabled: true, headerTransparent: true }} /></Stack>;
}
