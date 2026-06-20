declare module 'expo-linking' {
  export function openURL(url: string): Promise<boolean>;
  export function openSettings(): Promise<void>;
}
