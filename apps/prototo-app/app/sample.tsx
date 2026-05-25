import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import * as Haptics from 'expo-haptics';

type FeatureItem = {
  symbol: SymbolViewProps['name'];
  title: string;
  detail: string;
};

const FEATURES: FeatureItem[] = [
  {
    symbol: 'circle.hexagongrid.fill',
    title: 'Liquid Glass',
    detail: 'iOS 26 system material above',
  },
  {
    symbol: 'sparkles',
    title: 'SF Symbols',
    detail: 'Apple’s native icon system',
  },
  {
    symbol: 'iphone.gen3.radiowaves.left.and.right',
    title: 'Real device rendering',
    detail: 'No web view, no embedded browser',
  },
];

export default function Sample() {
  return (
    <ScrollView
      style={styles.scroll}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <View style={styles.heroWrapper}>
        <View style={styles.heroAccentPink} />
        <View style={styles.heroAccentBlue} />
        <GlassView style={styles.hero} glassEffectStyle="regular">
          <SymbolView
            name="paintbrush.pointed.fill"
            tintColor="#0A0A0A"
            size={32}
            style={styles.heroIcon}
          />
          <Text style={styles.heroTitle}>Native iOS rendering</Text>
          <Text style={styles.heroBody}>
            This sample uses real iOS components — Liquid Glass, SF Symbols, system gestures, and haptics — the way designers test designs on real devices.
          </Text>
        </GlassView>
      </View>

      <Text style={styles.sectionLabel}>WHAT’S IN THIS SAMPLE</Text>

      <View style={styles.list}>
        {FEATURES.map((feature, index) => (
          <View
            key={feature.title}
            style={[
              styles.row,
              index < FEATURES.length && styles.rowWithDivider,
            ]}
          >
            <SymbolView name={feature.symbol} tintColor="#0A0A0A" size={24} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{feature.title}</Text>
              <Text style={styles.rowDetail}>{feature.detail}</Text>
            </View>
          </View>
        ))}

        <Pressable
          style={styles.row}
          onPress={() =>
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          }
          accessibilityRole="button"
          accessibilityLabel="Tap to feel haptic feedback"
        >
          <SymbolView name="hand.tap.fill" tintColor="#0A0A0A" size={24} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Tap for haptic feedback</Text>
            <Text style={styles.rowDetail}>Real Taptic Engine pulse</Text>
          </View>
          <SymbolView name="chevron.right" tintColor="#C5C5C7" size={14} />
        </Pressable>
      </View>

      <Text style={styles.footer}>
        Prototo lets you test iOS designs on a real iPhone — no Xcode, no setup.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },
  heroWrapper: {
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  heroAccentPink: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FFC8D6',
  },
  heroAccentBlue: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#C4D9FF',
  },
  hero: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroIcon: {
    width: 32,
    height: 32,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  heroBody: {
    fontSize: 14,
    color: 'rgba(10,10,10,0.7)',
    marginTop: 6,
    lineHeight: 19,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6C6C70',
    marginTop: 28,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.4,
  },
  list: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowWithDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#0A0A0A',
  },
  rowDetail: {
    fontSize: 13,
    color: '#6C6C70',
    marginTop: 2,
  },
  footer: {
    fontSize: 13,
    color: '#6C6C70',
    marginTop: 20,
    marginHorizontal: 4,
    lineHeight: 18,
  },
});
