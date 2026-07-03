import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { ProtoConfigProvider } from 'proto-components';
import { AuthProvider } from '../lib/auth-context';

export default function RootLayout() {
  useEffect(() => {
    // A prototype can force a color scheme (Appearance.setColorScheme), which is a
    // process-wide override that would otherwise persist into our shell after Exit.
    // Clear it on every shell (re)mount so home always follows the device.
    Appearance.setColorScheme(null);
  }, []);

  return (
    <ProtoConfigProvider config={{ name: 'Prototo', theme: 'liquidGlass', colorScheme: 'system' }}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ProtoConfigProvider>
  );
}
