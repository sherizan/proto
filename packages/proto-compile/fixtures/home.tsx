import { Card, Screen, Stack, Text } from '../components/proto';

export default function Home() {
  return (
    <Screen title="Home">
      <Stack gap={16}>
        <Text size="title">Home</Text>
        <Card>
          <Text size="body">First card</Text>
        </Card>
        <Card>
          <Text size="body">Second card</Text>
        </Card>
      </Stack>
    </Screen>
  );
}
