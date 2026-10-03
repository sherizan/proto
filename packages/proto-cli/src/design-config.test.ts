import { expect, it } from 'vitest';
import { prepareProfileEdit, readDesignConfig } from './design/config.js';

it('edits only design values, preserving comments and unrelated custom expressions', () => {
  const source = "// brand\nmodule.exports = {\n name: 'Demo',\n // retain me\n screens: chooseScreens(),\n accentColor: '#123456',\n};\n";
  const result = prepareProfileEdit(source, '# Notes\nKeep the logo.\n', { id: 'warm', version: '1.0.0' });
  expect(result.source).toContain('// retain me\n screens: chooseScreens(),');
  expect(result.source).toContain("name: 'Demo'");
  expect(result.source).toContain('// brand');
  expect(readDesignConfig(result.source).accentColor).toBe('#123456');
  expect(result.document).toContain('Keep the logo.');
});

it.each([
  'module.exports = getConfig();',
  'module.exports = { ...brand };',
  "module.exports = { accentColor: pickColor() };",
  "module.exports = { theme: 'base', theme: 'liquidGlass' };",
  "module.exports = { get theme() { return 'base' } };",
  "module.exports = {}; runSomething();",
  "module.exports = { ['theme']: 'base' };",
])('refuses configurations it cannot safely transform: %s', source => {
  expect(() => prepareProfileEdit(source, '', { id: 'warm', version: '1.0.0' })).toThrow();
});

it('supports a literal ESM default export and is stable when reapplied', () => {
  const first = prepareProfileEdit("export default { name: 'Demo' };", '', { id: 'editorial', version: '1.0.0' });
  const second = prepareProfileEdit(first.source, first.document, { id: 'editorial', version: '1.0.0' });
  expect(second).toEqual(first);
});
