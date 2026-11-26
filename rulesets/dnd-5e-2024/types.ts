// Shapes of dnd-5e-2024 creature stats (docs/rulesets.md#shared-definitions, docs/rulesets.md#creatures). These mirror
// schemas/creature.schema.json; the schema stage runs first, so code that
// takes these types can trust them.

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type Proficiency = 'proficient' | 'expertise';
export type Size = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

/** A link with an optional note (`Ref` in common.schema.json). */
export interface Ref {
  ref: string;
  /** A qualifier printed in parentheses after the name: "Fireball (level 5 version)". */
  note?: string;
}
export type RefOrText = Ref | string;

export interface Damage {
  /** The damage roll; omitted for flat damage, which sets `amount`. */
  dice?: string;
  /** Flat damage printed without dice ("1 Piercing damage"). */
  amount?: number;
  ability?: Ability;
  bonus?: number;
  /** The damage type; omitted when `note` says what it is. */
  type?: string;
  /** Printed after "damage" when the type isn't fixed: "of the type chosen for …". */
  note?: string;
  /** When a rider applies, such as "if the attack roll had Advantage". Riders only. */
  condition?: string;
}

export type ActionKind = 'melee-attack' | 'ranged-attack' | 'melee-or-ranged-attack' | 'save' | 'other';

export interface Action {
  name: string;
  kind: ActionKind;
  ability?: Ability;
  adjust?: number;
  reach?: number;
  range?: { normal: number; long?: number };
  /** Attack kinds only: a parenthetical after the attack bonus. */
  attackNote?: string;
  save?: { ability: Ability; targets: string };
  damage?: Damage[];
  onHit?: string;
  onFailure?: string;
  onSuccess?: string;
  /** Save kind only: the "Failure or Success:" line. */
  onFailureOrSuccess?: string;
  text?: string;
  recharge?: string;
  uses?: string;
}

export interface CreatureStats {
  size: Size[];
  creatureType: string;
  /** What generated prose calls the creature after "The"; defaults to the name's last word, lowercase. */
  shortName?: string;
  /** A swarm's member size: "tiny" reads "Medium Swarm of Tiny Beasts". */
  swarm?: Size;
  descriptors?: string[];
  alignment: string;
  ac: { value: number; note?: string };
  initiative?: { proficiency?: Proficiency; adjust?: number };
  hitDice: number;
  speed: { walk: number; fly?: number; swim?: number; climb?: number; burrow?: number; hover?: true; note?: string };
  abilities: Record<Ability, number>;
  saveProficiencies?: Ability[];
  /** A proficiency, or `{ proficiency?, adjust }` to match a bonus that doesn't derive (docs/content-model.md#srd-and-custom-entries). */
  skills?: Record<string, Proficiency | { proficiency?: Proficiency; adjust: number }>;
  vulnerabilities?: string[];
  resistances?: string[];
  immunities?: { damage?: string[]; conditions?: { ref: string; note?: string }[] };
  /** A gear ref may add a `count` of 2 or more: "Javelins (6)". */
  gear?: (string | (Ref & { count?: number }))[];
  senses?: { darkvision?: number; blindsight?: number; tremorsense?: number; truesight?: number; note?: string };
  languages: { spoken: string[]; understood?: string[]; telepathy?: number; note?: string };
  cr: number;
  lair?: true;
  traits?: Action[];
  actions?: Action[];
  bonusActions?: Action[];
  reactions?: Action[];
  legendaryActions?: { uses: number; usesInLair?: number; intro?: string; items: Action[] };
  spellcasting?: {
    ability: Ability;
    /** "Material" reads "requiring no Material components and using …". */
    noComponents?: string;
    /** The intro prints no spell save DC (docs/content-model.md#situational-fields). */
    noSaveDc?: true;
    adjust?: number;
    includeAttack?: true;
    atWill?: RefOrText[];
    perDay?: Partial<Record<'1' | '2' | '3', RefOrText[]>>;
    note?: string;
  };
}

// Shapes of dnd-5e-2024 spell and item stats (docs/rulesets.md#items, docs/rulesets.md#spells),
// mirroring schemas/spell.schema.json and schemas/item.schema.json.

