import { GlassView } from 'expo-glass-effect';
import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <GlassView style={styles.glass} glassEffectStyle="clear">
        <Text style={styles.title}>Prototo</Text>
        <Text style={styles.subtitle}>
          To get started, run npx proto start from your project directory, scan the QR to see it live.
        </Text>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
    lineHeight: 22,
  },
});
