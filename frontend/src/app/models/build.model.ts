
// Simple references for build (full data comes from spell.model and passive.model)
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
  spells: (SpellReference | null)[]; // 12 slots
}

export interface PassiveBar {
  passives: (PassiveReference | null)[]; // 6 slots with level locks
}

export interface SublimationBar {
  sublimations: (Sublimation | null)[]; // 12 slots: 10 classic + 1 epic + 1 relic
}

export interface BuildStats {
  // Character Level
  level: number;

  // Masteries
  masteryPrimary: number;      // Maîtrise principale (ex: Feu)
  masterySecondary: number;    // Maîtrise secondaire (ex: Eau)
  backMastery: number;         // Maîtrise dos

  // Damage
  dommageInflict: number;      // Dégâts infligés
  critRate: number;            // Taux de critique (%)
  critMastery: number;         // Maîtrise critique

  // Defense
  resistance: number;          // Résistance générale

  // Resources
  ap: number;                  // Action Points
  mp: number;                  // Movement Points
  wp: number;                  // Power Points (PW/Puissance)

  // Combat
  range: number;               // Portée

  // Allow additional dynamic stats
  [key: string]: number | string;
}

export interface Build {
  id: string;
  name: string;
  classId: string;
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

