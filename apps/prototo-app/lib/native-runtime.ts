import { NativeModules } from 'react-native';

type PrototoRuntimeModule = {
  loadPrototype: (url: string) => void;
  goHome: () => void;
};

const native = (NativeModules as { PrototoRuntime?: PrototoRuntimeModule }).PrototoRuntime;

/** True when running inside the native Prototo host (vs a plain Expo Go / web context). */
export const isNativeRuntimeAvailable = native != null;

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
