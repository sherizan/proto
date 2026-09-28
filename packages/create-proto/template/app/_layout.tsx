import { Stack } from 'expo-router';
import TouchDots from '../components/proto/touch-dots';
import config from '../proto.config';

export default function RootLayout() {
  return (
    // TouchDots draws taps on-screen only while `proto record` runs, so they
    // show in recorded videos. Dev-only; invisible in published shares.
    <TouchDots>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: config.name,
            headerLargeTitle: true,
          }}
        />
        <Stack.Screen name="components" options={{ title: 'Components' }} />
      </Stack>
    </TouchDots>
  );
}
