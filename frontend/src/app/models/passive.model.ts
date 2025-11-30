/**
 * Passive Model
 * Représente un passif avec ses effets de stats
 */

export interface PassiveEffect {
  id: number;
  ordinal: number;
  stat: string;
  value: number;
}

export interface Passive {
  id: string;
  classId: string;
  name: string;
  description: string;
  effects: PassiveEffect[];
  icon?: string;
  unlockedAtLevel?: number;
}

export interface PassiveWithLevel extends Passive {
  level: number;
}

