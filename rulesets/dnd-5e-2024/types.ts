// Shapes of dnd-5e-2024 creature stats (docs/rulesets.md#shared-definitions, docs/rulesets.md#creatures). These mirror
// schemas/creature.schema.json; the schema stage runs first, so code that
// takes these types can trust them.

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type Proficiency = 'proficient' | 'expertise';
export type Size = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

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

/** A link with an optional note (`Ref` in common.schema.json). */
export interface Ref {
  ref: string;
  note?: string;
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

export type FeatCategory = 'origin' | 'general' | 'fighting-style' | 'epic-boon';

/** feat.schema.json (docs/rulesets.md#feats): titled `benefits` or one `text`. */
export interface FeatStats {
  category: FeatCategory;
  level?: number;
  prerequisite?: string;
  benefits?: { name: string; text: string }[];
  text?: string;
  repeatable?: string;
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
