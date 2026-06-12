import { Stack } from 'expo-router';

// The home screen draws its own header; the render route hands off to
// ManifestRenderer, which owns native nav chrome. So no expo-router header.
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
