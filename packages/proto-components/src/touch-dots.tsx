// Proto-managed. Draws a round dot wherever you touch WHILE `proto record` is
// running, so taps are visible in the recorded video (the recorder captures
// only what the app itself renders). It also answers Prototo Desktop's
// point-and-edit: a tapped preview element is resolved to the screen file and
// line that renders it. And its screen-flow view: a clicked screen opens here. Dev-only twice over: everything is gated on __DEV__,
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
type NavigateRequest = { id: number; path: string };
type LinksRequest = { id: number };

// Flow view: open the route the desktop asked for, then confirm. expo-router is
// required at run time (every Prototo project has it; this file's own package
// doesn't), so a missing router is just a "no".
function navigateTo(req: NavigateRequest) {
  let ok = false;
  try {
    const { router } = require('expo-router') as {
      router: { navigate: (href: string) => void; dismissAll?: () => void };
    };
    // unwind the current stack first: navigating from a sheet to the screen
    // under it pushed a second copy, and the flow walk (#89) wants each screen
    // once, in its resting place
    try {
      router.dismissAll?.();
    } catch {
      // nothing to dismiss
    }
    router.navigate(req.path);
    ok = true;
  } catch {
    // unknown route or no router — the desktop already pasted the file
  }
  fetch('http://127.0.0.1:3001/navigate/result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: req.id, ok }),
  }).catch(() => {});
}
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
// Flow export (#89): every tappable on the mounted screen, with where it sits,
// so the flow's arrows can start at the button. A `<Link href>` names its
// target outright; a `router.push` inside an onPress can't be read here, so
// its debug stack goes along and `proto flow` matches it to the source. Walks
// the fiber tree from the renderer's roots (DevTools hook again), measures the
// first host view under each candidate. Screens under the top one stay mounted
// (a stack keeps its history, tabs keep every tab) and measure to the same
// place, so `proto flow` keeps only the links whose source is the screen's own
// file. Fails open: no answer = no anchors.
type Fiber = DebugFiber & {
  tag?: number;
  memoizedProps?: { href?: unknown; onPress?: unknown } | null;
  stateNode?: unknown;
  child?: Fiber | null;
  sibling?: Fiber | null;
  return?: Fiber | null;
  alternate?: Fiber | null;
};
type Hook = {
  renderers: Map<number, Renderer>;
  getFiberRoots?: (id: number) => Set<{ current: Fiber }>;
};
type Measurable = {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};
type FoundLink = {
  href?: string;
  stacks: string[];
  frame: { x: number; y: number; w: number; h: number };
};
const MAX_LINKS = 60;

// Fabric keeps the public instance a level or two under the fiber's stateNode.
function measurableOf(node: unknown): Measurable | null {
  const sn = node as { canonical?: { publicInstance?: unknown }; publicInstance?: unknown } | null;
  for (const c of [sn, sn?.canonical?.publicInstance, sn?.publicInstance]) {
    if (c && typeof (c as Measurable).measureInWindow === 'function') return c as Measurable;
  }
  return null;
}

function hostViewOf(fiber: Fiber): Measurable | null {
  for (let f: Fiber | null | undefined = fiber, i = 0; f && i < 8; f = f.child, i++) {
    if (f.tag === 5) return measurableOf(f.stateNode);
  }
  return null;
}

function collectLinks(req: LinksRequest) {
  const post = (links: FoundLink[]) =>
    fetch('http://127.0.0.1:3001/links/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: req.id, links }),
    }).catch(() => {});
  try {
    const hook = (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: Hook })
      .__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) {
      void post([]);
      return;
    }
    const { width, height } = Dimensions.get('window');
    const candidates: { fiber: Fiber; href?: string }[] = [];
    const seen = new Set<unknown>();
    for (const id of hook.renderers.keys()) {
      for (const root of hook.getFiberRoots?.(id) ?? []) {
        const stack: Fiber[] = [root.current];
        while (stack.length && candidates.length < MAX_LINKS) {
          const f = stack.pop() as Fiber;
          const props = f.memoizedProps;
          const href =
            typeof props?.href === 'string' && props.href.startsWith('/') ? props.href : undefined;
          if (href || typeof props?.onPress === 'function') {
            // the same onPress rides down Button → Pressable → host; keep the outermost
            const key = href ?? props?.onPress;
            if (!seen.has(key)) {
              seen.add(key);
              candidates.push({ fiber: f, href });
            }
          }
          if (f.sibling) stack.push(f.sibling);
          if (f.child) stack.push(f.child);
        }
      }
    }
    const measured = candidates.map(
      (c) =>
        new Promise<FoundLink | null>((resolve) => {
          const host = hostViewOf(c.fiber);
          if (!host) return resolve(null);
          const measure = () => new Promise<number[]>((r) => host.measureInWindow((...m) => r(m)));
          // measured twice, a beat apart: a frame still moving (a sheet being
          // dismissed, a screen scaling back) is not a place to anchor an arrow
          void (async () => {
            const a = await measure();
            await new Promise((r) => setTimeout(r, 200));
            const b = await measure();
            if (a.some((v, i) => Math.abs(v - (b[i] ?? 0)) > 1)) return resolve(null);
            const [x, y, w, h] = b as [number, number, number, number];
            if (!(w > 0 && h > 0) || y + h <= 0 || y >= height) return resolve(null); // off screen
            const stacks: string[] = [];
            let fiber: DebugFiber | null | undefined = c.fiber;
            for (let i = 0; fiber && i < 12; i++) {
              const s = fiber._debugStack?.stack;
              if (typeof s === 'string') stacks.push(s);
              fiber = fiber._debugOwner;
            }
            // clipped to the screen: a card half below the fold anchors at its visible part
            const [x0, y0, x1, y1] = [
              Math.max(0, x),
              Math.max(0, y),
              Math.min(width, x + w),
              Math.min(height, y + h),
            ];
            resolve({
              ...(c.href ? { href: c.href } : {}),
              stacks,
              frame: { x: x0 / width, y: y0 / height, w: (x1 - x0) / width, h: (y1 - y0) / height },
            });
          })();
        }),
    );
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 1200));
    void Promise.all(measured.map((m) => Promise.race([m, timeout]))).then((links) =>
      post(links.filter((l): l is FoundLink => l !== null)),
    );
  } catch {
    void post([]);
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
  const navigated = useRef(0);
  const linked = useRef(0);

  // Poll `proto start`'s local server for the record flag (the Simulator
  // shares the host loopback). Any failure just means "not recording".
  useEffect(() => {
    if (!__DEV__) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/recording');
        const body = (await res.json()) as {
          recording?: boolean;
          inspect?: InspectRequest;
          navigate?: NavigateRequest;
          links?: LinksRequest;
        };
        if (!alive) return;
        setRecording(body.recording === true);
        if (body.inspect && body.inspect.id !== inspected.current) {
          inspected.current = body.inspect.id;
          inspectAt(rootRef.current, body.inspect);
        }
        if (body.navigate && body.navigate.id !== navigated.current) {
          navigated.current = body.navigate.id;
          navigateTo(body.navigate);
        }
        if (body.links && body.links.id !== linked.current) {
          linked.current = body.links.id;
          collectLinks(body.links);
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
