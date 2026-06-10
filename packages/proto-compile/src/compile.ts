import {
  type Action,
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

/** Components whose `onTap` string compiles to a manifest action. */
const ONTAP_COMPONENTS = new Set(['Button', 'Card']);

type StateMap = Record<string, boolean | string>;

/** Collected while walking one screen: explicit `<Screen state={{...}}>` overrides. */
type Ctx = { overrides: StateMap };

type ScreenCompile = { screen: ScreenNode; inferred: Set<string>; overrides: StateMap };

function compileScreenCore(source: string): ScreenCompile {
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

  const ctx: Ctx = { overrides: {} };
  const root = mapElement(jsx, ctx);
  if (root.type !== 'Screen') {
    throw new CompileError(
      `A screen must start with <Screen>. This one starts with <${root.type}>.`,
    );
  }
  const inferred = new Set<string>();
  collectStateKeys(root, inferred);
  return { screen: root, inferred, overrides: ctx.overrides };
}

export type CompileScreenResult =
  | { ok: true; screen: ScreenNode; state: StateMap }
  | { ok: false; errors: string[] };

export function compileScreen(source: string): CompileScreenResult {
  try {
    const { screen, inferred, overrides } = compileScreenCore(source);
    const state: StateMap = {};
    for (const key of inferred) state[key] = false;
    Object.assign(state, overrides);
    return { ok: true, screen, state };
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
  | { ok: true; manifest: Manifest; warnings: string[] }
  | { ok: false; errors: string[] };

export function compileManifest(
  screens: Array<{ name: string; source: string }>,
  config: CompileConfig,
): CompileManifestResult {
  const errors: string[] = [];
  const results: Array<{ name: string } & ScreenCompile> = [];
  for (const { name, source } of screens) {
    try {
      results.push({ name, ...compileScreenCore(source) });
    } catch (err) {
      if (err instanceof CompileError) {
        errors.push(`${name}: ${err.message}`);
        continue;
      }
      throw err;
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const warnings: string[] = [];
  const state: StateMap = {};
  const explicitBy: Record<string, string> = {};
  for (const { inferred } of results) {
    for (const key of inferred) {
      if (!(key in state)) state[key] = false;
    }
  }
  for (const { name, overrides } of results) {
    for (const [key, value] of Object.entries(overrides)) {
      const prior = explicitBy[key];
      if (prior && state[key] !== value) {
        warnings.push(
          `State "${key}" starts as ${JSON.stringify(value)} — ${name} and ${prior} set different initial values; the last one wins.`,
        );
      }
      state[key] = value;
      explicitBy[key] = name;
    }
  }
  if (config.state) Object.assign(state, config.state);

  const app: Manifest['app'] = { name: config.name };
  if (config.theme) app.theme = config.theme;
  if (config.colorScheme) app.colorScheme = config.colorScheme;
  if (config.accentColor) app.accentColor = config.accentColor;
  if (config.tokens) app.tokens = config.tokens;

  const manifest: Manifest = {
    manifestVersion: '1',
    app,
    initialScreen: config.initialScreen,
    screens: Object.fromEntries(results.map((r) => [r.name, r.screen])),
  };
  if (Object.keys(state).length > 0) manifest.state = state;

  const validated = validateManifest(manifest);
  if (!validated.ok) return { ok: false, errors: validated.errors };
  return { ok: true, manifest: validated.manifest, warnings };
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

function mapElement(el: JsxElement | JsxSelfClosingElement, ctx: Ctx): ManifestNode {
  const { tag, attributes, children } = unpack(el);
  const spec = COMPONENTS[tag];
  if (!spec) {
    throw new CompileError(`This screen uses something Prototo can't share yet: <${tag}>.`);
  }

  const node: Record<string, unknown> = { type: tag };
  for (const attr of attributes) applyAttribute(node, tag, spec, attr, ctx);

  if (spec.text) {
    node.value = extractText(children);
  } else if (spec.container) {
    node.children = mapChildren(children, ctx);
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
  ctx: Ctx,
): void {
  if (!Node.isJsxAttribute(attr)) {
    throw new CompileError(`Spread props aren't shareable on <${tag}>.`);
  }
  const name = attr.getNameNode().getText();
  if (tag === 'Screen' && name === 'state') {
    Object.assign(ctx.overrides, parseStateObject(attr));
    return;
  }
  if (name === 'onTap' && ONTAP_COMPONENTS.has(tag)) {
    node.onTap = parseOnTap(attr, tag);
    return;
  }
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

/** Parse the enumerated `onTap` grammar into a manifest action. */
function parseOnTap(attr: JsxAttribute, tag: string): Action {
  const init = attr.getInitializer();
  let valueNode: Node | undefined = init;
  if (init && Node.isJsxExpression(init)) valueNode = init.getExpression();
  if (!valueNode || !Node.isStringLiteral(valueNode)) {
    throw new CompileError(
      `<${tag}> onTap must be a plain text action like "navigate:Detail" — code handlers are local-only fidelity.`,
    );
  }
  const raw = valueNode.getLiteralValue();
  if (raw === 'dismiss') return { action: 'dismiss' };
  const [verb, ...rest] = raw.split(':');
  const arg = rest[0];
  if (verb === 'navigate' && rest.length === 1 && arg) return { action: 'navigate', to: arg };
  if (verb === 'toggle' && rest.length === 1 && arg) return { action: 'toggleState', key: arg };
  if (verb === 'showModal' && rest.length === 1 && arg) return { action: 'showModal', key: arg };
  if (verb === 'hideModal' && rest.length === 1 && arg) return { action: 'hideModal', key: arg };
  if (verb === 'set' && rest.length === 2 && arg && rest[1] !== undefined) {
    const v = rest[1] === 'true' ? true : rest[1] === 'false' ? false : rest[1];
    return { action: 'setState', key: arg, value: v };
  }
  throw new CompileError(
    `"${raw}" isn't a shareable interaction. Use navigate:<Screen>, dismiss, toggle:<key>, showModal:<key>, hideModal:<key>, or set:<key>:<value>.`,
  );
}

/** Parse `<Screen state={{ key: value }}>` initial-value overrides. */
function parseStateObject(attr: JsxAttribute): StateMap {
  const init = attr.getInitializer();
  const expr = init && Node.isJsxExpression(init) ? init.getExpression() : undefined;
  if (!expr || !Node.isObjectLiteralExpression(expr)) {
    throw new CompileError('Screen "state" must be a plain object like {{ darkMode: true }}.');
  }
  const out: StateMap = {};
  for (const prop of expr.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) {
      throw new CompileError('Screen "state" entries must be simple key: value pairs.');
    }
    const nameNode = prop.getNameNode();
    const key = Node.isStringLiteral(nameNode) ? nameNode.getLiteralValue() : nameNode.getText();
    const v = prop.getInitializer();
    if (v && Node.isStringLiteral(v)) out[key] = v.getLiteralValue();
    else if (v?.getKind() === SyntaxKind.TrueKeyword) out[key] = true;
    else if (v?.getKind() === SyntaxKind.FalseKeyword) out[key] = false;
    else throw new CompileError(`Screen state "${key}" must be true, false, or plain text.`);
  }
  return out;
}

function actionStateKey(action: Action): string | null {
  switch (action.action) {
    case 'setState':
    case 'toggleState':
    case 'showModal':
    case 'hideModal':
      return action.key;
    default:
      return null;
  }
}

/** Every state key a compiled screen references via bind or an onTap action. */
function collectStateKeys(node: ManifestNode, keys: Set<string>): void {
  switch (node.type) {
    case 'Toggle':
      if (node.bind) keys.add(node.bind);
      break;
    case 'Button': {
      const key = node.onTap && actionStateKey(node.onTap);
      if (key) keys.add(key);
      break;
    }
    case 'Card': {
      const key = node.onTap && actionStateKey(node.onTap);
      if (key) keys.add(key);
      for (const child of node.children) collectStateKeys(child, keys);
      break;
    }
    case 'Modal':
      if (node.bind) keys.add(node.bind);
      for (const child of node.children) collectStateKeys(child, keys);
      break;
    case 'Screen':
    case 'Stack':
    case 'Row':
      for (const child of node.children) collectStateKeys(child, keys);
      break;
    default:
      break;
  }
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

function mapChildren(children: JsxChild[], ctx: Ctx): ManifestNode[] {
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
      out.push(mapElement(child, ctx));
      continue;
    }
    throw new CompileError("This screen uses something Prototo can't share yet.");
  }
  return out;
}
