import { Stack } from 'expo-router';
import TouchDots from '../components/proto/touch-dots';

export default function RootLayout() {
  return (
    // TouchDots draws taps on-screen only while `proto record` runs, so they
    // show in recorded videos. Dev-only; invisible in published shares.
    <TouchDots>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: 'Prototo',
            headerLargeTitle: true,
          }}
        />
      </Stack>
    </TouchDots>
  );
}
