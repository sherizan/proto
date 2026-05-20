export type MetroLineResult =
  | { type: 'qr-url'; url: string }
  | { type: 'noise' }
  | { type: 'passthrough'; line: string };

const EXP_URL_RE = /(exp:\/\/[^\s]+)/;
const NOISE_PATTERNS: RegExp[] = [
  /^\s*$/,
  /^›/,
  /^Logs for your project/,
  /Metro running on port/,
  /Press \?/,
  /^Started Metro/,
];

export function filterMetroLine(line: string): MetroLineResult {
  const m = line.match(EXP_URL_RE);
  if (m) {
    return { type: 'qr-url', url: m[1] };
  }
  for (const re of NOISE_PATTERNS) {
    if (re.test(line)) return { type: 'noise' };
  }
  return { type: 'passthrough', line };
}
