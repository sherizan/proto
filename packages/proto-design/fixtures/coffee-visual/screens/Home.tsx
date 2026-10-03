import { useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Screen, Stack, Row, Text, Divider, Button, useTheme, useAccent } from '../components/proto';
import { Motion } from '../components/proto/motion';
import { drinks, money } from '../components/shared/coffee';
import { Atmosphere } from '../components/shared/Atmosphere';
import { CoffeeArt } from '../components/shared/CoffeeArt';
import { useReduceMotion } from '../components/shared/useReduceMotion';

export default function Home({ effects = true }) {
  const { fontScale } = useWindowDimensions();
  const spaciousText = fontScale >= 1.5;
  const theme = useTheme();
  const accent = useAccent();
  const reduced = useReduceMotion();
  return (
    <Screen>
      <Stack gap={theme.space.lg}>
        {fontScale < 1.5 ? <Row align="center" style={{ justifyContent: 'space-between' }}>
          <Stack gap={4} style={{ flex: 1 }}><Text size="label" color="accent">COFFEE, CLOSE BY</Text><Text size="headline">A little daily ritual.</Text></Stack>
          <SymbolView name="sun.max" size={27} tintColor={accent} />
        </Row> : null}
        <Stack padding={20} gap={12} style={{ borderRadius: 24, backgroundColor: '#281C15', overflow: 'hidden' }}>
          <Atmosphere disabled={!effects} />
          <Row align="center" gap={8}>
            <Stack gap={10} style={{ flex: 1 }}>
              {!spaciousText ? <Text size="label" style={{ color: '#EAC493', letterSpacing: 1 }}>HOUSE FAVOURITE</Text> : null}
              <Text size="title" style={{ color: '#FFF3DF' }}>Oat Latte</Text>
              {!spaciousText ? <Text size="caption" style={{ color: '#EACDAB' }}>Silky espresso. Naturally sweet oats.</Text> : null}
              <Text size="body" style={{ color: '#FFF3DF' }}>{money(drinks[0].price)}</Text>
            </Stack>
            {fontScale < 1.5 ? <CoffeeArt /> : null}
          </Row>
          <Button label={spaciousText ? "Customize" : "Make it yours"} systemImage="plus" onPress={() => router.push('/drink?id=latte')} />
        </Stack>
        <Row gap={8} align="center"><SymbolView name="clock" size={16} tintColor={accent} /><Text size="caption" color="secondary">Pickup in 5–10 min · Pay at the café</Text></Row>
        <Stack gap={16}>
          <Stack gap={4} style={{ flexDirection: spaciousText ? 'column' : 'row', justifyContent: 'space-between' }}><Text size="headline">The coffee bar</Text>{!spaciousText ? <Text size="caption" color="secondary">Made your way</Text> : null}</Stack>
          {drinks.slice(1).map((drink, i) => (
            <Stack key={drink.id} gap={16}>
              <Motion.Pressable accessibilityRole="button" accessibilityLabel={'Customize ' + drink.name + ', ' + money(drink.price)} animate={{ scale: 1 }} pressedAnimate={reduced ? { scale: 1 } : { scale: 0.985 }} onPress={() => router.push('/drink?id=' + drink.id)}>
                <Row align="center" gap={12} style={{ flexWrap: spaciousText ? 'wrap' : 'nowrap' }}>
                  {!spaciousText ? <Stack padding={12} style={{ backgroundColor: theme.surface.secondary, borderRadius: 16 }}><SymbolView name={drink.id === 'cold-brew' ? 'drop.fill' : 'cup.and.saucer.fill'} size={24} tintColor={accent} /></Stack> : null}
                  <Stack gap={4} style={{ flex: 1, minWidth: spaciousText ? '100%' : undefined }}><Text size="body" style={{ fontWeight: '600' }}>{drink.name}</Text><Text size="caption" color="secondary">{drink.note}</Text></Stack>
                  <Text size="label">{money(drink.price)}</Text>
                </Row>
              </Motion.Pressable>
              {i < 2 ? <Divider /> : null}
            </Stack>
          ))}
        </Stack>
        <Text size="caption" color="secondary">Demo menu · Prices in USD · No real payments</Text>
      </Stack>
    </Screen>
  );
}
