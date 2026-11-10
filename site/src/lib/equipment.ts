// Text for dnd-5e-2024 equipment (docs/rulesets.md#equipment), in SRD 5.2 form: costs, weights,
// and the lines for each category. Lines that link (properties, mastery) are markdown with
// `{ref:…}` tokens. Optional fields display only when present (docs/content-model.md#situational-fields).

import type { Cost, EquipmentStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import { escapeMarkdown } from './markdown.ts';
import { name, pluralOf, sayText } from './wording.ts';
import type { PropertyLine } from './template.ts';


/** "1,500" */
const thousands = (n: number): string => n.toLocaleString('en-US');

/** "15 GP", "1,500 GP", "5 CP". */
export const costText = (cost: Cost): string => `${thousands(cost.amount)} ${cost.unit.toUpperCase()}`;

/** A number as the SRD prints it: a whole number, a fraction below 1 ("1/4", "1/2"), or a mixed one ("1½", "58½"). */
export function numberText(n: number): string {
  const whole = Math.floor(n);
  const fraction = Math.round((n - whole) * 4) / 4;
  if (fraction === 0) return thousands(whole);
  const glyph = { 0.25: ['1/4', '¼'], 0.5: ['1/2', '½'], 0.75: ['3/4', '¾'] }[fraction] ?? [String(fraction), String(fraction)];
  return whole === 0 ? glyph[0]! : `${thousands(whole)}${glyph[1]}`;
}

/** "3 lb.", "1/4 lb.", "5 lb. (full)". */
export const weightText = (weight: number, note?: string): string => `${numberText(weight)} lb.${note ? ` (${note})` : ''}`;

/** What a table prints for equipment with variants: "Varies" when any variant has the value, "—" when none does. */
const varies = (s: EquipmentStats, key: 'cost' | 'weight'): string => ((s.variants ?? []).some((v) => v[key] !== undefined) ? 'Varies' : '—');

/** "1d8 Slashing", "1 Piercing". */
export const damageText = (damage: NonNullable<EquipmentStats['weapon']>['damage']): string =>
  `${damage.dice ?? damage.flat} ${name('damageType', damage.type)}`;

/**
 * A weapon's properties as the SRD prints them, each linked: "Ammunition (Range 80/320; Bolt), Loading,
 * Two-Handed", "Thrown (Range 20/60), Versatile (1d8)", "Two-Handed (unless mounted)"; "—" with none.
 */
export function propertiesText(weapon: NonNullable<EquipmentStats['weapon']>): string {
  const props = weapon.properties ?? [];
  if (props.length === 0) return '—';
  const range = weapon.range ? `Range ${weapon.range.normal}/${weapon.range.long}` : '';
  return props
    .map((p) => {
      const id = p.ref.slice(p.ref.indexOf('/') + 1);
      const detail =
        id === 'ammunition' ? `${range}; ${weapon.ammunition}` : id === 'thrown' ? range : id === 'versatile' ? weapon.versatile : p.note;
      return detail ? `{ref:${p.ref}} (${escapeMarkdown(detail)})` : `{ref:${p.ref}}`;
    })
    .join(', ');
}

/** "11 + Dex modifier", "12 + Dex modifier (max 2)", "16"; a Shield's "+2". */
export function armorClassText(armor: NonNullable<EquipmentStats['armor']>, shield: boolean): string {
  if (shield) return `+${armor.ac}`;
  if (!armor.dex) return String(armor.ac);
  const ac = String(armor.ac);
  return armor.dexMax === undefined ? sayText('equipment.dexArmor', { ac }) : sayText('equipment.dexArmorMax', { ac, max: String(armor.dexMax) });
}

/** A tool's variants as the SRD prints them: "Dice (1 SP), dragonchess (1 GP)", or with weights, "Bagpipes (30 GP, 6 lb.)". */
export const variantsText = (s: EquipmentStats): string =>
  (s.variants ?? [])
    .map((v) => {
      const parts = [v.cost ? costText(v.cost) : undefined, v.weight !== undefined ? weightText(v.weight) : undefined].filter(Boolean);
      return parts.length ? `${v.name} (${parts.join(', ')})` : v.name;
    })
    .join(', ');

/** "1 ton", "150 tons", "1/2 ton". */
const tons = (n: number): string => `${numberText(n)} ${n > 1 ? pluralOf('ton') : 'ton'}`;

/**
 * The labeled lines of an equipment's stats, for its section on a rules page and its card: the
 * category block's lines, then weight and cost. `shield` reads an armor's AC as a bonus.
 */
export function equipmentLines(s: EquipmentStats, shield = false): PropertyLine[] {
  const lines: (PropertyLine | undefined)[] = [];
  if (s.weapon) {
    lines.push({ label: 'Damage', value: damageText(s.weapon.damage) });
    lines.push({ label: 'Properties', value: propertiesText(s.weapon), markdown: true });
    lines.push({ label: 'Mastery', value: `{ref:${s.weapon.mastery.ref}}`, markdown: true });
  }
  if (s.armor) {
    lines.push({ label: 'Armor Class', value: armorClassText(s.armor, shield) });
    if (s.armor.strength !== undefined) lines.push({ label: 'Strength', value: `Str ${s.armor.strength}` });
    if (s.armor.stealthDisadvantage) lines.push({ label: 'Stealth', value: 'Disadvantage' });
  }
  if (s.tool) {
    lines.push({ label: 'Ability', value: name('ability', s.tool.ability) });
    lines.push({ label: 'Utilize', value: s.tool.utilize, markdown: true });
    if (s.tool.craft !== undefined) lines.push({ label: 'Craft', value: s.tool.craft, markdown: true });
    if (s.variants) lines.push({ label: 'Variants', value: variantsText(s) });
  }
  if (s.mount) lines.push({ label: 'Carrying Capacity', value: `${thousands(s.mount.carryingCapacity)} lb.` });
  if (s.vehicle) {
    const v = s.vehicle;
    lines.push({ label: 'Speed', value: `${numberText(v.speedMph)} mph` });
    lines.push({ label: 'Crew', value: thousands(v.crew) });
    if (v.passengers !== undefined) lines.push({ label: 'Passengers', value: thousands(v.passengers) });
    if (v.cargoTons !== undefined) lines.push({ label: 'Cargo', value: tons(v.cargoTons) });
    lines.push({ label: 'AC', value: String(v.ac) });
    lines.push({ label: 'HP', value: thousands(v.hp) });
    if (v.damageThreshold !== undefined) lines.push({ label: 'Damage Threshold', value: String(v.damageThreshold) });
  }
  if (!s.mount && !s.vehicle) {
    const weight = s.variants ? varies(s, 'weight') : s.weight !== undefined ? weightText(s.weight, s.weightNote) : '—';
    lines.push({ label: 'Weight', value: weight });
  }
  lines.push({ label: 'Cost', value: s.variants ? varies(s, 'cost') : s.cost ? costText(s.cost) : '—' });
  return lines.filter((line): line is PropertyLine => line !== undefined);
}

type Variant = NonNullable<EquipmentStats['variants']>[number];

/** A variants table's columns: the name, then whichever of amount, storage, weight, and cost any variant has. */
export function variantsTable(s: EquipmentStats): { headers: string[]; rows: string[][] } | undefined {
  const variants = s.variants;
  if (!variants || s.tool) return undefined;
  const columns: { header: string; cell: (v: Variant) => string }[] = [
    { header: 'Variant', cell: (v) => v.name },
    ...(variants.some((v) => v.amount !== undefined) ? [{ header: 'Amount', cell: (v: Variant) => (v.amount !== undefined ? String(v.amount) : '—') }] : []),
    ...(variants.some((v) => v.storage !== undefined) ? [{ header: 'Storage', cell: (v: Variant) => v.storage ?? '—' }] : []),
    ...(variants.some((v) => v.weight !== undefined) ? [{ header: 'Weight', cell: (v: Variant) => (v.weight !== undefined ? weightText(v.weight) : '—') }] : []),
    ...(variants.some((v) => v.cost !== undefined) ? [{ header: 'Cost', cell: (v: Variant) => (v.cost ? costText(v.cost) : '—') }] : []),
  ];
  return { headers: columns.map((c) => c.header), rows: variants.map((v) => columns.map((c) => c.cell(v))) };
}
