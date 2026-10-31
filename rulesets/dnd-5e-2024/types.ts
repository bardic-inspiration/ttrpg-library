// Shapes of dnd-5e-2024 creature stats (SPEC.md §6.3, §6.5). These mirror
// schemas/creature.schema.json; the schema stage runs first, so code that
// takes these types can trust them.

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type Proficiency = 'proficient' | 'expertise';
export type Size = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

export interface Ref {
  ref: string;
}
export type RefOrText = Ref | string;

export interface Damage {
  dice: string;
  ability?: Ability;
  bonus?: number;
  type: string;
}

export type ActionKind = 'melee-attack' | 'ranged-attack' | 'melee-or-ranged-attack' | 'save' | 'other';

export interface Action {
  name: string;
  kind: ActionKind;
  ability?: Ability;
  adjust?: number;
  reach?: number;
  range?: { normal: number; long?: number };
  save?: { ability: Ability; targets: string };
  damage?: Damage[];
  onHit?: string;
  onFailure?: string;
  onSuccess?: string;
  text?: string;
  recharge?: string;
  uses?: string;
}

export interface CreatureStats {
  size: Size[];
  creatureType: string;
  descriptors?: string[];
  alignment: string;
  ac: { value: number; note?: string };
  initiative?: { proficiency?: Proficiency; adjust?: number };
  hitDice: number;
  speed: { walk: number; fly?: number; swim?: number; climb?: number; burrow?: number; hover?: true };
  abilities: Record<Ability, number>;
  saveProficiencies?: Ability[];
  skills?: Record<string, Proficiency>;
  vulnerabilities?: string[];
  resistances?: string[];
  immunities?: { damage?: string[]; conditions?: string[] };
  gear?: RefOrText[];
  senses?: { darkvision?: number; blindsight?: number; tremorsense?: number; truesight?: number };
  languages: { list: string[]; telepathy?: number; note?: string };
  cr: number;
  lair?: true;
  traits?: Action[];
  actions: Action[];
  bonusActions?: Action[];
  reactions?: Action[];
  legendaryActions?: { uses: number; usesInLair?: number; intro?: string; items: Action[] };
  spellcasting?: {
    ability: Ability;
    adjust?: number;
    includeAttack?: true;
    atWill?: RefOrText[];
    perDay?: Partial<Record<'1' | '2' | '3', RefOrText[]>>;
    note?: string;
  };
}

// Shapes of dnd-5e-2024 spell and magic-item stats (SPEC.md §6.6, §6.7),
// mirroring schemas/spell.schema.json and schemas/magic-item.schema.json.

export interface SpellStats {
  level: number;
  school: string;
  classes: string[];
  castingTime: { amount: number; unit: 'action' | 'bonus-action' | 'reaction' | 'minute' | 'hour'; trigger?: string };
  ritual: boolean;
  range: {
    kind: 'self' | 'touch' | 'distance' | 'sight' | 'unlimited' | 'special';
    feet?: number;
    area?: { shape: string; size: number };
  };
  components: { v: boolean; s: boolean; m?: { text: string; costGp?: number; consumed?: true } };
  duration: {
    kind: 'instantaneous' | 'timed' | 'until-dispelled' | 'special';
    amount?: number;
    unit?: 'round' | 'minute' | 'hour' | 'day';
    concentration: boolean;
  };
  effect: string;
  higherLevels?: string;
  cantripUpgrade?: string;
}

export interface MagicItemSpell {
  spell: RefOrText;
  chargeCost?: number;
  saveDc?: number;
  attackBonus?: number;
}

export interface MagicItemStats {
  category: string;
  baseItem?: string;
  rarity: string;
  attunement: { required: boolean; requirement?: string };
  charges?: { max: number; recharge: string; depletion?: string };
  spells?: MagicItemSpell[];
  cursed?: true;
  effect: string;
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
  abilityNames: Record<Ability, string>;
  skills: Record<string, Ability>;
  damageTypes: string[];
  conditions: string[];
  creatureTypes: string[];
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

/** The action lists `<actionList>` in SPEC.md §6.2. */
export const ACTION_LISTS = ['traits', 'actions', 'bonusActions', 'reactions'] as const;
