import {
  type Manifest,
  type Node as ManifestNode,
  type ScreenNode,
  validateManifest,
} from '@sherizan/proto-manifest';
import {
  type JsxAttribute,
  type JsxChild,
  type JsxElement,
  type JsxSelfClosingElement,
  Node,
  Project,
  SyntaxKind,
  ts,
} from 'ts-morph';

/** Thrown internally when a screen can't be expressed as a shareable manifest. */
class CompileError extends Error {}

type PropType = 'string' | 'number' | 'boolean' | readonly string[];

type ComponentSpec = {
  container?: boolean;
  text?: boolean;
  props: Record<string, PropType>;
};

/** The shareable component surface — mirrors `docs/MANIFEST.md` node table. */
const COMPONENTS: Record<string, ComponentSpec> = {
  Screen: { container: true, props: { title: 'string', scrollable: 'boolean' } },
  Stack: { container: true, props: { gap: 'number', padding: 'number' } },
  Row: { container: true, props: { gap: 'number', align: ['start', 'center', 'end'] } },
  Text: {
    text: true,
    props: {
      size: ['title', 'headline', 'body', 'caption', 'label'],
      color: ['primary', 'secondary', 'accent', 'destructive'],
    },
  },
  Card: { container: true, props: { glass: 'boolean', padding: 'number' } },
  Button: {
    props: { label: 'string', variant: ['primary', 'secondary', 'ghost', 'destructive'] },
  },
  Toggle: { props: { label: 'string', value: 'boolean', bind: 'string' } },
  Divider: { props: {} },
  Modal: { container: true, props: { title: 'string', visible: 'boolean', bind: 'string' } },
};

const PROTO_BARREL = /(^|\/)components\/proto$/;

export type CompileScreenResult =
  | { ok: true; screen: ScreenNode }
  | { ok: false; errors: string[] };

export function compileScreen(source: string): CompileScreenResult {
  try {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext },
    });
    const sf = project.createSourceFile('screen.tsx', source, { overwrite: true });

    checkImports(sf.getImportDeclarations().map((d) => d.getModuleSpecifierValue()));

    const fn = sf.getFunctions().find((f) => f.isDefaultExport());
    if (!fn) {
      throw new CompileError("Prototo couldn't find the screen — it must be the default export.");
    }
    const ret = fn.getFirstDescendantByKind(SyntaxKind.ReturnStatement);
    const jsx = ret && unwrapJsx(ret.getExpression());
    if (!jsx) throw new CompileError('This screen does not return anything to show.');

    const root = mapElement(jsx);
    if (root.type !== 'Screen') {
      throw new CompileError(
        `A screen must start with <Screen>. This one starts with <${root.type}>.`,
      );
    }
    return { ok: true, screen: root };
  } catch (err) {
    if (err instanceof CompileError) return { ok: false, errors: [err.message] };
    throw err;
  }
}

export type CompileConfig = {
  name: string;
  theme?: Manifest['app']['theme'];
  colorScheme?: Manifest['app']['colorScheme'];
  accentColor?: string;
  tokens?: Manifest['app']['tokens'];
  initialScreen: string;
  state?: Record<string, boolean | string>;
};

export type CompileManifestResult =
  | { ok: true; manifest: Manifest }
  | { ok: false; errors: string[] };

export function compileManifest(
  screens: Array<{ name: string; source: string }>,
  config: CompileConfig,
): CompileManifestResult {
  const errors: string[] = [];
  const compiled: Record<string, ScreenNode> = {};
  for (const { name, source } of screens) {
    const result = compileScreen(source);
    if (!result.ok) {
      errors.push(...result.errors.map((e) => `${name}: ${e}`));
      continue;
    }
    compiled[name] = result.screen;
  }
  if (errors.length > 0) return { ok: false, errors };

  const app: Manifest['app'] = { name: config.name };
  if (config.theme) app.theme = config.theme;
  if (config.colorScheme) app.colorScheme = config.colorScheme;
  if (config.accentColor) app.accentColor = config.accentColor;
  if (config.tokens) app.tokens = config.tokens;

  const manifest: Manifest = {
    manifestVersion: '1',
    app,
    initialScreen: config.initialScreen,
    screens: compiled,
  };
  if (config.state) manifest.state = config.state;

  const validated = validateManifest(manifest);
  if (!validated.ok) return { ok: false, errors: validated.errors };
  return { ok: true, manifest: validated.manifest };
}

// --- AST helpers -----------------------------------------------------------

function checkImports(specifiers: string[]): void {
  for (const spec of specifiers) {
    if (!PROTO_BARREL.test(spec)) {
      throw new CompileError(
        `This screen imports from "${spec}", which isn't shareable — a shared screen can only use Proto components (../components/proto). Anything from "${spec}" is local-only fidelity.`,
      );
    }
  }
}

