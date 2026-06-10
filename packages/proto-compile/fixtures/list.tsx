import { Divider, Screen, Stack, Toggle } from '../components/proto';

export default function List() {
  return (
    <Screen title="List">
      <Stack gap={0}>
        <Toggle label="Option one" value={false} />
        <Divider />
        <Toggle label="Option two" value={false} />
        <Divider />
        <Toggle label="Option three" value={true} />
        <Divider />
        <Toggle label="Option four" value={false} />
        <Divider />
        <Toggle label="Option five" value={false} />
      </Stack>
    </Screen>
  );
}
