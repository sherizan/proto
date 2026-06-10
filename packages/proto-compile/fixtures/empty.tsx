import { Screen, Stack, Text } from '../components/proto';

export default function Empty() {
  return (
    <Screen title="Empty">
      <Stack gap={16}>
        <Text size="headline">Empty</Text>
      </Stack>
    </Screen>
  );
}
