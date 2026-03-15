export interface SpellReference {
  spellId: string;
  level?: number;
  icon?: string;
}

export interface PassiveReference {
  passiveId: string;
  unlockedAtLevel?: number;
  icon?: string;
}

export interface Sublimation {
  id: string;
  name: string;
  rarity: 'classic' | 'epic' | 'relic';
  stats: Record<string, number>;
  description: string;
  icon?: string;
}

export interface SpellBar {
  spells: (SpellReference | null)[];
}

export interface PassiveBar {
  passives: (PassiveReference | null)[];
}

export interface SublimationBar {
  sublimations: (Sublimation | null)[];
}

export interface BuildStats {
  level: number;

  masteryFire: number;
  masteryWater: number;
  masteryEarth: number;
  masteryAir: number;

  masterySecondary: number;
  backMastery: number;

  dommageInflict: number;
  critRate: number;
  critMastery: number;

  resistance: number;

  ap: number;
  mp: number;
  wp: number;

  range: number;

  [key: string]: number | string;
}

export interface Build {
  id: string;
  name: string;
  classId: string;
  characterClass?: string;
  characterLevel: number;
  spellBar: SpellBar;
  passiveBar: PassiveBar;
  sublimationBar: SublimationBar;
  stats: BuildStats;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BuildComparison {
  buildA: Build;
  buildB: Build;
}