export interface SpellStats {
  level: number;
  school: string;
  classes: Ref[];
  castingTime: { amount: number; unit: 'action' | 'bonus-action' | 'reaction' | 'minute' | 'hour'; trigger?: string; note?: string };
  ritual: boolean;
  range: {
    kind: 'self' | 'touch' | 'distance' | 'sight' | 'unlimited' | 'special';
    feet?: number;
    miles?: number;
    area?: { shape: string; size: number };
  };
  components: { v: boolean; s: boolean; m?: { text: string; costGp?: number; consumed?: true } };
  duration: {
    kind: 'instantaneous' | 'timed' | 'until-dispelled' | 'until-dispelled-or-triggered' | 'special';
    amount?: number;
    unit?: 'round' | 'minute' | 'hour' | 'day';
    /** A timed duration without Concentration that reads "Up to 8 hours". */
    upTo?: true;
    concentration: boolean;
  };
  effect: string;
  higherLevels?: string;
  cantripUpgrade?: string;
  statBlocks?: StatBlock[];
}

/** A named block of text in an embedded stat block: a trait or an action. */
export interface StatBlockItem {
  name: string;
  /** Markdown-subset text (docs/content-model.md#text-fields), written as printed. */
  text: string;
}

/**
 * A stat block printed inside a spell or magic item (docs/rulesets.md#embedded-stat-blocks, docs/rulesets.md#embedded-stat-blocks):
 * authored as printed, since its numbers often depend on the caster. Only the
 * ability modifiers and saves are derived.
 */
export interface StatBlock {
  name: string;
  /** Size, type, and alignment, such as "Large Dragon, Neutral". */
  typeLine: string;
  ac?: string;
  hp?: string;
  speed?: string;
  initiative?: string;
  abilities: Record<Ability, number>;
  skills?: string;
  vulnerabilities?: string;
  resistances?: string;
  immunities?: string;
  gear?: string;
  senses?: string;
  languages?: string;
  cr?: string;
  traits?: StatBlockItem[];
  actions?: StatBlockItem[];
  bonusActions?: StatBlockItem[];
  reactions?: StatBlockItem[];
}

/** Derived values of an embedded stat block: modifiers, and saves (no proficiencies, so equal to the modifiers). */
export interface DerivedStatBlock {
  abilityMods: Record<Ability, number>;
  saves: Record<Ability, number>;
}

export interface ItemSpell {
  spell: RefOrText;
  chargeCost?: number;
  /** The most charges a variable-cost casting spends; `chargeCost` is then the least. */
  maxChargeCost?: number;
  saveDc?: number;
  attackBonus?: number;
}

/** An item's base equipment (docs/rulesets.md#items): a list of items, or any of some groups. */
export type BaseItem = { oneOf: Ref[]; any?: undefined; except?: undefined } | { any: Ref[]; except?: Ref[]; oneOf?: undefined };

export interface ItemStats {
  category: string;
  baseItem?: BaseItem;
  rarity: string;
  /** Each variant's rarity, for a `varies` item (docs/rulesets.md#items). */
  rarityVariants?: { rarity: string; variant: string }[];
  attunement: { required: boolean; requirement?: string };
  charges?: { max: number | string; recharge?: string; depletion?: string };
  spells?: ItemSpell[];
  cursed?: true;
  effect: string;
  statBlocks?: StatBlock[];
  modifiers?: ItemModifier[];
}

export interface ChallengeRatingRow {
  cr: number;
  xp: number;
  /** CR 0 only: the XP when the creature deals damage (Appendix A). */
  xpWithDamage?: number;
  pb: number;
}

export interface Tables {
  challengeRatings: ChallengeRatingRow[];
  sizes: Record<Size, { hitDie: number }>;
  abilities: Ability[];
  skills: Record<string, Ability>;
  damageTypes: string[];
  creatureTypes: string[];
  /** The Ability Score Point Costs table: the budget, and the cost of each base score. */
  pointBuy: { budget: number; costs: Record<string, number> };
  /** The Character Advancement table's Proficiency Bonus, levels 1–20. */
  proficiencyBonusByLevel: number[];
  /** The Multiclass Spellcaster table: slots per spell level (1 first), levels 1–20. */
  multiclassSpellSlots: number[][];
  /** The Pact Magic slots and their level, levels 1–20, from the Warlock Features table. */
  pactMagic: { slots: number; slotLevel: number }[];
}

export interface DerivedDamage {
  modifier: number;
  average: number;
  /** For example `6 (1d8 + 2)`. */
  display: string;
}

export interface DerivedAction {
  attackBonus?: number;
  saveDc?: number;
  damage: DerivedDamage[];
}

