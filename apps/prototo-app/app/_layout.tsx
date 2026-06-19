import { Stack } from 'expo-router';
import { ProtoConfigProvider } from 'proto-components';
import { AuthProvider } from '../lib/auth-context';

export default function RootLayout() {
  return (
    <ProtoConfigProvider config={{ name: 'Prototo', theme: 'liquidGlass', colorScheme: 'system' }}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ProtoConfigProvider>
  );
}
