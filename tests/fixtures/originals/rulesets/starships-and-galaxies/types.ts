// Shapes of `stats` and derived values for starships-and-galaxies, mirroring its schemas.

export type Station = 'helm' | 'engineering' | 'gunnery' | 'science' | 'comms';
export type System = 'engines' | 'shields' | 'weapons' | 'sensors' | 'comms';
export type Difficulty = 'routine' | 'hard' | 'severe' | 'extreme';
export type ShipSize = 'scout' | 'frigate' | 'cruiser' | 'carrier';
export type BodyKind = 'star' | 'planet' | 'moon' | 'asteroid-field';

export interface Tables {
  skill: { min: number; max: number };
  checkMultiplier: number;
  difficulty: Record<Difficulty, number>;
  difficultyOrder: Difficulty[];
  shipSize: Record<ShipSize, { crew: number; hull: number; systemPoints: number }>;
  resaleRate: number;
  creditStep: number;
}

export interface CreatureStats {
  species: string;
  skills: Record<Station, number>;
  upkeep: number;
}

export interface ShipStats {
  size: ShipSize;
  systems: Record<System, number>;
  cargo: number;
  fuel: number;
  price: number;
}

export interface ItemStats {
  kind: 'upgrade' | 'trade-good';
  value: number;
  upgrade?: { system: System; bonus: number };
  text: string;
}

export interface Hazard {
  name: string;
  kind: 'environmental' | 'hostile';
  station?: { ref: string };
  ship?: { ref: string };
  difficulty: Difficulty;
  damage?: number;
  text: string;
}

export interface CelestialBodyStats {
  kind: BodyKind;
  orbits?: { ref: string };
  services?: ('trade' | 'refuel' | 'discovery')[];
  hazards?: Hazard[];
  text: string;
}
