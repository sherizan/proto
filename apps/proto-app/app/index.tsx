import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { NativeModules, Platform, StyleSheet, Text, View } from 'react-native';

const diag = `iOS ${Platform.Version} · LiquidGlass=${isLiquidGlassAvailable()} · ExpoUI=${'ExpoUI' in NativeModules ? 'yes' : 'no'}`;

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.backgroundColumn}>
        <View style={[styles.swatch, { backgroundColor: '#FF453A' }]} />
        <View style={[styles.swatch, { backgroundColor: '#FF9500' }]} />
        <View style={[styles.swatch, { backgroundColor: '#FFD60A' }]} />
        <View style={[styles.swatch, { backgroundColor: '#34C759' }]} />
        <View style={[styles.swatch, { backgroundColor: '#007AFF' }]} />
        <View style={[styles.swatch, { backgroundColor: '#5856D6' }]} />
      </View>

      <GlassView style={styles.glass} glassEffectStyle="clear">
        <Text style={styles.title}>Proto</Text>
        <Text style={styles.subtitle}>
          Scan a project QR from `proto start` to load your prototype here.
        </Text>
        <Text style={styles.diag}>{diag}</Text>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundColumn: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  swatch: {
    flex: 1,
  },
  glass: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 160,
    padding: 28,
    borderRadius: 28,
    overflow: 'hidden',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
  },
  diag: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 16,
    fontFamily: 'Menlo',
  },
});
