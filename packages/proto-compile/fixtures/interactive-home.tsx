import { Button, Card, Divider, Modal, Screen, Stack, Text, Toggle } from '../components/proto';

export default function Home() {
  return (
    <Screen title="Home">
      <Stack gap={16}>
        <Text size="title">Settings</Text>
        <Toggle label="Dark mode" bind="darkMode" />
        <Divider />
        <Card onTap="navigate:Detail">
          <Text size="body">Open details</Text>
          <Text size="caption" color="secondary">
            Tap to drill in
          </Text>
        </Card>
        <Button label="Show info" variant="ghost" onTap="showModal:detailsModal" />
        <Modal title="Info" bind="detailsModal">
          <Text size="body">Bound to state.</Text>
          <Button label="Done" variant="primary" onTap="hideModal:detailsModal" />
        </Modal>
      </Stack>
    </Screen>
  );
}
