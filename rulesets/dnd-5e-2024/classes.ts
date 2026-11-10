// Classes and subclasses for dnd-5e-2024 (docs/rulesets.md#classes, docs/rulesets.md#subclasses):
// what a class derives from its own stats and from the library, and the checks on both types and
// their class-feature components.

import type { Issue, LinkedEntry, LinkTarget } from '../module.ts';
import type { ClassFeatureStats, ClassSpell, ClassStats, DerivedClass, FeatureLevel, LinkedClass, SpellStats, SubclassStats, Tables } from './types.ts';

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

/** A feature level's number, with or without a note. */
export const levelOf = (level: FeatureLevel): number => (typeof level === 'number' ? level : level.level);

/**
 * The proficiency bonus at each level, from the Character Advancement table, and the slots from
 * `progression`: a full caster reads the Multiclass Spellcaster table at its level, a half caster
 * at half its level rounded up, and a pact caster the Pact Magic table.
 */
export function deriveClass(stats: ClassStats, tables: Tables): DerivedClass {
  const progression = stats.spellcasting?.progression;
  return {
    proficiencyBonus: [...tables.proficiencyBonusByLevel],
    ...(progression === 'full' && { spellSlots: LEVELS.map((level) => [...tables.multiclassSpellSlots[level - 1]!]) }),
    ...(progression === 'half' && { spellSlots: LEVELS.map((level) => [...tables.multiclassSpellSlots[Math.ceil(level / 2) - 1]!]) }),
    ...(progression === 'pact' && { pactSlots: tables.pactMagic.map((row) => ({ ...row })) }),
  };
}

/**
 * What a class derives from the library: its Features table's Class Features column, from its
 * features' levels and its later subclass levels; its spell list, every spell whose `classes`
 * names it plus its own `spells`; and its subclasses.
 */
export function deriveClassLinked(id: string, stats: ClassStats, entries: readonly LinkedEntry[]): LinkedClass {
  const byKey = new Map(entries.map((e) => [`${e.type}/${e.id}`, e]));
  const featureRows = LEVELS.map((level) => ({
    features: stats.features.flatMap(({ ref }) => {
      const feature = byKey.get(ref)?.stats as ClassFeatureStats | undefined;
      const at = feature?.levels.find((l) => levelOf(l) === level);
      if (at === undefined) return [];
      return [typeof at === 'number' ? { ref } : { ref, note: at.note }];
    }),
    subclass: stats.subclassLevels.slice(1).includes(level),
  }));

  const own = new Set((stats.spells ?? []).map((s) => s.ref));
  const spells = entries.filter((e) => e.type === 'spell' && ((e.stats as SpellStats).classes.some((c) => c.ref === `class/${id}`) || own.has(`spell/${e.id}`)));
  const levels = [...new Set(spells.map((e) => (e.stats as SpellStats).level))].sort((a, b) => a - b);
  const spellList = levels.map((level) => ({
    level,
    spells: spells
      .filter((e) => (e.stats as SpellStats).level === level)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e): ClassSpell => {
        const s = e.stats as SpellStats;
        return { ref: `spell/${e.id}`, school: s.school, concentration: s.duration.concentration, ritual: s.ritual, material: s.components.m?.costGp !== undefined };
      }),
  }));

  const subclasses = entries
    .filter((e) => e.type === 'subclass' && (e.stats as SubclassStats).class.ref === `class/${id}`)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => `subclass/${e.id}`);
  return { featureRows, spellList, subclasses };
}

/** A class's subclass levels ascend, and only a custom class lists `spells`. */
export function checkClass(stats: ClassStats, srd: boolean): Issue[] {
  const issues: Issue[] = [];
  const levels = stats.subclassLevels;
  if (levels.some((level, i) => i > 0 && level <= levels[i - 1]!)) {
    issues.push({ level: 'error', path: 'stats.subclassLevels', message: `subclass levels ${levels.join(', ')} must ascend` });
  }
  if (srd && stats.spells) {
    issues.push({ level: 'error', path: 'stats.spells', message: "an SRD class's spell list is derived from its spells' classes; only a custom class lists spells" });
  }
  return issues;
}

/** A feature's levels ascend. */
export function checkClassFeature(stats: ClassFeatureStats): Issue[] {
  const levels = stats.levels.map(levelOf);
  return levels.some((level, i) => i > 0 && level <= levels[i - 1]!)
    ? [{ level: 'error', path: 'stats.levels', message: `levels ${levels.join(', ')} must ascend` }]
    : [];
}

/** The first level of each listed feature whose stats are known, in list order. */
const featureLevels = (features: { ref: string }[], target: LinkTarget): { ref: string; index: number; levels: number[] }[] =>
  features.flatMap(({ ref }, index) => {
    const found = target(ref);
    return found?.type === 'class-feature' ? [{ ref, index, levels: (found.stats as ClassFeatureStats).levels.map(levelOf) }] : [];
  });

/**
 * A class's features are in level order, its first subclass level is a feature's level, and
 * (warnings) it has a level 1 feature and no empty level.
 */
export function checkClassLinks(stats: ClassStats, target: LinkTarget): Issue[] {
  const issues: Issue[] = [];
  const features = featureLevels(stats.features, target);
  for (const [i, f] of features.entries()) {
    const before = features[i - 1];
    if (before && f.levels[0]! < before.levels[0]!) {
      issues.push({ level: 'error', path: `stats.features[${f.index}]`, message: `${f.ref} at level ${f.levels[0]} is listed after ${before.ref} at level ${before.levels[0]}; features are in level order` });
    }
  }
  const first = stats.subclassLevels[0]!;
  if (!features.some((f) => f.levels[0] === first)) {
    issues.push({ level: 'error', path: 'stats.subclassLevels[0]', message: `no feature is described at level ${first}, the first subclass level; it is the level of the class's subclass feature` });
  }
  const filled = new Set([...features.flatMap((f) => f.levels), ...stats.subclassLevels]);
  if (!features.some((f) => f.levels.includes(1))) issues.push({ level: 'warning', path: 'stats.features', message: 'no feature at level 1' });
  const empty = LEVELS.filter((level) => level > 1 && !filled.has(level));
  if (empty.length > 0) issues.push({ level: 'warning', path: 'stats.features', message: `no feature or subclass level at level ${empty.join(', ')}` });
  return issues;
}

/** Each of a subclass's feature levels is one of its class's subclass levels, and each subclass level has a feature. */
export function checkSubclassLinks(stats: SubclassStats, target: LinkTarget): Issue[] {
  const parent = target(stats.class.ref);
  if (parent?.type !== 'class') return [];
  const allowed = (parent.stats as ClassStats).subclassLevels;
  const features = featureLevels(stats.features, target);
  const issues: Issue[] = [];
  for (const f of features) {
    const outside = f.levels.filter((level) => !allowed.includes(level));
    if (outside.length > 0) {
      issues.push({ level: 'error', path: `stats.features[${f.index}]`, message: `${f.ref} is at level ${outside.join(', ')}, not one of ${stats.class.ref}'s subclass levels (${allowed.join(', ')})` });
    }
  }
  if (features.length === stats.features.length) {
    const missing = allowed.filter((level) => !features.some((f) => f.levels.includes(level)));
    if (missing.length > 0) issues.push({ level: 'error', path: 'stats.features', message: `no feature at subclass level ${missing.join(', ')} of ${stats.class.ref}` });
  }
  return issues;
}
