// Expo SDK 58 supports Node 22.13+, 24.3+ and 26+; odd majors are unsupported.
export function nodeSupported(version: string): boolean {
  const [major = 0, minor = 0] = version.split('.').map(Number);
  if (major === 22) return minor >= 13;
  if (major === 24) return minor >= 3;
  return major >= 26 && major % 2 === 0;
}
