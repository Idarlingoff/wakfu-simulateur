/**
 * Spell Model
 * Représente un sort avec tous ses effets et variantes
 */

export interface SpellEffect {
  id: number;
  ordinal: number;
  element?: string;
  effect: string;
  targetScope: string;
  durationType?: string;
  duration?: number;
  phase?: string;
  cooldown?: number;
  minValue?: number;
  maxValue?: number;
  extendedData?: any;
  condGroup?: EffectConditionGroup;
}

export interface EffectConditionGroup {
  id: number;
  operator: string;
  conditions: EffectCondition[];
}

export interface EffectCondition {
  id: number;
  code: string;
  data?: any;
}

export interface SpellVariant {
  id: number;
  kind: string;
  effects: SpellEffect[];
}

export interface SpellRatioBreakpoint {
  id: number;
  threshold: number;
  ratio: number;
}

export interface Spell {
  id: string;
  classId: string;
  name: string;
  element?: string;
  spellType: string;
  paCost: number;
  pwCost: number;
  poMin: number;
  poMax: number;
  poModifiable: boolean;
  lineOfSight: boolean;
  cooldown: number;
  usePerTurn: number;
  usePerTarget: number;
  direction: string;
  ratioEvalMode: string;
  variants: SpellVariant[];
  breakpoints: SpellRatioBreakpoint[];
  icon?: string;
  description?: string;
}

export interface SpellWithLevel extends Spell {
  level: number;
}

