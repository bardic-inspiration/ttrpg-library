// Shapes of `stats` and derived values for elementals, mirroring its schemas.

export type Color = 'fire' | 'water' | 'earth' | 'wind';
export type Cost = Partial<Record<Color, number>>;

export interface Tables {
  life: number;
  deckSize: number;
  handSize: number;
  chipsPerColor: number;
  statStep: number;
  budgetPerChip: number;
  /** Each base element and the one it beats. */
  beats: Record<Color, Color>;
}

export interface ElementStats {
  blend?: { ref: string }[];
  text: string;
}

export interface CardStats {
  cost: Cost;
  text?: string;
}

export interface CreatureStats extends CardStats {
  power: number;
  toughness: number;
  keywords?: string[];
}

export interface CardDerived {
  /** The element's id: a base element for one color, the blend of two. Absent when no blend matches. */
  element?: string;
  totalCost: number;
  /** Base elements this card beats, and those that beat it. */
  beats: Color[];
  beatenBy: Color[];
}
