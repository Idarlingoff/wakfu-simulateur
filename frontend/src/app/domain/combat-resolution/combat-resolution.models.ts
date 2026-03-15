export type Orientation = 'front' | 'side' | 'back';

export interface DirectDamageInput {
  baseValue: number;
  applicableMasterySum: number;
  damageInflictedBonusSum: number;
  resistancePercent?: number;
  resistanceBrut?: number;
  isCritical: boolean;
  orientation?: Orientation;
  fixedDamage?: number;
  barrier?: number;
  isParried?: boolean;
}

export interface HealInput {
  baseValue: number;
  applicableMasterySum: number;
  healPerformedBonusSum: number;
  healReceivedBonusSum: number;
  healResistancePercent: number;
  incurablePercent: number;
  isCritical: boolean;
}

export interface ShieldInput {
  baseValue: number;
  armorGivenBonusSum: number;
  armorReceivedBonusSum: number;
  friablePercent: number;
  isCritical: boolean;
  currentArmor?: number;
  maxHp?: number;
  isInvocation?: boolean;
}

export interface DamageComputationResult {
  value: number;
  breakdown: {
    baseValue: number;
    masteryMultiplier: number;
    orientationBonus: number;
    criticalMultiplier: number;
    inflictedDamageMultiplier: number;
    resistancePercentApplied: number;
    resistanceMultiplier: number;
    fixedDamage: number;
    barrier: number;
    parryCoefficient: number;
  };
}

export interface HealComputationResult {
  value: number;
  breakdown: {
    baseValue: number;
    masteryMultiplier: number;
    criticalMultiplier: number;
    healingBonusMultiplier: number;
    healResistanceMultiplier: number;
    incurableMultiplier: number;
  };
}

export interface ShieldComputationResult {
  value: number;
  uncappedValue: number;
  cappedByMaxArmor: boolean;
  maxArmorAllowed?: number;
  breakdown: {
    baseValue: number;
    criticalMultiplier: number;
    armorBonusMultiplier: number;
    friableMultiplier: number;
  };
}
