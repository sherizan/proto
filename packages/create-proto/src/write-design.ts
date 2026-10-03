import fs from 'node:fs';
import path from 'node:path';
import { renderDesignDoc, type ThemeName } from '@sherizan/proto-cli/design';
import type { ProtoConfig } from '@sherizan/proto-cli/design-profiles';
import { getLibrary } from '@sherizan/proto-cli/design-libraries';

const DEFAULT_THEME: ThemeName = 'liquidGlass';
const DEFAULT_ACCENT = '#007AFF';

export type WriteDesignOptions = {
  config?: ProtoConfig;
  destRoot: string;
  projectName: string;
  date: string;
};

export async function writeDesignDoc(options: WriteDesignOptions): Promise<void> {
  const md = renderDesignDoc({
    config: options.config,
    appName: options.projectName,
    theme: DEFAULT_THEME,
    accent: DEFAULT_ACCENT,
    library: getLibrary('proto'),
    date: options.date,
  });
  await fs.promises.writeFile(path.join(options.destRoot, 'DESIGN.md'), md, 'utf8');
}
