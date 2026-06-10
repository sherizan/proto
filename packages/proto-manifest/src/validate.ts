import { z } from 'zod';
import type { Action, Manifest, Node } from './types.js';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('navigate'), to: z.string() }).strict(),
  z.object({ action: z.literal('dismiss') }).strict(),
  z
    .object({
      action: z.literal('setState'),
      key: z.string(),
      value: z.union([z.boolean(), z.string()]),
    })
    .strict(),
  z.object({ action: z.literal('toggleState'), key: z.string() }).strict(),
  z.object({ action: z.literal('showModal'), key: z.string() }).strict(),
  z.object({ action: z.literal('hideModal'), key: z.string() }).strict(),
]);

const textSize = z.enum(['title', 'headline', 'body', 'caption', 'label']);
const textColor = z.enum(['primary', 'secondary', 'accent', 'destructive']);
const buttonVariant = z.enum(['primary', 'secondary', 'ghost', 'destructive']);
const rowAlign = z.enum(['start', 'center', 'end']);

const children = () => z.array(nodeSchema);

const screenNodeSchema = z
  .object({
    type: z.literal('Screen'),
    title: z.string().optional(),
    scrollable: z.boolean().optional(),
    children: z.array(z.lazy(() => nodeSchema)),
  })
  .strict();

const nodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.discriminatedUnion('type', [
    screenNodeSchema,
    z
      .object({
        type: z.literal('Stack'),
        gap: z.number().optional(),
        padding: z.number().optional(),
        children: children(),
      })
      .strict(),
    z
      .object({
        type: z.literal('Row'),
        gap: z.number().optional(),
        align: rowAlign.optional(),
        children: children(),
      })
      .strict(),
    z
      .object({
        type: z.literal('Text'),
        value: z.string(),
        size: textSize.optional(),
        color: textColor.optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal('Card'),
        glass: z.boolean().optional(),
        padding: z.number().optional(),
        onTap: actionSchema.optional(),
        children: children(),
      })
      .strict(),
    z
      .object({
        type: z.literal('Button'),
        label: z.string(),
        variant: buttonVariant.optional(),
        onTap: actionSchema.optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal('Toggle'),
        label: z.string(),
        value: z.boolean().optional(),
        bind: z.string().optional(),
        onChange: actionSchema.optional(),
      })
      .strict(),
    z.object({ type: z.literal('Divider') }).strict(),
    z
      .object({
        type: z.literal('Modal'),
        title: z.string(),
        visible: z.boolean().optional(),
        bind: z.string().optional(),
        onClose: actionSchema.optional(),
        children: children(),
      })
      .strict(),
  ]),
);

const themeOverridesSchema = z
  .object({
    surface: z.record(z.string()).optional(),
    text: z.record(z.string()).optional(),
    blur: z.record(z.number()).optional(),
    border: z.record(z.string()).optional(),
    radius: z.record(z.number()).optional(),
    space: z.record(z.number()).optional(),
  })
  .strict();

const manifestSchema = z
  .object({
    manifestVersion: z.literal('1'),
    app: z
      .object({
        name: z.string(),
        theme: z.enum(['liquidGlass', 'materialYou', 'base']).optional(),
        colorScheme: z.enum(['system', 'light', 'dark']).optional(),
        accentColor: z.string().optional(),
        tokens: themeOverridesSchema.optional(),
      })
      .strict(),
    initialScreen: z.string(),
    state: z.record(z.union([z.boolean(), z.string()])).optional(),
    screens: z.record(screenNodeSchema),
  })
  .strict();

export type ValidationResult = { ok: true; manifest: Manifest } | { ok: false; errors: string[] };

/** Every node action that addresses a state key, plus the key it touches. */
function stateKeyOf(action: Action): string | null {
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

type Refs = { navigateTargets: Set<string>; stateKeys: Set<string> };

function collectRefs(node: Node, refs: Refs): void {
  switch (node.type) {
    case 'Button':
      if (node.onTap) addActionRef(node.onTap, refs);
      break;
    case 'Toggle':
      if (node.bind) refs.stateKeys.add(node.bind);
      if (node.onChange) addActionRef(node.onChange, refs);
      break;
    case 'Modal':
      if (node.bind) refs.stateKeys.add(node.bind);
      if (node.onClose) addActionRef(node.onClose, refs);
      for (const child of node.children) collectRefs(child, refs);
      break;
    case 'Card':
      if (node.onTap) addActionRef(node.onTap, refs);
      for (const child of node.children) collectRefs(child, refs);
      break;
    case 'Screen':
    case 'Stack':
    case 'Row':
      for (const child of node.children) collectRefs(child, refs);
      break;
    default:
      break;
  }
}

function addActionRef(action: Action, refs: Refs): void {
  if (action.action === 'navigate') refs.navigateTargets.add(action.to);
  const key = stateKeyOf(action);
  if (key) refs.stateKeys.add(key);
}

/**
 * Validate an unknown value as a Prototo manifest.
 *
 * Two passes: a structural pass (shape, enums, required fields) and a
 * referential pass (every screen and state key a node points at must exist).
 * Errors are collected into plain strings — the compile step surfaces them to
 * the designer through the error-translation layer.
 */
export function validateManifest(input: unknown): ValidationResult {
  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    return { ok: false, errors };
  }

  const manifest = parsed.data as Manifest;
  const errors: string[] = [];

  if (!(manifest.initialScreen in manifest.screens)) {
    errors.push(`Initial screen "${manifest.initialScreen}" is not defined in screens.`);
  }

  const refs: Refs = { navigateTargets: new Set(), stateKeys: new Set() };
  for (const screen of Object.values(manifest.screens)) collectRefs(screen, refs);

  for (const target of refs.navigateTargets) {
    if (!(target in manifest.screens)) {
      errors.push(`This prototype links to a screen that doesn't exist: "${target}".`);
    }
  }

  const declaredState = new Set(Object.keys(manifest.state ?? {}));
  for (const key of refs.stateKeys) {
    if (!declaredState.has(key)) {
      errors.push(`This prototype uses a state value that isn't declared: "${key}".`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest };
}
