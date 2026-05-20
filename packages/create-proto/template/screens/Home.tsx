import { Screen, Stack, Text } from '../components/proto';

export default function Home() {
  return (
    <Screen title="Home">
      <Stack gap={16}>
        <Text size="title">Welcome to Proto</Text>
        <Text size="body" color="secondary">
          Describe what you want to build.
        </Text>
      </Stack>
    </Screen>
  );
}
