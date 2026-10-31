// Reads a type's raw `stats` schema alongside an entry, for the two things the
// index needs the schema for (SPEC.md §5.7, §5.8, §9.1): which values sit at
// `RefOrText` fields, and whether an omitted facet is an optional flag.

export type Schema = { [key: string]: unknown };

/** A type's `stats` schema and the schema files its `$ref`s may name. */
export interface SchemaSet {
  root: Schema;
  /** Other schema files by file name, such as `common.schema.json`. */
  files: Map<string, Schema>;
}

const isObject = (value: unknown): value is Schema => typeof value === 'object' && value !== null && !Array.isArray(value);
const REF_OR_TEXT = /#\/\$defs\/RefOrText$/;

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

const isRefOrText = (nodes: Node[]) => nodes.some(({ schema }) => typeof schema.$ref === 'string' && REF_OR_TEXT.test(schema.$ref));

/** The subschemas for `key` of an object, or for the items of an array. */
function childNodes(nodes: Node[], key: string | number): Node[] {
  return nodes.flatMap(({ schema, doc }) => {
    const child = typeof key === 'number' ? schema.items : isObject(schema.properties) ? schema.properties[key] : undefined;
    return isObject(child) ? [{ schema: child, doc }] : [];
  });
}

/**
 * Every value in schema-valid `stats` that sits at a `RefOrText` field (§5.7):
 * a ref object or a plain string, in document order.
 */
export function refOrTextValues(stats: unknown, set: SchemaSet): unknown[] {
  const out: unknown[] = [];
  const visit = (data: unknown, nodes: Node[]) => {
    const all = nodes.flatMap((node) => applicable(node, set));
    if (isRefOrText(all)) {
      out.push(data);
      return;
    }
    if (Array.isArray(data)) data.forEach((item, i) => visit(item, childNodes(all, i)));
    else if (isObject(data)) for (const [key, value] of Object.entries(data)) visit(value, childNodes(all, key));
  };
  visit(stats, [{ schema: set.root, doc: set.root }]);
  return out;
}

/**
 * Whether `path` (below `stats`, such as `cursed` or `attunement.required`)
 * is an optional boolean flag: a field whose only valid value is `true`
 * (§5.8). An omitted flag reads as `false`.
 */
export function isFlag(path: string, set: SchemaSet): boolean {
  let nodes: Node[] = [{ schema: set.root, doc: set.root }];
  for (const key of path.split('.')) nodes = childNodes(nodes.flatMap((node) => applicable(node, set)), key);
  return nodes.flatMap((node) => applicable(node, set)).some(({ schema }) => schema.const === true);
}
