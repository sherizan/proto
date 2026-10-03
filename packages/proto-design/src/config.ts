import { parse } from 'acorn';
import { applyProfile } from './profiles.js';
import { updateDesignSection } from './document.js';
import type { ProtoConfig } from './types.js';

const fields = ['theme', 'colorScheme', 'accentColor', 'tokens', 'designProfile'];
const unsupported = () => Error('This configuration uses custom code in its design settings. Keep it unchanged and use literal design values before applying a profile.');
function objectIn(source: string): any {
  const program = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  if (program.body.length !== 1) throw unsupported();
  const statement: any = program.body[0];
  let value;
  if (statement.type === 'ExportDefaultDeclaration') value = statement.declaration;
  else {
    const expression = statement.expression;
    if (statement.type !== 'ExpressionStatement' || expression?.type !== 'AssignmentExpression' || expression.operator !== '=' || expression.left.type !== 'MemberExpression' || expression.left.computed || expression.left.object.name !== 'module' || expression.left.property.name !== 'exports') throw unsupported();
    value = expression.right;
  }
  if (value.type !== 'ObjectExpression') throw unsupported();
  const used = new Set();
  for (const prop of value.properties) {
    if (prop.type !== 'Property' || prop.kind !== 'init' || prop.computed || prop.method || prop.shorthand) throw unsupported();
    const key = prop.key.name ?? prop.key.value;
    if (typeof key !== 'string' || used.has(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) throw unsupported();
    used.add(key);
  }
  return value;
}
function literal(node: any): any {
  if (node.type === 'Literal' && ['string', 'number', 'boolean'].includes(typeof node.value) && !node.regex && !node.bigint) return node.value;
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') return -node.argument.value;
  if (node.type !== 'ObjectExpression') throw unsupported();
  const out: Record<string, unknown> = {};
  for (const prop of node.properties) {
    if (prop.type !== 'Property' || prop.kind !== 'init' || prop.computed || prop.method || prop.shorthand) throw unsupported();
    const key = prop.key.name ?? prop.key.value;
    if (typeof key !== 'string' || Object.hasOwn(out, key) || ['__proto__', 'constructor', 'prototype'].includes(key)) throw unsupported();
    out[key] = literal(prop.value);
  }
  return out;
}
export function readDesignConfig(source: string): ProtoConfig {
  const object = objectIn(source);
  return Object.fromEntries(object.properties.filter((p: any) => fields.includes(p.key.name ?? p.key.value)).map((p: any) => [p.key.name ?? p.key.value, literal(p.value)]));
}
export function prepareProfileEdit(source: string, document: string, selection: { id: string; version: string }, overrides: unknown = {}, preserveExisting = true) {
  const object = objectIn(source);
  const config = applyProfile(readDesignConfig(source), selection, overrides, preserveExisting);
  const edits: { start: number; end: number; text: string }[] = [];
  const missing: string[] = [];
  for (const field of fields) {
    const value = JSON.stringify((config as any)[field], null, 2);
    const prop = object.properties.find((p: any) => (p.key.name ?? p.key.value) === field);
    if (prop) edits.push({ start: prop.value.start, end: prop.value.end, text: value });
    else missing.push(`${JSON.stringify(field)}: ${value},`);
  }
  if (missing.length) edits.push({ start: object.start + 1, end: object.start + 1, text: '\n' + missing.join('\n') + '\n' });
  let updated = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) updated = updated.slice(0, edit.start) + edit.text + updated.slice(edit.end);
  return { source: updated, document: updateDesignSection(document, config), config };
}