export interface DerivedCreature {
  abilityMods: Record<Ability, number>;
  pb: number;
  xp: number;
  xpInLair?: number;
  initiative: { bonus: number; score: number };
  hp: { die: number; modifier: number; formula: string; average: number };
  saves: Record<Ability, number>;
  skills: Record<string, number>;
  passivePerception: number;
  traits: DerivedAction[];
  actions: DerivedAction[];
  bonusActions: DerivedAction[];
  reactions: DerivedAction[];
  legendaryActions: { items: DerivedAction[] };
  spellcasting?: { dc: number; attackBonus: number };
}

/** The action lists `<actionList>` in docs/rulesets.md#the-ruleset-module. */
export const ACTION_LISTS = ['traits', 'actions', 'bonusActions', 'reactions'] as const;

/** A condition's stats (schemas/condition.schema.json), a primitive's or an extension's. */
export interface ConditionStats {
  effects: { name: string; text: string }[];
}

export type CostUnit = 'cp' | 'sp' | 'ep' | 'gp' | 'pp';

export interface Cost {
  amount: number;
  unit: CostUnit;
}

/** Equipment's stats (schemas/equipment.schema.json), a primitive's or an extension's. */
export interface EquipmentStats {
  group: string;
  cost?: Cost;
  weight?: number;
  weightNote?: string;
  text?: string;
  variants?: { name: string; cost?: Cost; weight?: number; amount?: number; storage?: string }[];
  weapon?: {
    damage: { dice?: string; flat?: number; type: string };
    properties?: Ref[];
    mastery: Ref;
    range?: { normal: number; long: number };
    ammunition?: string;
    versatile?: string;
  };
  armor?: { ac: number; dex?: true; dexMax?: number; strength?: number; stealthDisadvantage?: true };
  tool?: { ability: Ability; utilize: string; craft?: string };
  mount?: { carryingCapacity: number };
  vehicle?: { speedMph: number; crew: number; passengers?: number; cargoTons?: number; ac: number; hp: number; damageThreshold?: number };
}

/** Equipment's derived values: its category (the root of its group) and its cost in gold pieces. */
export interface DerivedEquipment {
  category?: string;
  costGp?: number;
}

/** A modifier's value: a number, the proficiency bonus, or an ability's modifier (docs/rulesets.md#modifiers). */
export type ModifierValue = number | 'proficiency' | Ability;
export type ModifierWhile = 'unarmored' | 'armored' | 'no-heavy-armor' | 'no-shield';
export type ModifierWeapon = 'ranged' | 'melee' | 'one-handed-melee' | 'monk';

/** A value, or one by the level of the feature's class. */
interface Valued {
  value?: ModifierValue;
  min?: number;
  byLevel?: Record<string, number>;
  while?: ModifierWhile[];
}

/** One effect on a character's derived values, as data (common.schema.json `Modifier`). */
export type Modifier =
  | { kind: 'ability-bonus'; abilities?: Ability[]; value?: number; total?: number; from?: Ability[]; max: number }
  | { kind: 'ac-formula'; base: number; abilities?: Ability[]; while?: ModifierWhile[] }
  | ({ kind: 'ac-bonus' } & Valued)
  | { kind: 'save-proficiency'; abilities: Ability[] | 'all' }
  | ({ kind: 'save-bonus' } & Valued)
  | { kind: 'skill-proficiency'; skills: string[]; expertise?: true }
  | { kind: 'skill-floor'; proficiency: 'half' }
  | ({ kind: 'initiative-bonus' } & Valued)
  | ({ kind: 'speed-bonus' } & Valued)
  | { kind: 'speed-mode'; modes: ('climb' | 'swim' | 'fly')[]; while?: ModifierWhile[] }
  | { kind: 'hp-per-level'; value: ModifierValue; min?: number; per?: 'character' | 'class'; while?: ModifierWhile[] }
  | { kind: 'attack-ability'; abilities: Ability[]; weapon: ModifierWeapon; while?: ModifierWhile[] }
  | ({ kind: 'attack-bonus'; weapon: ModifierWeapon } & Valued)
  | ({ kind: 'damage-bonus'; weapon: ModifierWeapon } & Valued)
  | { kind: 'damage-die'; die?: string; byLevel?: Record<string, string>; weapon: ModifierWeapon; while?: ModifierWhile[] };

