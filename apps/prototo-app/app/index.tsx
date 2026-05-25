import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { GlassView } from 'expo-glass-effect';

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.accentPink} />
      <View style={styles.accentBlue} />

      <GlassView style={styles.card} glassEffectStyle="regular">
        <Text style={styles.title}>Prototo</Text>
        <Text style={styles.subtitle}>
          Test iOS designs on a real device.
        </Text>

        <Link href="/sample" asChild>
          <Pressable style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonLabel}>View sample design</Text>
          </Pressable>
        </Link>

        <Text style={styles.hint}>
          Have a Prototo link? Open it on your iPhone.
        </Text>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  accentPink: {
    position: 'absolute',
    top: -80,
    right: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: '#FFC8D6',
  },
  accentBlue: {
    position: 'absolute',
    bottom: -120,
    left: -100,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: '#C4D9FF',
  },
  card: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 200,
    padding: 28,
    borderRadius: 28,
    overflow: 'hidden',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(10,10,10,0.7)',
    marginTop: 8,
    lineHeight: 22,
  },
  button: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: '#0A0A0A',
    alignSelf: 'flex-start',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hint: {
    fontSize: 13,
    color: 'rgba(10,10,10,0.55)',
    marginTop: 18,
  },
});
