import { Image } from 'expo-image';
import { useStaticSkia } from './staticSkia';
import { Group, Circle, Oval, Path, LinearGradient, vec } from '@shopify/react-native-skia';

export function CoffeeArt() {
  const source = useStaticSkia('coffee-cup-v1', <Group transform={[{ scale: 2 }]}>
      <Oval x={12} y={116} width={124} height={25} color="#160F0A55" />
      <Oval x={13} y={108} width={120} height={25} color="#D8B78B" />
      <Circle cx={116} cy={85} r={19} style="stroke" strokeWidth={9} color="#E4C9A5" />
      <Path path="M 29 62 L 35 106 Q 72 133 109 106 L 115 62 Z">
        <LinearGradient start={vec(30, 60)} end={vec(110, 120)} colors={['#FFF0D2', '#BA8B57']} />
      </Path>
      <Oval x={29} y={45} width={86} height={35} color="#FFE8C4" />
      <Oval x={35} y={50} width={74} height={24} color="#674125" />
      <Path path="M 71 69 C 49 57 57 50 69 56 C 80 47 95 58 71 69 Z" color="#F3D4A1" />
      <Path path="M 57 34 C 39 18 73 17 61 3 M 83 37 C 67 24 96 17 84 6" color="#F9E6CD88" style="stroke" strokeWidth={2.5} strokeCap="round" />
    </Group>, 284, 320);
  return <Image source={source} style={{ width: 142, height: 160 }} contentFit="contain" transition={0} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
