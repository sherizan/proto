export type HeaderInputs = {
  brand: string;
  version: string;
  theme: string;
  target: string;
  cwd: string;
};

const THEME_LABEL: Record<string, string> = {
  liquidGlass: 'Liquid Glass',
  materialYou: 'Material You',
  base: 'Base',
};

const MARK = ['▗ ▗ ▗', ' ▗ ▗ ', '▗ ▗ ▗'];

export function renderHeader(inputs: HeaderInputs): string {
  const themeLabel = THEME_LABEL[inputs.theme] ?? 'Liquid Glass';
  const right = [
    `${inputs.brand} v${inputs.version}`,
    `${themeLabel} · ${inputs.target}`,
    inputs.cwd,
  ];
  return MARK.map((mark, i) => `${mark}   ${right[i]}`).join('\n');
}
