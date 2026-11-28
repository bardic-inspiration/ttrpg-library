// Reads a type's raw `stats` schema, for what the index and the gallery need from it
// (docs/content-model.md#situational-fields, docs/site.md#index-build): whether an omitted
// facet is an optional flag, and whether a field reads as a chip (docs/content-model.md#display).

export type Schema = { [key: string]: unknown };

/** A type's `stats` schema and the schema files its `$ref`s may name. */
export interface SchemaSet {
  root: Schema;
  /** Other schema files by file name, such as `common.schema.json`. */
  files: Map<string, Schema>;
}

const isObject = (value: unknown): value is Schema => typeof value === 'object' && value !== null && !Array.isArray(value);

interface Node {
  schema: Schema;
  /** The document the schema sits in, for resolving `#/...` refs. */
  doc: Schema;
}

/** Follows a JSON pointer such as `/$defs/Text` within `doc`. */
function pointer(doc: Schema, ptr: string): Schema | undefined {
  let at: unknown = doc;
  for (const part of ptr.split('/').slice(1)) {
    if (!isObject(at)) return undefined;
    at = at[part.replaceAll('~1', '/').replaceAll('~0', '~')];
  }
  return isObject(at) ? at : undefined;
}

/**
 * `node` and every subschema that applies to the same instance: `$ref`
 * targets and the branches of `allOf`, `anyOf`, `oneOf`, `then`, and `else`.
 */
function applicable(node: Node, set: SchemaSet, seen = new Set<Schema>()): Node[] {
  if (seen.has(node.schema)) return [];
  seen.add(node.schema);
  const out: Node[] = [node];
  const { schema, doc } = node;
  if (typeof schema.$ref === 'string') {
    const [file = '', ptr = ''] = schema.$ref.split('#');
    const targetDoc = file ? set.files.get(file) : doc;
    const target = targetDoc && pointer(targetDoc, ptr);
    if (targetDoc && target) out.push(...applicable({ schema: target, doc: targetDoc }, set, seen));
  }
  const branches = [schema.allOf, schema.anyOf, schema.oneOf].flatMap((b) => (Array.isArray(b) ? b : []));
  for (const branch of [...branches, schema.then, schema.else]) {
    if (isObject(branch)) out.push(...applicable({ schema: branch, doc }, set, seen));
  }
  return out;
}

/** The subschemas for `key` of an object, or for the items of an array. */
function childNodes(nodes: Node[], key: string | number): Node[] {
  return nodes.flatMap(({ schema, doc }) => {
    const child = typeof key === 'number' ? schema.items : isObject(schema.properties) ? schema.properties[key] : undefined;
    return isObject(child) ? [{ schema: child, doc }] : [];
  });
}

/** The subschemas that apply to the field at `path` (below `stats`, such as `attunement.required`). */
function nodesAt(path: string, set: SchemaSet): Node[] {
  let nodes: Node[] = [{ schema: set.root, doc: set.root }];
  for (const key of path.split('.')) nodes = childNodes(nodes.flatMap((node) => applicable(node, set)), key);
  return nodes.flatMap((node) => applicable(node, set));
}

/**
 * Whether `path` (below `stats`, such as `cursed` or `attunement.required`)
 * is an optional boolean flag: a field whose only valid value is `true`
 * (docs/content-model.md#situational-fields). An omitted flag reads as `false`.
 */
export function isFlag(path: string, set: SchemaSet): boolean {
  return nodesAt(path, set).some(({ schema }) => schema.const === true);
}

/** The only value the `display` keyword takes (docs/content-model.md#display). */
export const CHIP = 'chip';

/** Whether the field at `path` (below `stats`) declares `"display": "chip"`, beside it or in a definition it refers to. */
export function isChip(path: string, set: SchemaSet): boolean {
  return nodesAt(path, set).some(({ schema }) => schema.display === CHIP);
}

const SCALARS = new Set(['string', 'number', 'integer', 'boolean']);

/** The JSON types a node's applicable subschemas allow, from `type`, `enum`, and `const`; empty when none says. */
function typesOf(nodes: Node[]): Set<string> {
  const out = new Set<string>();
  const kind = (value: unknown) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);
  for (const { schema } of nodes) {
    for (const type of Array.isArray(schema.type) ? schema.type : [schema.type]) if (typeof type === 'string') out.add(type);
    if (Array.isArray(schema.enum)) for (const value of schema.enum) out.add(kind(value));
    if ('const' in schema) out.add(kind(schema.const));
  }
  return out;
}

const allIn = (types: Set<string>, allowed: Set<string>) => types.size > 0 && [...types].every((t) => allowed.has(t));

/** Whether a facet could read the node: a string, number, boolean, or array of strings (docs/content-model.md#display). */
function facetReadable(node: Node, set: SchemaSet): boolean {
  const nodes = applicable(node, set);
  const types = typesOf(nodes);
  if (allIn(types, SCALARS)) return true;
  if (!allIn(types, new Set(['array']))) return false;
  const items = childNodes(nodes, 0).flatMap((item) => applicable(item, set));
  return allIn(typesOf(items), new Set(['string']));
}

/** Keywords whose value is one subschema, a list of them, or a map of them. */
const ONE = ['items', 'additionalProperties', 'not', 'if', 'then', 'else', 'contains', 'propertyNames', 'unevaluatedItems', 'unevaluatedProperties'];
const LIST = ['allOf', 'anyOf', 'oneOf', 'prefixItems'];
const MAP = ['properties', 'patternProperties', '$defs', 'dependentSchemas'];

/**
 * Every misuse of `display` in `doc`, one of `set`'s files, as `<JSON pointer>: <message>`
 * (docs/content-model.md#display): a value other than `chip`, or `chip` on a node a facet couldn't read.
 * It walks only subschemas, so a property named `display` is a field like any other.
 */
export function displayIssues(doc: Schema, set: SchemaSet): string[] {
  const issues: string[] = [];
  const visit = (schema: Schema, pointer: string) => {
    if ('display' in schema) {
      if (schema.display !== CHIP) issues.push(`${pointer || '/'}: display must be "${CHIP}"`);
      else if (!facetReadable({ schema, doc }, set)) issues.push(`${pointer || '/'}: display "${CHIP}" is only for a string, number, boolean, or string-array field`);
    }
    const at = (key: string) => `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
    for (const key of ONE) if (isObject(schema[key])) visit(schema[key], at(key));
    for (const key of LIST) {
      const list = schema[key];
      if (Array.isArray(list)) list.forEach((sub, i) => isObject(sub) && visit(sub, `${at(key)}/${i}`));
    }
    for (const key of MAP) {
      const map = schema[key];
      if (isObject(map)) for (const [name, sub] of Object.entries(map)) if (isObject(sub)) visit(sub, `${at(key)}/${name.replaceAll('~', '~0').replaceAll('/', '~1')}`);
    }
  };
  visit(doc, '');
  return issues;
}
