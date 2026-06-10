import { Button, Modal, Screen, Stack, Text } from '../components/proto';

export default function Modal_() {
  return (
    <Screen title="Modal">
      <Modal title="Modal" visible={true}>
        <Stack gap={12}>
          <Text size="body">Modal content goes here.</Text>
          <Button label="Confirm" variant="primary" />
          <Button label="Cancel" variant="ghost" />
        </Stack>
      </Modal>
    </Screen>
  );
}
