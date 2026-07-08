import { useFocusEffect, useRouter } from 'expo-router';
import { Lottie, Stack, Text, useTheme } from 'proto-components';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
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

export default function Prototypes() {
  const router = useRouter();
  const theme = useTheme();
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
            {shares.map((s) => {
              const expired = new Date(s.expiresAt).getTime() < Date.now();
              const daysLeft = Math.max(0, Math.ceil((new Date(s.expiresAt).getTime() - Date.now()) / 86_400_000));
              return (
                <TapCard
                  key={s.token}
                  title={s.appName}
                  caption={
                    expired
                      ? `Expired · shared ${relativeTime(s.createdAt)}`
                      : `Link live ${daysLeft} more ${daysLeft === 1 ? 'day' : 'days'}`
                  }
                  onPress={() => router.push(`/p/${s.token}`)}
                />
              );
            })}
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
              Tap <Text size="body" color="accent">scan</Text> to open your first.
            </Text>
          </View>
        </Enter>
      ) : null}
    </ScrollView>
  );
}
