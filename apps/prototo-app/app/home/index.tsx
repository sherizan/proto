import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Lottie, Stack, Text, useAccent, useTheme } from 'proto-components';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMyShares } from '../../lib/use-my-shares';
import { getHistory, type OpenedProto } from '../../lib/open-history';
import { relativeTime } from '../../lib/relative-time';
import { TapCard } from '../../components/dashboard-ui';

function Enter({ delay, children }: { delay: number; children: ReactNode }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  useEffect(() => {
    const timing = { duration: 450, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };
    opacity.value = withDelay(delay, withTiming(1, timing));
    translateY.value = withDelay(delay, withTiming(0, timing));
  }, [delay, opacity, translateY]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

// Fetch affordance: TapCard-shaped placeholders that softly pulse while the
// share list is loading and there is nothing else to show yet.
function ShimmerCard({ delay }: { delay: number }) {
  const theme = useTheme();
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    const timing = { duration: 700, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System };
    pulse.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, timing), withTiming(0.45, timing)), -1, false),
    );
  }, [delay, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      style={[{ height: 74, borderRadius: 16, backgroundColor: theme.surface.card }, style]}
    />
  );
}

export default function Prototypes() {
  const router = useRouter();
  const theme = useTheme();
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const { shares, status } = useMyShares();
  const [history, setHistory] = useState<OpenedProto[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getHistory().then((h) => {
        if (active) setHistory(h);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const ownedTokens = new Set(shares.map((s) => s.token));
  const empty = status === 'ready' && shares.length === 0 && history.length === 0;
  const fetching = status === 'loading' && shares.length === 0 && history.length === 0;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 96, // clear the native tab bar
        gap: 24,
      }}
      style={{ backgroundColor: theme.surface.primary }}
    >
      <Enter delay={0}>
        <Lottie
          source={require('../../assets/logo-prototo.json')}
          style={{ width: 36, height: 36, alignSelf: 'center' }}
        />
      </Enter>

      {shares.length > 0 ? (
        <Enter delay={80}>
          <Stack gap={8}>
            <Text size="label" color="secondary">
              Yours
            </Text>
            {shares.map((s) => (
              // Published links are permanent (pricing relaunch) — no expiry.
              // Re-published shares show freshness + the publish counter,
              // matching the /account captions.
              <TapCard
                key={s.token}
                title={s.appName}
                caption={
                  s.version && s.version > 1 && s.updatedAt
                    ? `Updated ${relativeTime(s.updatedAt)} · v${s.version}`
                    : `Published ${relativeTime(s.createdAt)}`
                }
                onPress={() => router.push(`/p/${s.token}`)}
              />
            ))}
          </Stack>
        </Enter>
      ) : null}

      {history.length > 0 ? (
        <Enter delay={shares.length > 0 ? 160 : 80}>
          <Stack gap={8}>
            <Text size="label" color="secondary">
              Recently viewed
            </Text>
            {history.map((p) => (
              <TapCard
                key={p.token}
                title={p.appName}
                badge={ownedTokens.has(p.token) ? 'Yours' : undefined}
                caption={
                  p.designerName
                    ? `Opened ${relativeTime(p.openedAt)} · by ${p.designerName}`
                    : `Opened ${relativeTime(p.openedAt)}`
                }
                onPress={() => router.push(`/p/${p.token}`)}
              />
            ))}
          </Stack>
        </Enter>
      ) : null}

      {fetching ? (
        <Enter delay={80}>
          <Stack gap={8}>
            <Text size="label" color="secondary">
              Fetching prototypes
            </Text>
            <ShimmerCard delay={0} />
            <ShimmerCard delay={140} />
            <ShimmerCard delay={280} />
          </Stack>
        </Enter>
      ) : null}

      {empty ? (
        <Enter delay={80}>
          <View
            style={{
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: theme.text.secondary,
              borderRadius: 16,
              padding: 28,
              gap: 8,
              alignItems: 'center',
              opacity: 0.9,
            }}
          >
            <Text size="body" color="secondary" style={{ textAlign: 'center' }}>
              Prototypes people share with you will appear here.
            </Text>
            <Text size="body" color="secondary" style={{ textAlign: 'center' }}>
              Tap{' '}
              <SymbolView
                name="qrcode.viewfinder"
                size={17}
                tintColor={accent}
                style={{ transform: [{ translateY: 3 }] }}
              />{' '}
              to open your first.
            </Text>
          </View>
        </Enter>
      ) : null}
    </ScrollView>
  );
}
