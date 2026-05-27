import fs from 'node:fs';
import path from 'node:path';
import { renderDesignDoc, type ThemeName } from '@sherizan/proto-cli/design';
import { getLibrary } from '@sherizan/proto-cli/design-libraries';

const DEFAULT_THEME: ThemeName = 'liquidGlass';
const DEFAULT_ACCENT = '#007AFF';

export type WriteDesignOptions = {
  destRoot: string;
  projectName: string;
  date: string;
};

export async function writeDesignDoc(options: WriteDesignOptions): Promise<void> {
  const md = renderDesignDoc({
    appName: options.projectName,
    theme: DEFAULT_THEME,
    accent: DEFAULT_ACCENT,
    library: getLibrary('proto'),
    date: options.date,
  });
  await fs.promises.writeFile(path.join(options.destRoot, 'DESIGN.md'), md, 'utf8');
}
