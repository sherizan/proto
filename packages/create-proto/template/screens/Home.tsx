import { Screen, Stack, Text, Card } from '../components/proto';

export default function Home() {
  return (
    <Screen title="Proto" scrollable>
      <Stack gap={24} padding={20}>
        <Stack gap={8}>
          <Text size="title">Welcome to Proto</Text>
          <Text size="body" color="secondary">
            It works. Your prototype is live on this device.
          </Text>
        </Stack>

        <Card padding={20}>
          <Stack gap={12}>
            <Text size="headline">Next step</Text>
            <Text size="body">Open a new terminal in this folder and run:</Text>
            <Text size="body" color="accent">claude</Text>
            <Text size="body">Then describe a screen, for example:</Text>
            <Text size="body" color="accent">
              add a settings screen with a dark mode toggle
            </Text>
          </Stack>
        </Card>

        <Text size="caption" color="secondary">
          Claude Code reads DESIGN.md before every generation. Change the theme
          by asking it: "update DESIGN.md, change accent to indigo".
        </Text>
      </Stack>
    </Screen>
  );
}
