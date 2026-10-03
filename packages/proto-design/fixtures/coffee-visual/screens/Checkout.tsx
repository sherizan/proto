import { useState } from 'react';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Screen, Stack, Row, Text, Card, Picker, Button, Divider, PurchaseAction, useTheme, useAccent } from '../components/proto';
import { useCoffee, money } from '../components/shared/coffee';

export default function Checkout() {
  const { cart, place } = useCoffee();
  const theme = useTheme();
  const accent = useAccent();
  const [pickup, setPickup] = useState('ASAP');
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Screen>
        <Stack gap={theme.space.xl} align="center" padding={theme.space.lg}>
          <SymbolView name="checkmark.circle.fill" size={72} tintColor={accent} />
          <Stack gap={theme.space.sm} align="center">
            <Text size="title">See you soon.</Text>
            <Text color="secondary" style={{ textAlign: 'center' }}>Your sample order is confirmed for pickup.</Text>
          </Stack>
          <Card glass padding={theme.space.lg}>
            <Stack gap={theme.space.xs} align="center">
              <Text size="label" color="accent">PICKUP</Text>
              <Text size="headline">{pickup === 'ASAP' ? '5–10 minutes' : '15–20 minutes'}</Text>
              <Text color="secondary">Coffee Club · The neighbourhood café</Text>
            </Stack>
          </Card>
          <Button label="View order" systemImage="receipt" onPress={() => { router.dismissAll(); router.replace('/orders'); }} />
        </Stack>
      </Screen>
    );
  }

  if (!cart) {
    return (
      <Screen>
        <Stack gap={theme.space.lg} align="center" padding={theme.space.xl}>
          <SymbolView name="bag" size={60} tintColor={accent} />
          <Text size="title">Your bag is empty.</Text>
          <Text color="secondary" style={{ textAlign: 'center' }}>Choose a drink from the menu to start your order.</Text>
          <Button label="Browse coffee" onPress={() => router.replace('/')} />
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen footer={<PurchaseAction total={money(cart.total)} detail="Pay at pickup · sample order" label="Place sample order" onPress={() => { place(); setDone(true); }} />}>
      <Stack gap={theme.space.xl}>
        <Stack gap={theme.space.xs}>
          <Text size="title">Review your pickup.</Text>
          <Text color="secondary">One last check before we send this simulated order to the café.</Text>
        </Stack>

        <Stack gap={theme.space.sm}>
          <Text size="label" color="secondary">PICKUP TIME</Text>
          <Card glass padding={theme.space.md}>
            <Stack gap={theme.space.md}>
              <Row gap={theme.space.sm} align="center">
                <SymbolView name="clock.fill" size={19} tintColor={accent} />
                <Text size="headline">When should it be ready?</Text>
              </Row>
              <Picker options={['ASAP', 'In 15 min']} value={pickup} onChange={setPickup} />
              <Text size="caption" color="secondary">{pickup === 'ASAP' ? 'Estimated ready time: 5–10 minutes.' : 'Estimated ready time: 15–20 minutes.'}</Text>
            </Stack>
          </Card>
        </Stack>

        <Stack gap={theme.space.sm}>
          <Text size="label" color="secondary">YOUR ORDER</Text>
          <Card padding={theme.space.md}>
            <Stack gap={theme.space.md}>
              <Row align="center" style={{ justifyContent: 'space-between' }}>
                <Text size="headline">{cart.quantity} × {cart.name}</Text>
                <Text size="headline">{money(cart.total)}</Text>
              </Row>
              <Text color="secondary">{cart.size} · {cart.temperature} · {cart.milk} milk</Text>
              <Text color="secondary">{cart.shots} espresso shots</Text>
              <Divider />
              <Row style={{ justifyContent: 'space-between' }}>
                <Text size="label">Total</Text>
                <Text size="label">{money(cart.total)}</Text>
              </Row>
            </Stack>
          </Card>
        </Stack>

        <Card glass padding={theme.space.md}>
          <Stack gap={theme.space.xs}>
            <Text size="headline">Pay at pickup</Text>
            <Text color="secondary">This design study does not collect payment. The order remains local to this prototype.</Text>
          </Stack>
        </Card>

        <Button label="Keep customizing" variant="ghost" onPress={() => router.back()} />
      </Stack>
    </Screen>
  );
}
