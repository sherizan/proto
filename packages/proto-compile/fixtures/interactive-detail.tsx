import { Button, Screen, Stack, Text } from '../components/proto';

export default function Detail() {
  return (
    <Screen title="Detail" scrollable={false}>
      <Stack gap={12}>
        <Text size="headline">Detail</Text>
        <Button label="Back" variant="ghost" onTap="dismiss" />
      </Stack>
    </Screen>
  );
}
