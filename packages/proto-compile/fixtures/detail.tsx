import { Card, Screen, Stack, Text } from '../components/proto';

export default function Detail() {
  return (
    <Screen title="Detail">
      <Stack gap={16}>
        <Card glass>
          <Text size="headline">Detail</Text>
          <Text size="caption" color="secondary">A glass card at the top</Text>
        </Card>
        <Text size="body">Body content goes here.</Text>
        <Text size="body" color="secondary">More secondary text below.</Text>
      </Stack>
    </Screen>
  );
}
