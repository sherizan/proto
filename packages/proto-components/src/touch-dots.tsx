// Proto-managed. Draws a round dot wherever you touch WHILE `proto record` is
// running, so taps are visible in the recorded video (the recorder captures
// only what the app itself renders). It also answers Prototo Desktop's
// point-and-edit: a tapped preview element is resolved to the screen file and
// line that renders it. Dev-only twice over: everything is gated on __DEV__,
// and published shares are production bundles where __DEV__ is false —
// stakeholders can never see it. Safe to leave alone.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, type GestureResponderEvent, View } from 'react-native';

const POLL_MS = 500;
const DOT = 36;
// A quick tap must linger long enough to be readable in the video.
const FADE_MS = 350;

type Dot = { id: number; x: number; y: number };
type InspectRequest = { id: number; x: number; y: number };
type DebugFiber = { _debugStack?: { stack?: unknown }; _debugOwner?: DebugFiber | null };

// Point-and-edit. React keeps, in dev, the JSX call site of every element on
// its fiber (`_debugStack`); walking the owner chain from the tapped view gives
// the designer's screen file first. `proto start` symbolicates the stacks. The
// renderer's inspector is reached through the DevTools hook — the same thing
// React Native's own element inspector does, without the deprecated deep import.
type InspectorData = { hierarchy?: unknown[]; closestInstance?: DebugFiber | null };
type Renderer = {
  rendererConfig?: {
    getInspectorDataForViewAtPoint?: (
      view: View | null,
      x: number,
      y: number,
      cb: (data: InspectorData) => boolean,
    ) => void;
  };
};

function inspectAt(view: View | null, req: InspectRequest) {
  let answered = false;
  const post = (stacks: string[]) => {
    if (answered) return;
    answered = true;
    fetch('http://127.0.0.1:3001/inspect/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: req.id, stacks }),
    }).catch(() => {});
  };
  try {
    const hook = (
      globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: { renderers: Map<number, Renderer> } }
    ).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const { width, height } = Dimensions.get('window');
    for (const renderer of hook?.renderers.values() ?? []) {
      renderer.rendererConfig?.getInspectorDataForViewAtPoint?.(
        view,
        req.x * width,
        req.y * height,
        (data) => {
          if (!data.hierarchy?.length) return false;
          const stacks: string[] = [];
          let fiber: DebugFiber | null | undefined = data.closestInstance;
          for (let i = 0; fiber && i < 12; i++) {
            const stack = fiber._debugStack?.stack;
            if (typeof stack === 'string') stacks.push(stack);
            fiber = fiber._debugOwner;
          }
          post(stacks);
          return true;
        },
      );
    }
  } catch {
    // no renderer / not a dev build — the CLI times out and the desktop
    // falls back to a label-only reference
  }
}
type FadingDot = { key: number; x: number; y: number; opacity: Animated.Value };

// Brand-pink fill + white rim: reads on light AND dark content (a white or
// plain dark dot disappears on matching backgrounds).
const circle = {
  position: 'absolute' as const,
  width: DOT,
  height: DOT,
  borderRadius: DOT / 2,
  backgroundColor: 'rgba(232,106,156,0.45)',
  borderWidth: 1.5,
  borderColor: 'rgba(255,255,255,0.9)',
};

export default function TouchDots({ children }: { children: ReactNode }) {
  const [recording, setRecording] = useState(false);
  const [dots, setDots] = useState<Dot[]>([]);
  const [fading, setFading] = useState<FadingDot[]>([]);
  const dotsRef = useRef<Dot[]>([]);
  const fadeSeq = useRef(0);
  const rootRef = useRef<View>(null);
  const inspected = useRef(0);

  // Poll `proto start`'s local server for the record flag (the Simulator
  // shares the host loopback). Any failure just means "not recording".
  useEffect(() => {
    if (!__DEV__) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/recording');
        const body = (await res.json()) as { recording?: boolean; inspect?: InspectRequest };
        if (!alive) return;
        setRecording(body.recording === true);
        if (body.inspect && body.inspect.id !== inspected.current) {
          inspected.current = body.inspect.id;
          inspectAt(rootRef.current, body.inspect);
        }
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
      ref={rootRef}
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
