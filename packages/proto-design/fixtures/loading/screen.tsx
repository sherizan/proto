import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { Screen, Stack, Row, Text, Skeleton, SkeletonBlock, Button, useTheme } from '../components/proto';

export default function LoadingStudy() {
  const { mode = 'loading' } = useLocalSearchParams();
  const [fastDone, setFastDone] = useState(false);
  const { fontScale } = useWindowDimensions();
  const theme = useTheme();
  useEffect(() => {
    setFastDone(false);
    if (mode !== 'fast') return;
    const timer = setTimeout(() => setFastDone(true), 50);
    return () => clearTimeout(timer);
  }, [mode]);
  const loading = ['loading', 'static', 'inactive'].includes(String(mode)) || (mode === 'fast' && !fastDone);
  return <Screen>
    <Text size="title">Loading study</Text>
    <Text color="secondary">Shared placeholders · {mode}</Text>
    <Skeleton loading={loading} active={mode !== 'inactive'} shimmer={mode !== 'static'} label="Loading coffee menu" placeholder={
      <Stack gap={24}>
        <SkeletonBlock height={160} radius={16} />
        {[1, 2, 3].map(id => <Row key={id} gap={16}>
          <SkeletonBlock width={64} height={64} radius={12} />
          <Stack gap={10} style={{ flex: 1 }}>
            <SkeletonBlock width="70%" height={20 * fontScale} />
            <SkeletonBlock width="90%" height={14 * fontScale} />
          </Stack>
        </Row>)}
      </Stack>
    }>
      {mode === 'error' ? <Stack gap={16}><Text>Couldn’t load the menu.</Text><Button label="Retry" onPress={() => router.setParams({ mode: 'loaded' })} /></Stack> :
       mode === 'empty' ? <Text>No drinks are available yet.</Text> :
       <Stack gap={24}>
         <Stack gap={8} padding={20} style={{ minHeight: 160, borderRadius: 16, backgroundColor: theme.surface.card, justifyContent: 'center' }}>
           <Text size="headline">Your daily coffee</Text>
           <Text color="secondary">{mode === 'refresh' ? 'Refreshing menu…' : 'Made fresh, ready for pickup.'}</Text>
         </Stack>
         {[['Oat latte', '$5.50'], ['Flat white', '$4.50'], ['Cold brew', '$5.00']].map(([name, price]) => <Row key={name} gap={16}>
           <Stack align="center" style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: theme.surface.card, justifyContent: 'center' }}><Text>☕</Text></Stack>
           <Stack gap={10} style={{ flex: 1 }}><Text size="headline">{name}</Text><Text size="caption" color="secondary">{price}</Text></Stack>
         </Row>)}
       </Stack>}
    </Skeleton>
  </Screen>;
}
