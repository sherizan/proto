import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="sample"
        options={{
          title: 'Sample',
          headerLargeTitle: true,
          headerBackTitle: 'Prototo',
        }}
      />
      <Stack.Screen name="p/[token]" options={{ headerShown: false }} />
    </Stack>
  );
}
