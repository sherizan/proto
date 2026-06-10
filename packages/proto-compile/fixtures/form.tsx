import { Button, Card, Screen, Stack, Text } from '../components/proto';

export default function Form() {
  return (
    <Screen title="Form">
      <Stack gap={12}>
        <Card>
          <Text size="caption" color="secondary">
            Name
          </Text>
        </Card>
        <Card>
          <Text size="caption" color="secondary">
            Email
          </Text>
        </Card>
        <Card>
          <Text size="caption" color="secondary">
            Message
          </Text>
        </Card>
        <Button label="Submit" variant="primary" />
      </Stack>
    </Screen>
  );
}
