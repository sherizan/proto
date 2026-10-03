import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Stack, Row, Text, Divider, Picker, Stepper, PurchaseAction, useTheme } from '../components/proto';
import { drinks, money, useCoffee } from '../components/shared/coffee';
import { Atmosphere } from '../components/shared/Atmosphere';

export default function Drink() {
  const { id } = useLocalSearchParams();
  const drink = drinks.find((item) => item.id === id) || drinks[0];
  const spaciousText = useWindowDimensions().fontScale >= 1.5;
  const theme = useTheme();
  const { setCart } = useCoffee();

  const [size, setSize] = useState('Regular');
  const [temperature, setTemperature] = useState(drink.id === 'cold-brew' ? 'Iced' : 'Hot');
  const [milk, setMilk] = useState(drink.id === 'latte' ? 'Oat' : 'Whole');
  const [shots, setShots] = useState(2);
  const [quantity, setQuantity] = useState(1);

  const unitPrice =
    drink.price +
    (size === 'Large' ? 1 : size === 'Small' ? -0.5 : 0) +
    ((milk === 'Oat' || milk === 'Almond') && drink.id !== 'latte' ? 0.6 : 0) +
    Math.max(0, shots - 2) * 0.75;
  const total = unitPrice * quantity;

  const reviewOrder = () => {
    setCart({ name: drink.name, size, temperature, milk, shots, quantity, total });
    router.push('/checkout');
  };

  return (
    <Screen footer={<PurchaseAction total={money(total)} detail={quantity + ' × ' + size + ' · ' + temperature} label="Review order" onPress={reviewOrder} />}>
      <Stack gap={theme.space.lg}>
        <Stack padding={16} gap={6} style={{ backgroundColor: theme.surface.secondary, borderRadius: 18, overflow: 'hidden' }}>
          <Atmosphere base={theme.surface.primary} glow={theme.surface.secondary} />
          {!spaciousText ? <Text size="label" color="accent">MAKE IT YOURS</Text> : null}
          <Row gap={12} style={{ justifyContent: 'space-between', flexDirection: spaciousText ? 'column' : 'row' }}><Text size="title" style={{ flex: 1 }}>{drink.name}</Text><Text size="body">{money(drink.price)}</Text></Row>
          {!spaciousText ? <Text size="caption" color="secondary">{drink.note}</Text> : null}
        </Stack>
        <Stack gap={16}>
          <Stack gap={8}>
            <Row style={{ justifyContent: 'space-between', flexDirection: spaciousText ? 'column' : 'row' }}><Text size="label">Size</Text><Text size="caption" color="secondary">Small −$0.50 · Large +$1</Text></Row>
            <Picker variant={spaciousText ? 'menu' : 'segmented'} options={['Small', 'Regular', 'Large']} value={size} onChange={setSize} />
          </Stack>
          <Stack gap={8}><Text size="label">Temperature</Text><Picker variant={spaciousText ? 'menu' : 'segmented'} options={['Hot', 'Iced']} value={temperature} onChange={setTemperature} /></Stack>
          <Divider />
          <Stack gap={4}>
            <Row align="center" gap={8} style={{ justifyContent: 'space-between', flexDirection: spaciousText ? 'column' : 'row' }}><Text size="label">Milk</Text><Stack style={{ flex: spaciousText ? undefined : 1, alignSelf: 'stretch' }}><Picker variant="menu" options={['Whole', 'Oat', 'Almond', 'None']} value={milk} onChange={setMilk} /></Stack></Row>
            <Text size="caption" color="secondary">{drink.id === 'latte' ? 'Plant milk included.' : 'Oat or almond +$0.60.'}</Text>
          </Stack>
          <Divider />
          <Stack gap={6}>{spaciousText ? <Stack gap={16}><Text size="label">Espresso shots</Text><Picker variant="menu" options={['1', '2', '3', '4']} value={String(shots)} onChange={(value) => setShots(Number(value))} /></Stack> : <Stepper label={'Espresso shots: ' + shots} value={shots} onChange={setShots} min={1} max={4} />}<Text size="caption" color="secondary">Two included · Extra shots +$0.75 each</Text></Stack>
          {spaciousText ? <Stack gap={16}><Text size="label">Quantity</Text><Picker variant="menu" options={['1', '2', '3', '4', '5', '6']} value={String(quantity)} onChange={(value) => setQuantity(Number(value))} /></Stack> : <Stepper label={'Quantity: ' + quantity} value={quantity} onChange={setQuantity} min={1} max={6} />}
        </Stack>
      </Stack>
    </Screen>
  );
}
