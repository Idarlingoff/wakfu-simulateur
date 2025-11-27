export interface Spell {
  id: string;
  name: string;
  classId: string;
  level: number;
  range: number;
  pa: number;
  pw: number;
  description: string;
  icon?: string;
}

export interface Passive {
  id: string;
  name: string;
  classId: string;
  unlockedAtLevel: number;
  description: string;
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
  spells: (Spell | null)[]; // 12 slots
}

export interface PassiveBar {
  passives: (Passive | null)[]; // 6 slots with level locks
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