/** A value, or one per variant of the item (docs/rulesets.md#item-modifiers). */
interface ByVariant {
  value?: number;
  byVariant?: Record<string, number>;
}

/** One effect of an equipped item, as data (common.schema.json `ItemModifier`). With no `weapon`, an attack or damage bonus is the weapon item's own. */
export type ItemModifier =
  | ({ kind: 'ac-bonus' | 'save-bonus' | 'check-bonus'; while?: ModifierWhile[] } & ByVariant)
  | ({ kind: 'ability-set'; ability: Ability } & ByVariant)
  | ({ kind: 'attack-bonus' | 'damage-bonus'; weapon?: ModifierWeapon; while?: ModifierWhile[] } & ByVariant);

export type FeatCategory = 'origin' | 'general' | 'fighting-style' | 'epic-boon';

/** feat.schema.json (docs/rulesets.md#feats): titled `benefits` or one `text`. */
export interface FeatStats {
  category: FeatCategory;
  level?: number;
  prerequisite?: string;
  benefits?: { name: string; text: string }[];
  text?: string;
  repeatable?: string;
  modifiers?: Modifier[];
}

export interface DerivedFeat {
  /** The feat has a Repeatable paragraph. */
  repeatable: boolean;
}

/** One starting-equipment item: a counted, noted ref, or text (docs/rulesets.md#starting-equipment). */
export type StartingItem = { ref: string; count?: number; note?: string } | string;

/** One lettered option. */
export interface StartingOption {
  items?: StartingItem[];
  gp?: number;
}

/** background.schema.json (docs/rulesets.md#backgrounds). */
export interface BackgroundStats {
  abilities: Ability[];
  feat: Ref;
  skills: string[];
  tool: Ref & { choose?: true };
  equipment: StartingOption[];
}

/** species.schema.json (docs/rulesets.md#species): a page type whose traits are components. */
export interface SpeciesStats {
  creatureType: string;
  sizes: { size: Size; height: string }[];
  speed: number;
  traits: Ref[];
  intro?: string;
}

export interface DerivedSpecies {
  /** Its sizes, for the facet. */
  sizes: Size[];
}

/** species-trait.schema.json: one special trait. */
export interface SpeciesTraitStats {
  text: string;
  modifiers?: Modifier[];
}

/** class.schema.json (docs/rulesets.md#classes): a page type whose features and options are components. */
export interface ClassStats {
  primaryAbility: { abilities: Ability[]; join?: 'and' | 'or' };
  hitDie: 'd6' | 'd8' | 'd10' | 'd12';
  savingThrows: Ability[];
  skills: { choose: number; from?: string[] };
  weapons: string;
  tools?: string;
  armor: string;
  equipment: StartingOption[];
  multiclass: string;
  features: Ref[];
  subclassLevels: number[];
  columns?: { name: string; values: string[] }[];
  spellcasting?: { ability: Ability; progression: 'full' | 'half' | 'pact'; cantrips?: number[]; prepared: number[] };
  optionLists?: { name: string; text: string; options: Ref[] }[];
  spells?: Ref[];
}

/** A class's derived values from its own stats (docs/rulesets.md#classes), one per level 1–20. */
export interface DerivedClass {
  proficiencyBonus: number[];
  /** Slots per spell level (1 first) at each level, for a full or half caster. */
  spellSlots?: number[][];
  /** Pact Magic slots and their level at each level, for a pact caster. */
  pactSlots?: { slots: number; slotLevel: number }[];
}

/** One spell on a class's derived spell list. */
export interface ClassSpell {
  ref: string;
  school: string;
  concentration: boolean;
  ritual: boolean;
  /** A material component with a cost. */
  material: boolean;
}

/** A class's derived values from the library (docs/rulesets.md#classes). */
export interface LinkedClass {
  /** The Class Features column at each level 1–20: the features named there, and whether it's a later subclass level. */
  featureRows: { features: { ref: string; note?: string }[]; subclass: boolean }[];
  /** Its spell list by spell level, ascending, each level's spells by name. */
  spellList: { level: number; spells: ClassSpell[] }[];
  /** Its subclasses' keys, by name. */
  subclasses: string[];
}

/** A class feature's level in the Features table, with the note its row prints. */
export type FeatureLevel = number | { level: number; note: string };

/** class-feature.schema.json: one feature of a class or subclass. */
export interface ClassFeatureStats {
  levels: FeatureLevel[];
  text: string;
  modifiers?: Modifier[];
}

