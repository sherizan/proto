import { NativeEventEmitter, NativeModules } from 'react-native';

type PrototoRuntimeModule = {
  loadPrototype: (url: string) => void;
  goHome: () => void;
  shellReady?: () => void;
};

const native = (NativeModules as { PrototoRuntime?: PrototoRuntimeModule }).PrototoRuntime;

/** True when running inside the native Prototo host (vs a plain Expo Go / web context). */
export const isNativeRuntimeAvailable = native != null;

export type LoadProgress = { successful: number; failed: number; total: number };

const emitter = native ? new NativeEventEmitter(NativeModules.PrototoRuntime) : null;

/** Per-asset download progress while a prototype update loads. Returns unsubscribe. */
export function onLoadProgress(cb: (p: LoadProgress) => void): () => void {
  const sub = emitter?.addListener('protoLoadProgress', cb);
  return () => sub?.remove();
}

/** A prototype load failed natively (network, bad bundle). Returns unsubscribe. */
export function onLoadFailed(cb: (e: { message?: string }) => void): () => void {
  const sub = emitter?.addListener('protoLoadFailed', cb);
  return () => sub?.remove();
}

/**
 * Load a prototype bundle on-device. Accepts a bare app URL (exp:// or an EAS
 * Update https URL) or the `prototo://expo-development-client/?url=…` deep link;
 * the native side extracts the inner URL.
 */
export function loadPrototype(url: string): void {
  native?.loadPrototype(url);
}

/** Return from a running prototype to our shell (loads the embedded bundle). */
export function goHome(): void {
  native?.goHome();
}

/**
 * Tell the native host the shell runtime is up (module registration done), so a
 * deep link that arrived during cold start / remount can load safely. Deep links
 * received mid-transition are deferred natively until this fires (or a short
 * native timeout, whichever comes first).
 */
export function shellReady(): void {
  native?.shellReady?.();
}
