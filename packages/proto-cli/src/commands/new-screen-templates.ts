export type TemplateName = 'empty' | 'home' | 'list' | 'detail' | 'form' | 'modal';

const EMPTY = `import { Screen, Stack, Text } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
      <Stack gap={16}>
        <Text size="headline">{{name}}</Text>
      </Stack>
    </Screen>
  );
}
`;

const HOME = `import { Screen, Stack, Text, Card } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
      <Stack gap={16}>
        <Text size="title">{{name}}</Text>
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
`;

const LIST = `import { Screen, Stack, Toggle, Divider } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
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
`;

const DETAIL = `import { Screen, Stack, Text, Card } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
      <Stack gap={16}>
        <Card glass>
          <Text size="headline">{{name}}</Text>
          <Text size="caption" color="secondary">A glass card at the top</Text>
        </Card>
        <Text size="body">Body content goes here.</Text>
        <Text size="body" color="secondary">More secondary text below.</Text>
      </Stack>
    </Screen>
  );
}
`;

const FORM = `import { Screen, Stack, Card, Text, Button } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
      <Stack gap={12}>
        <Card>
          <Text size="caption" color="secondary">Name</Text>
        </Card>
        <Card>
          <Text size="caption" color="secondary">Email</Text>
        </Card>
        <Card>
          <Text size="caption" color="secondary">Message</Text>
        </Card>
        <Button label="Submit" variant="primary" />
      </Stack>
    </Screen>
  );
}
`;

const MODAL = `import { Screen, Stack, Modal, Text, Button } from '../components/proto';

export default function {{name}}() {
  return (
    <Screen title="{{name}}">
      <Modal title="{{name}}" visible={true}>
        <Stack gap={12}>
          <Text size="body">Modal content goes here.</Text>
          <Button label="Confirm" variant="primary" />
          <Button label="Cancel" variant="ghost" />
        </Stack>
      </Modal>
    </Screen>
  );
}
`;

const TEMPLATES: Record<TemplateName, string> = {
  empty: EMPTY,
  home: HOME,
  list: LIST,
  detail: DETAIL,
  form: FORM,
  modal: MODAL,
};

export function renderTemplate(template: TemplateName, screenName: string): string {
  const src = TEMPLATES[template];
  if (!src) throw new Error(`Unknown template: ${template}`);
  return src.replaceAll('{{name}}', screenName);
}