/** class-option.schema.json: one option of a class's option list. */
export interface ClassOptionStats {
  prerequisite?: string;
  cost?: string;
  text: string;
  repeatable?: string;
}

/** subclass.schema.json (docs/rulesets.md#subclasses): a page type naming its class. */
export interface SubclassStats {
  class: Ref;
  tagline: string;
  text: string;
  features: Ref[];
}

/** Increases by ability, as a background or feat places them. */
export type Increases = Partial<Record<Ability, number>>;

/** character.schema.json (docs/rulesets.md#characters): one build at one level, as refs and choices. */
export interface CharacterStats {
  species: Ref;
  background: Ref;
  /** In the order taken; the first is the starting class. */
  classes: { class: Ref; level: number; subclass?: Ref }[];
  abilities: { base: Record<Ability, number>; background: Increases };
  feats?: { ref: string; note?: string; source: { ref: string; level?: number }; abilities?: Increases }[];
  options?: Ref[];
  choices?: { source: Ref; skills?: string[]; expertise?: string[]; tools?: Ref[]; languages?: string[] }[];
  equipped?: { ref: string; base?: Ref; variant?: string; attuned?: true }[];
  spells?: Ref[];
}

/** A character's derived values from its own stats, which the index lifts for its facets. */
export interface DerivedCharacter {
  /** The total of its class levels. */
  level: number;
  proficiencyBonus: number;
  /** The point-buy cost of its base scores, or undefined when a score is outside the table. */
  pointCost?: number;
}

/** One equipped weapon's attack. */
export interface CharacterAttack {
  /** The equipped entry: equipment, or an item. */
  ref: string;
  /** The equipment it's an attack with: `ref` itself, or an item's base. */
  weapon: string;
  ability: Ability;
  attackBonus: number;
  damage: { dice?: string; flat?: number; modifier: number; type: string; display: string };
  /** The two-handed damage of a Versatile weapon. */
  versatile?: { dice: string; display: string };
  range?: { normal: number; long: number };
  properties: Ref[];
  mastery: Ref;
}

/** One class's spellcasting. */
export interface CharacterSpellcasting {
  class: string;
  ability: Ability;
  saveDc: number;
  attackBonus: number;
  /** Cantrips known and spells prepared at the class's level, from its Features table. */
  cantrips: number;
  prepared: number;
}

/** The skill, saving throw, training, tool, and language proficiencies, each with its source. */
export interface CharacterProficiencies {
  /** The starting class's saving throws. */
  saves: { source: string; abilities: Ability[] };
  /** Each skill's proficiency, with the entry it comes from: a pick's source, or a modifier's entry. */
  skills: { skill: string; source: string }[];
  expertise: { skill: string; source: string }[];
  /**
   * Weapon and armor training as each class prints it: the starting class's Core Traits, and a later
   * class's "As a Multiclass Character" text.
   */
  training: { source: string; weapons?: string; armor?: string; tools?: string; multiclass?: string }[];
  tools: { source: string; ref: string; note?: string }[];
  languages: { source: string; language: string }[];
}

/** A character's derived values from the entries it references (docs/rulesets.md#characters). */
export interface LinkedCharacter {
  scores: Record<Ability, number>;
  abilityMods: Record<Ability, number>;
  saves: Record<Ability, number>;
  /** Every skill's bonus, and its proficiency when it has one. */
  skills: Record<string, { bonus: number; proficiency?: Proficiency }>;
  passivePerception: number;
  hp: number;
  initiative: number;
  speed: number;
  /** Climb, Swim, and Fly Speeds a modifier gives, each equal to the Speed. */
  speeds?: Partial<Record<'climb' | 'swim' | 'fly', number>>;
  /** Armor Class, with the equipped armor and shield it reads. */
  ac: { value: number; armor?: string; shield?: string };
  attacks: CharacterAttack[];
  spellcasting: CharacterSpellcasting[];
  /** Slots per spell level (1 first) from the Multiclass Spellcaster table; omitted with no full or half caster level. */
  spellSlots?: number[];
  /** Pact Magic slots and their level, from a pact caster's level. */
  pactSlots?: { slots: number; slotLevel: number };
  /** The features each class, subclass, and species gives at the character's levels, by source. */
  features: { source: string; features: { ref: string; level?: number }[] }[];
  proficiencies: CharacterProficiencies;
}