function unwrapJsx(expr: Node | undefined): JsxElement | JsxSelfClosingElement | undefined {
  let current = expr;
  while (current && Node.isParenthesizedExpression(current)) current = current.getExpression();
  if (current && (Node.isJsxElement(current) || Node.isJsxSelfClosingElement(current))) {
    return current;
  }
  return undefined;
}

function unpack(el: JsxElement | JsxSelfClosingElement): {
  tag: string;
  attributes: Node[];
  children: JsxChild[];
} {
  if (Node.isJsxSelfClosingElement(el)) {
    return { tag: el.getTagNameNode().getText(), attributes: el.getAttributes(), children: [] };
  }
  const opening = el.getOpeningElement();
  return {
    tag: opening.getTagNameNode().getText(),
    attributes: opening.getAttributes(),
    children: el.getJsxChildren(),
  };
}

function mapElement(el: JsxElement | JsxSelfClosingElement): ManifestNode {
  const { tag, attributes, children } = unpack(el);
  const spec = COMPONENTS[tag];
  if (!spec) {
    throw new CompileError(`This screen uses something Prototo can't share yet: <${tag}>.`);
  }

  const node: Record<string, unknown> = { type: tag };
  for (const attr of attributes) applyAttribute(node, tag, spec, attr);

  if (spec.text) {
    node.value = extractText(children);
  } else if (spec.container) {
    node.children = mapChildren(children);
  } else {
    for (const child of children) {
      if (Node.isJsxElement(child) || Node.isJsxSelfClosingElement(child)) {
        throw new CompileError(`<${tag}> can't contain other elements in a shared prototype.`);
      }
    }
  }
  return node as ManifestNode;
}

function applyAttribute(
  node: Record<string, unknown>,
  tag: string,
  spec: ComponentSpec,
  attr: JsxAttribute | Node,
): void {
  if (!Node.isJsxAttribute(attr)) {
    throw new CompileError(`Spread props aren't shareable on <${tag}>.`);
  }
  const name = attr.getNameNode().getText();
  if (/^on[A-Z]/.test(name)) {
    throw new CompileError(
      `Interactions aren't shareable yet — <${tag}> "${name}" is local-only fidelity.`,
    );
  }
  const expected = spec.props[name];
  if (!expected) {
    throw new CompileError(`<${tag}> doesn't support "${name}" in a shared prototype.`);
  }
  node[name] = parseValue(name, attr, expected);
}

function parseValue(
  name: string,
  attr: JsxAttribute,
  expected: PropType,
): string | number | boolean {
  const init = attr.getInitializer();
  if (init === undefined) {
    if (expected === 'boolean') return true;
    throw new CompileError(`"${name}" needs a value.`);
  }
  let valueNode: Node = init;
  if (Node.isJsxExpression(init)) {
    const inner = init.getExpression();
    if (!inner) throw new CompileError(`"${name}" needs a value.`);
    valueNode = inner;
  }

  if (Node.isStringLiteral(valueNode)) {
    const s = valueNode.getLiteralValue();
    if (Array.isArray(expected)) {
      if (!expected.includes(s)) throw new CompileError(`"${s}" isn't a valid ${name}.`);
      return s;
    }
    if (expected !== 'string') throw typeError(name, expected);
    return s;
  }
  if (Node.isNumericLiteral(valueNode)) {
    if (expected !== 'number') throw typeError(name, expected);
    return Number(valueNode.getLiteralValue());
  }
  const kind = valueNode.getKind();
  if (kind === SyntaxKind.TrueKeyword || kind === SyntaxKind.FalseKeyword) {
    if (expected !== 'boolean') throw typeError(name, expected);
    return kind === SyntaxKind.TrueKeyword;
  }
  throw new CompileError(`This value isn't shareable: ${valueNode.getText()}.`);
}

function typeError(name: string, expected: PropType): CompileError {
  const want = Array.isArray(expected) ? `one of ${expected.join(', ')}` : `a ${expected}`;
  return new CompileError(`"${name}" should be ${want}.`);
}

function extractText(children: JsxChild[]): string {
  let text = '';
  for (const child of children) {
    if (Node.isJsxText(child)) {
      text += child.getText();
    } else if (Node.isJsxExpression(child)) {
      throw new CompileError("Dynamic text isn't shareable yet — use plain text.");
    } else {
      throw new CompileError('Text can only contain plain text in a shared prototype.');
    }
  }
  return text.trim();
}

function mapChildren(children: JsxChild[]): ManifestNode[] {
  const out: ManifestNode[] = [];
  for (const child of children) {
    if (Node.isJsxText(child)) {
      if (child.getText().trim() !== '') {
        throw new CompileError(`Unexpected text in a layout: "${child.getText().trim()}".`);
      }
      continue;
    }
    if (Node.isJsxExpression(child)) {
      throw new CompileError("Dynamic content isn't shareable yet.");
    }
    if (Node.isJsxElement(child) || Node.isJsxSelfClosingElement(child)) {
      out.push(mapElement(child));
      continue;
    }
    throw new CompileError("This screen uses something Prototo can't share yet.");
  }
  return out;
}
