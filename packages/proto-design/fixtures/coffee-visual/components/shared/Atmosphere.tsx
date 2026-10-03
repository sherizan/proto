import { Image } from 'expo-image';
import { useStaticSkia } from './staticSkia';
import { Fill, Shader, Skia } from '@shopify/react-native-skia';

const effect = (() => {
  try {
    return Skia.RuntimeEffect.Make(`
      uniform float2 resolution;
      uniform float4 base;
      uniform float4 glow;
      half4 main(float2 p) {
        float2 uv = p / max(resolution, float2(1.0));
        float light = 1.0 - smoothstep(0.0, 1.1, length(uv - float2(0.92, 0.12)));
        float wave = sin(uv.x * 9.0 + sin(uv.y * 5.0) * 2.2 + uv.y * 8.0);
        float line = smoothstep(0.975, 1.0, wave) * 0.075;
        float grain = fract(sin(dot(floor(p), float2(12.9898, 78.233))) * 43758.5453) - 0.5;
        float3 color = mix(base.rgb, glow.rgb, light * 0.72);
        color += line + grain * 0.028;
        return half4(clamp(color, 0.0, 1.0), 1.0);
      }
    `);
  } catch {
    return null;
  }
})();

export function Atmosphere({ base = '#281C15', glow = '#9B572C', disabled = false }) {
  const uniforms = { resolution: [768, 768], base: Array.from(Skia.Color(base)), glow: Array.from(Skia.Color(glow)) };
  const source = useStaticSkia('coffee-atmosphere-v1:' + base + ':' + glow, effect && !disabled ? <Fill><Shader source={effect} uniforms={uniforms} /></Fill> : <Fill color={base} />, 768, 768, !disabled && !!effect);
  if (disabled || !effect) return null;
  return <Image source={source} transition={0} contentFit="fill" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />;
}
