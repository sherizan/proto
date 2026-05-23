import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerLargeTitleShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Proto' }} />
    </Stack>
  );
}
