// Native filled controls can retain white labels even when a dark-mode accent is light.
// For opaque hex accents, choose the higher-contrast black/white foreground.
// Leave other native color formats to the platform instead of guessing their compositing.
export function accentForeground(accent: string): string | undefined {
  let hex = accent.replace(/^#/, '');
  if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(accent)) return undefined;
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const channels = [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#FFFFFF';
}
