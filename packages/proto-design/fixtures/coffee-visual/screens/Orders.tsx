import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Screen, Stack, Row, Text, Card, Button, Divider, useTheme, useAccent } from '../components/proto';
import { useCoffee, money } from '../components/shared/coffee';

export default function Orders() {
  const { orders } = useCoffee();
  const theme = useTheme();
  const accent = useAccent();

  return (
    <Screen gradient>
      <Stack gap={theme.space.xl}>
        {orders.length ? (
          <>
            <Stack gap={theme.space.xs}>
              <Text size="title">Your coffee ritual.</Text>
              <Text color="secondary">Sample orders from this session.</Text>
            </Stack>
            {orders.map((order, index) => (
              <Card key={index} padding={theme.space.md}>
                <Stack gap={theme.space.md}>
                  <Row align="center" style={{ justifyContent: 'space-between' }}>
                    <Text size="label" color="accent">CONFIRMED</Text>
                    <Text size="label">{money(order.total)}</Text>
                  </Row>
                  <Stack gap={theme.space.xs}>
                    <Text size="headline">{order.quantity} × {order.name}</Text>
                    <Text color="secondary">{order.size} · {order.temperature} · {order.milk} milk</Text>
                    <Text color="secondary">{order.shots} espresso shots</Text>
                  </Stack>
                  <Divider />
                  <Text size="caption" color="secondary">Pay at pickup · Coffee Club</Text>
                </Stack>
              </Card>
            ))}
          </>
        ) : (
          <Stack gap={theme.space.xl}>
            <Card glass padding={theme.space.xl}>
              <Stack gap={theme.space.lg} align="center">
                <SymbolView name="cup.and.saucer.fill" size={64} tintColor={accent} />
                <Stack gap={theme.space.sm} align="center">
                  <Text size="title">No orders yet.</Text>
                  <Text color="secondary" style={{ textAlign: 'center' }}>Customize a coffee from the Menu tab and your sample pickup order will appear here.</Text>
                </Stack>
                <Button label="Explore the menu" systemImage="cup.and.saucer" onPress={() => router.replace('/')} />
              </Stack>
            </Card>
            <Text size="caption" color="secondary">Prototype orders last for this session only.</Text>
          </Stack>
        )}
      </Stack>
    </Screen>
  );
}
