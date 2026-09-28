import { useState, Fragment } from 'react';
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

function Section({ title, note, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <Stack gap={10}>
      <Text size="label" color="secondary" style={{ paddingHorizontal: 4 }}>
        {title.toUpperCase()}
      </Text>
      <Card glass padding={20}>
        <Stack gap={20}>
          {items.map((item, index) => (
            <Fragment key={index}>
              {index > 0 ? <Divider /> : null}
              {item}
            </Fragment>
          ))}
        </Stack>
      </Card>
      {note ? (
        <Text size="caption" color="secondary" style={{ paddingHorizontal: 4 }}>
          {note}
        </Text>
      ) : null}
    </Stack>
  );
}

function Item({ name, children }) {
  return (
    <Stack gap={12}>
      <Text size="caption" color="secondary">
        {name}
      </Text>
      {children}
    </Stack>
  );
}

function Pair({ name, value }) {
  return (
    <Row align="center" style={{ justifyContent: 'space-between' }}>
      <Text size="body">{name}</Text>
      <Text size="body" color="secondary">
        {value}
      </Text>
    </Row>
  );
}

function Swatch({ name, color }) {
  return (
    <Stack gap={6} align="center">
      <SymbolView name="circle.fill" size={40} tintColor={color} />
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
    <Screen scrollable gradient>
      <Stack gap={36}>
        <Text size="body" color="secondary" style={{ paddingHorizontal: 4 }}>
          Everything your agent builds with, in your brand. Name any of these in a prompt.
        </Text>

        <Section title="Your brand" note="Your brand lives in DESIGN.md. Ask your agent to change it and everything here follows.">
          <Row style={{ justifyContent: 'space-between' }}>
            <Swatch name="Accent" color={accent} />
            <Swatch name="Text" color={theme.text.primary} />
            <Swatch name="Secondary" color={theme.text.secondary} />
            <Swatch name="Tertiary" color={theme.text.tertiary} />
            <Swatch name="Destructive" color={theme.text.destructive} />
          </Row>
          <Stack gap={14}>
            <Row align="center" style={{ justifyContent: 'space-between' }}>
              <Text size="title">Title</Text>
              <Text size="caption" color="secondary">title</Text>
            </Row>
            <Row align="center" style={{ justifyContent: 'space-between' }}>
              <Text size="headline">Headline</Text>
              <Text size="caption" color="secondary">headline</Text>
            </Row>
            <Row align="center" style={{ justifyContent: 'space-between' }}>
              <Text size="body">Body</Text>
              <Text size="caption" color="secondary">body</Text>
            </Row>
            <Row align="center" style={{ justifyContent: 'space-between' }}>
              <Text size="label">Label</Text>
              <Text size="caption" color="secondary">label</Text>
            </Row>
            <Row align="center" style={{ justifyContent: 'space-between' }}>
              <Text size="caption">Caption</Text>
              <Text size="caption" color="secondary">caption</Text>
            </Row>
          </Stack>
          <Stack gap={12}>
            <Pair name="Card corners" value={`${theme.radius.card}`} />
            <Pair name="Button corners" value={`${theme.radius.button}`} />
            <Pair
              name="Spacing"
              value={`${theme.space.xs} · ${theme.space.sm} · ${theme.space.md} · ${theme.space.lg} · ${theme.space.xl}`}
            />
          </Stack>
        </Section>

        <Section title="Your components" note="Components you build for this prototype show up here, ready to reuse.">
          <Text size="body" color="secondary">
            None yet
          </Text>
        </Section>

        <Section title="Buttons">
          <Item name="Button">
            <Stack gap={10}>
              <Button label="Primary" />
              <Button label="Secondary" variant="secondary" />
              <Button label="Destructive" variant="destructive" />
              <Button label="Ghost" variant="ghost" />
            </Stack>
          </Item>
          <Item name="Button with a symbol">
            <Button label="Add to favourites" variant="secondary" systemImage="star.fill" />
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
          <Item name="DatePicker">
            <DatePicker label="Check in" value={date} onChange={setDate} />
          </Item>
          <Item name="Input">
            <Input placeholder="Your name" value={text} onChangeText={setText} />
          </Item>
        </Section>

        <Section title="Pickers">
          <Item name="Picker">
            <Picker options={['Day', 'Week', 'Month']} value={segment} onChange={setSegment} />
          </Item>
          <Item name="Picker menu">
            <Picker variant="menu" label="Size" options={['Small', 'Medium', 'Large']} value={size} onChange={setSize} />
          </Item>
          <Item name="Picker wheel">
            <Picker variant="wheel" options={['Mango', 'Lychee', 'Pandan', 'Durian']} value={flavour} onChange={setFlavour} />
          </Item>
        </Section>

        <Section title="Overlays">
          <Item name="Modal">
            <Button label="Open a sheet" variant="secondary" onPress={() => setSheet(true)} />
          </Item>
          <Item name="Alert">
            <Button label="Show an alert" variant="secondary" onPress={() => setAlert(true)} />
          </Item>
        </Section>

        <Section title="Layout">
          <Item name="Card">
            <Card>
              <Text size="body">A plain card</Text>
            </Card>
          </Item>
          <Item name="Row">
            <Row gap={12}>
              <Text size="body">One</Text>
              <Text size="body">Two</Text>
              <Text size="body">Three</Text>
            </Row>
          </Item>
          <Item name="Divider">
            <Divider label="or" />
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
