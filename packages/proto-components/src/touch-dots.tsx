// Proto-managed. Draws a round dot wherever you touch WHILE `proto record` is
// running, so taps are visible in the recorded video (the recorder captures
// only what the app itself renders). Dev-only twice over: everything is gated
// on __DEV__, and published shares are production bundles where __DEV__ is
// false — stakeholders can never see it. Safe to leave alone.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, View, type GestureResponderEvent } from 'react-native';

const POLL_MS = 1500;
const DOT = 36;
// A quick tap must linger long enough to be readable in the video.
const FADE_MS = 350;

type Dot = { id: number; x: number; y: number };
type FadingDot = { key: number; x: number; y: number; opacity: Animated.Value };

const circle = {
  position: 'absolute' as const,
  width: DOT,
  height: DOT,
  borderRadius: DOT / 2,
  backgroundColor: 'rgba(255,255,255,0.35)',
  borderWidth: 1.5,
  borderColor: 'rgba(255,255,255,0.85)',
};

export default function TouchDots({ children }: { children: ReactNode }) {
  const [recording, setRecording] = useState(false);
  const [dots, setDots] = useState<Dot[]>([]);
  const [fading, setFading] = useState<FadingDot[]>([]);
  const dotsRef = useRef<Dot[]>([]);
  const fadeSeq = useRef(0);

  // Poll `proto start`'s local server for the record flag (the Simulator
  // shares the host loopback). Any failure just means "not recording".
  useEffect(() => {
    if (!__DEV__) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/recording');
        const body = (await res.json()) as { recording?: boolean };
        if (alive) setRecording(body.recording === true);
      } catch {
        if (alive) setRecording(false);
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!__DEV__) return <>{children}</>;

  const readTouches = (evt: GestureResponderEvent): Dot[] =>
    evt.nativeEvent.touches.map((t) => ({
      id: Number(t.identifier),
      x: t.pageX,
      y: t.pageY,
    }));

  const setBoth = (next: Dot[]) => {
    dotsRef.current = next;
    setDots(next);
  };

  const onMove = (evt: GestureResponderEvent) => setBoth(readTouches(evt));

  const onRelease = (evt: GestureResponderEvent) => {
    const remaining = readTouches(evt);
    const remainingIds = new Set(remaining.map((d) => d.id));
    const lifted = dotsRef.current.filter((d) => !remainingIds.has(d.id));
    if (lifted.length) {
      const entries = lifted.map((d) => ({
        key: fadeSeq.current++,
        x: d.x,
        y: d.y,
        opacity: new Animated.Value(1),
      }));
      setFading((prev) => [...prev, ...entries]);
      for (const entry of entries) {
        Animated.timing(entry.opacity, {
          toValue: 0,
          duration: FADE_MS,
          useNativeDriver: true,
        }).start(() => setFading((prev) => prev.filter((f) => f.key !== entry.key)));
      }
    }
    setBoth(remaining);
  };

  return (
    // Plain touch events bubble to this wrapper no matter which child is the
    // responder, so observing them here never steals the prototype's gestures.
    <View
      style={{ flex: 1 }}
      onTouchStart={recording ? onMove : undefined}
      onTouchMove={recording ? onMove : undefined}
      onTouchEnd={recording ? onRelease : undefined}
      onTouchCancel={recording ? onRelease : undefined}
    >
      {children}
      {recording && (dots.length > 0 || fading.length > 0) && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {dots.map((d) => (
            <View key={d.id} style={[circle, { left: d.x - DOT / 2, top: d.y - DOT / 2 }]} />
          ))}
          {fading.map((f) => (
            <Animated.View
              key={f.key}
              style={[circle, { left: f.x - DOT / 2, top: f.y - DOT / 2, opacity: f.opacity }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}
