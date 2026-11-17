// Open5e's published schema (docs/export.md#open5e): the API's OpenAPI 3.0 component schemas for
// the records the translator writes, vendored in open5e.schema.json, checked with Ajv. OpenAPI's
// `nullable` becomes a JSON Schema `null` alternative. Where the published schema and the live
// API disagree, the check follows the live API through CORRECTIONS, each backed by a fixture
// taken from the API (tests/fixtures/open5e/).
import { Ajv, type ErrorObject } from 'ajv';
import raw from './open5e.schema.json' with { type: 'json' };

/** The Open5e record kinds the translator writes, by their component schema. */
export type Open5eKind = 'Creature' | 'Spell' | 'MagicItem' | 'Item' | 'Condition';

export interface Correction {
  /** The component schema and property, `Creature.speed`. */
  at: string;
  /** What the live API does that the schema doesn't allow. */
  live: string;
  /** The fixture that shows it. */
  fixture: string;
  apply(schemas: Record<string, any>): void;
}

const nullable = (node: any): any => ({ anyOf: [node, { type: 'null' }] });
const prop = (schemas: Record<string, any>, at: string): { parent: any; key: string } => {
  const [schema = '', key = ''] = at.split('.');
  return { parent: schemas[schema].properties, key };
};
const allowNull = (at: string, fixture: string): Correction => ({
  at,
  live: 'returns null for this related record when there is none',
  fixture,
  apply(schemas) {
    const { parent, key } = prop(schemas, at);
    parent[key] = nullable(parent[key]);
  },
});
const notRequired = (schema: string, keys: string[], live: string, fixture: string): Correction => ({
  at: `${schema}.${keys.join(', ')}`,
  live,
  fixture,
  apply(schemas) {
    schemas[schema].required = (schemas[schema].required as string[]).filter((k) => !keys.includes(k));
  },
});

export const CORRECTIONS: Correction[] = [
  allowNull('CreatureActionAttack.damage_type', 'creatures-lich.json'),
  allowNull('CreatureActionAttack.extra_damage_type', 'creatures-lich.json'),
  allowNull('MagicItem.weapon', 'magicitems-boots-of-levitation.json'),
  allowNull('MagicItem.armor', 'magicitems-boots-of-levitation.json'),
  allowNull('Item.weapon', 'items-chain-mail.json'),
  allowNull('Item.armor', 'items-longsword.json'),
  {
    at: 'Creature.speed',
    live: 'gives each speed as an integer and lists only the speeds the creature has, plus `unit`',
    fixture: 'creatures-lich.json',
    apply(schemas) {
      schemas.speed = {
        type: 'object',
        properties: {
          unit: { type: 'string' },
          walk: { type: 'integer' },
          fly: { type: 'integer' },
          swim: { type: 'integer' },
          climb: { type: 'integer' },
          burrow: { type: 'integer' },
          hover: { type: 'boolean' },
        },
      };
    },
  },
  allowNull('Creature.illustration', 'creatures-lich.json'),
  allowNull('Condition.icon', 'conditions-bloodied.json'),
  {
    at: 'CreatureAction.crossreferences',
    live: 'gives an action\'s cross-references as `{ to: [...] }`, as on the creature, not a string',
    fixture: 'creatures-lich.json',
    apply(schemas) {
      schemas.CreatureAction.properties.crossreferences = { $ref: '#/components/schemas/CrossReferences' };
    },
  },
  notRequired('MagicItem', ['is_magic_item'], 'leaves out `is_magic_item`', 'magicitems-boots-of-levitation.json'),
  notRequired('WeaponSummary', ['is_melee'], 'leaves out a weapon\'s `is_melee`', 'items-longsword.json'),
  notRequired('Condition', ['crossreferences'], 'leaves out a condition\'s `crossreferences`', 'conditions-poisoned.json'),
  notRequired('skill_bonuses', [...(raw.components.schemas.skill_bonuses.required as string[])], 'lists only the skills the creature is proficient in', 'creatures-lich.json'),
  {
    at: 'CreatureAction.usage_limits',
    live: 'returns null when an action has no usage limit',
    fixture: 'creatures-lich.json',
    apply(schemas) {
      schemas.CreatureAction.properties.usage_limits = nullable(schemas.CreatureAction.properties.usage_limits);
    },
  },
];

/** OpenAPI 3.0 to JSON Schema: `nullable` as a null alternative, and the keywords Ajv doesn't know dropped. */
function toJsonSchema(node: any): any {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (node === null || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'nullable' || key === 'readOnly' || key.startsWith('x-') || key === 'format') continue;
    out[key] = key === '$ref' ? String(value).replace('#/components/schemas/', '#/definitions/') : toJsonSchema(value);
  }
  if (node.nullable === true) {
    if (typeof out.type === 'string') out.type = [out.type, 'null'];
    else return nullable(out);
  }
  return out;
}

let compiled: Map<Open5eKind, (record: unknown) => string[]> | undefined;

function validators(): Map<Open5eKind, (record: unknown) => string[]> {
  if (compiled) return compiled;
  const schemas = structuredClone(raw.components.schemas) as Record<string, any>;
  for (const correction of CORRECTIONS) correction.apply(schemas);
  const definitions = Object.fromEntries(Object.entries(schemas).map(([k, v]) => [k, toJsonSchema(v)]));
  const ajv = new Ajv({ allErrors: true, strict: false });
  compiled = new Map();
  for (const kind of ['Creature', 'Spell', 'MagicItem', 'Item', 'Condition'] as Open5eKind[]) {
    const validate = ajv.compile({ definitions, $ref: `#/definitions/${kind}` });
    compiled.set(kind, (record) =>
      validate(record) ? [] : (validate.errors ?? []).map((e: ErrorObject) => `${e.instancePath || '/'} ${e.message ?? 'is invalid'}`),
    );
  }
  return compiled;
}

/** Schema errors for one record of `kind`, empty when it passes. */
export const checkOpen5e = (kind: Open5eKind, record: unknown): string[] => validators().get(kind)!(record);
