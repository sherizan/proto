import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import {
  Screen,
  Stack,
  Row,
  Text,
  Card,
  Button,
  Toggle,
  Slider,
  Stepper,
  Picker,
  DatePicker,
  Menu,
  Input,
  Modal,
  Alert,
  Divider,
  Lottie,
  useTheme,
  useAccent,
} from '../components/proto';

function Section({ title, children }) {
  return (
    <Stack gap={12}>
      <Text size="headline">{title}</Text>
      {children}
    </Stack>
  );
}

function Item({ name, children }) {
  return (
    <Stack gap={6}>
      <Text size="label" color="secondary">
        {name}
      </Text>
      {children}
    </Stack>
  );
}

function Swatch({ name, color }) {
  return (
    <Stack gap={4} align="center">
      <SymbolView name="circle.fill" size={36} tintColor={color} />
      <Text size="caption" color="secondary">
        {name}
      </Text>
    </Stack>
  );
}

export default function Components() {
  const theme = useTheme();
  const accent = useAccent();
  const [toggle, setToggle] = useState(true);
  const [slider, setSlider] = useState(0.4);
  const [count, setCount] = useState(2);
  const [segment, setSegment] = useState('Day');
  const [size, setSize] = useState('Medium');
  const [flavour, setFlavour] = useState('Mango');
  const [date, setDate] = useState(new Date());
  const [text, setText] = useState('');
  const [sheet, setSheet] = useState(false);
  const [alert, setAlert] = useState(false);

  return (
    <Screen scrollable>
      <Stack gap={32}>
        <Section title="Your brand">
          <Text size="body" color="secondary">
            Change these in proto.config.js, or ask your agent. Every component on this screen follows them.
          </Text>
          <Row gap={16}>
            <Swatch name="Accent" color={accent} />
            <Swatch name="Surface" color={theme.surface.secondary} />
            <Swatch name="Text" color={theme.text.primary} />
            <Swatch name="Secondary" color={theme.text.secondary} />
            <Swatch name="Destructive" color={theme.text.destructive} />
          </Row>
          <Text size="caption" color="secondary">
            {`Card radius ${theme.radius.card} · Button radius ${theme.radius.button} · Spacing ${theme.space.xs} / ${theme.space.sm} / ${theme.space.md} / ${theme.space.lg} / ${theme.space.xl}`}
          </Text>
          <Item name="Text">
            <Text size="title">Title</Text>
            <Text size="headline">Headline</Text>
            <Text size="body">Body</Text>
            <Text size="caption">Caption</Text>
            <Text size="label">Label</Text>
          </Item>
        </Section>

        <Section title="Your components">
          <Text size="body" color="secondary">
            Components you build for this prototype show up here, ready to reuse.
          </Text>
        </Section>

        <Section title="Layout">
          <Item name="Card">
            <Card>
              <Text size="body">A plain card</Text>
            </Card>
          </Item>
          <Item name="Card glass">
            <Card glass>
              <Text size="body">A Liquid Glass card</Text>
            </Card>
          </Item>
          <Item name="Row">
            <Row gap={8}>
              <Text size="body">One</Text>
              <Text size="body">Two</Text>
              <Text size="body">Three</Text>
            </Row>
          </Item>
          <Item name="Divider">
            <Divider />
            <Divider label="or" />
          </Item>
        </Section>

        <Section title="Buttons">
          <Item name="Button">
            <Button label="Primary" />
            <Button label="Secondary" variant="secondary" />
            <Button label="Ghost" variant="ghost" />
            <Button label="Destructive" variant="destructive" />
            <Button label="With a symbol" variant="secondary" systemImage="star.fill" />
          </Item>
          <Item name="Menu">
            <Row>
              <Menu
                label="Options"
                systemImage="ellipsis.circle"
                items={[
                  { label: 'Share', systemImage: 'square.and.arrow.up' },
                  { label: 'Duplicate', systemImage: 'plus.square.on.square' },
                  { label: 'Delete', systemImage: 'trash', destructive: true },
                ]}
              />
            </Row>
          </Item>
        </Section>

        <Section title="Controls">
          <Item name="Toggle">
            <Toggle label="Notifications" value={toggle} onChange={setToggle} />
          </Item>
          <Item name="Slider">
            <Slider value={slider} onChange={setSlider} />
          </Item>
          <Item name="Stepper">
            <Stepper label={`Guests: ${count}`} value={count} onChange={setCount} min={1} max={8} />
          </Item>
          <Item name="Picker">
            <Picker options={['Day', 'Week', 'Month']} value={segment} onChange={setSegment} />
          </Item>
          <Item name="Picker menu">
            <Picker variant="menu" label="Size" options={['Small', 'Medium', 'Large']} value={size} onChange={setSize} />
          </Item>
          <Item name="Picker wheel">
            <Picker variant="wheel" options={['Mango', 'Lychee', 'Pandan', 'Durian']} value={flavour} onChange={setFlavour} />
          </Item>
          <Item name="DatePicker">
            <DatePicker label="Check in" value={date} onChange={setDate} />
          </Item>
          <Item name="Input">
            <Input placeholder="Your name" value={text} onChangeText={setText} />
          </Item>
        </Section>

        <Section title="Overlays">
          <Item name="Modal">
            <Button label="Open the sheet" variant="secondary" onPress={() => setSheet(true)} />
          </Item>
          <Item name="Alert">
            <Button label="Show an alert" variant="secondary" onPress={() => setAlert(true)} />
          </Item>
        </Section>

        <Section title="Motion">
          <Item name="Lottie">
            <Lottie source={require('../assets/lottie/logo-prototo.json')} style={{ width: 64, height: 64 }} />
          </Item>
        </Section>
      </Stack>

      <Modal title="A bottom sheet" visible={sheet} onClose={() => setSheet(false)}>
        <Text size="body" color="secondary">
          It fits its content. Swipe down to close.
        </Text>
        <Button label="Done" onPress={() => setSheet(false)} />
      </Modal>

      <Alert
        title="Delete this draft?"
        message="You can't undo this."
        visible={alert}
        onClose={() => setAlert(false)}
        actions={[
          { label: 'Cancel', cancel: true },
          { label: 'Delete', destructive: true },
        ]}
      />
    </Screen>
  );
}
