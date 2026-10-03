import { useColorScheme } from 'react-native';
import { ThemeProvider, DefaultTheme, DarkTheme } from 'expo-router';
import { useTheme, useAccent } from '../components/proto';
import { Stack } from 'expo-router';
import TouchDots from '../components/proto/touch-dots';
import { CoffeeProvider } from '../components/shared/coffee';

export default function RootLayout() {
  const theme = useTheme(); const accent = useAccent();
  const navigationTheme = useColorScheme() === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider value={{ ...navigationTheme, colors: { ...navigationTheme.colors, background: theme.surface.primary, card: theme.surface.primary, text: theme.text.primary, primary: accent } }}>
    <CoffeeProvider>
      <TouchDots>
        <Stack screenOptions={{ headerStyle: { backgroundColor: 'transparent' }, headerTintColor: accent, headerBackButtonDisplayMode: 'minimal', headerTitleStyle: { color: theme.text.primary }, headerShadowVisible: false, contentStyle: { backgroundColor: theme.surface.primary } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="drink" options={{ title: 'Customize' }} />
          <Stack.Screen
            name="checkout"
            options={{
              title: 'Checkout',
              presentation: 'formSheet',
              sheetAllowedDetents: [0.75, 1],
              sheetGrabberVisible: true
            }}
          />
        </Stack>
      </TouchDots>
    </CoffeeProvider>
    </ThemeProvider>
  );
}
