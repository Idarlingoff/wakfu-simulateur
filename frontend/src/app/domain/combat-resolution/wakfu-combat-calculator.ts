import {
  DamageComputationResult,
  DirectDamageInput,
  HealComputationResult,
  HealInput,
  Orientation,
  ShieldComputationResult,
  ShieldInput
} from './combat-resolution.models';

export class WakfuCombatCalculator {
  static readonly CRITICAL_MULTIPLIER = 1.25;

  calculateDirectDamage(input: DirectDamageInput): DamageComputationResult {
    const orientationBonus = this.getOrientationBonus(input.orientation ?? 'front');
    const criticalMultiplier = input.isCritical ? WakfuCombatCalculator.CRITICAL_MULTIPLIER : 1;
    const fixedDamage = input.fixedDamage ?? 0;
    const barrier = input.barrier ?? 0;
    const parryCoefficient = input.isParried ? 0.8 : 1;

    const masteryMultiplier = 1 + input.applicableMasterySum / 100;
    const inflictedDamageMultiplier = 1 + input.damageInflictedBonusSum / 100;
    const resistancePercentApplied = this.resolveApplicableResistancePercent(input);
    const resistanceMultiplier = 1 - resistancePercentApplied / 100;

    const rawDamage =
      (((input.baseValue * masteryMultiplier) * orientationBonus * criticalMultiplier * inflictedDamageMultiplier * resistanceMultiplier) +
        fixedDamage -
        barrier) *
      parryCoefficient;

    return {
      value: Math.max(0, Math.floor(rawDamage)),
      breakdown: {
        baseValue: input.baseValue,
        masteryMultiplier,
        orientationBonus,
        criticalMultiplier,
        inflictedDamageMultiplier,
        resistancePercentApplied,
        resistanceMultiplier,
        fixedDamage,
        barrier,
        parryCoefficient
      }
    };
  }

  calculateDirectHeal(input: HealInput): HealComputationResult {
    const masteryMultiplier = 1 + input.applicableMasterySum / 100;
    const criticalMultiplier = input.isCritical ? WakfuCombatCalculator.CRITICAL_MULTIPLIER : 1;
    const healingBonusMultiplier = 1 + (input.healPerformedBonusSum + input.healReceivedBonusSum) / 100;
    const healResistanceMultiplier = 1 - this.clampPercent(input.healResistancePercent) / 100;
    const incurableMultiplier = 1 - this.clampPercent(input.incurablePercent) / 100;

    const value =
      input.baseValue *
      masteryMultiplier *
      criticalMultiplier *
      healingBonusMultiplier *
      healResistanceMultiplier *
      incurableMultiplier;

    return {
      value: Math.max(0, Math.floor(value)),
      breakdown: {
        baseValue: input.baseValue,
        masteryMultiplier,
        criticalMultiplier,
        healingBonusMultiplier,
        healResistanceMultiplier,
        incurableMultiplier
      }
    };
  }

  calculateShield(input: ShieldInput): ShieldComputationResult {
    const criticalMultiplier = input.isCritical ? WakfuCombatCalculator.CRITICAL_MULTIPLIER : 1;
    const armorBonusMultiplier = 1 + (input.armorGivenBonusSum + input.armorReceivedBonusSum) / 100;
    const friableMultiplier = 1 - this.clampPercent(input.friablePercent) / 100;

    const uncappedValue = Math.max(0, Math.floor(input.baseValue * criticalMultiplier * armorBonusMultiplier * friableMultiplier));

    if (input.maxHp === undefined) {
      return {
        value: uncappedValue,
        uncappedValue,
        cappedByMaxArmor: false,
        breakdown: {
          baseValue: input.baseValue,
          criticalMultiplier,
          armorBonusMultiplier,
          friableMultiplier
        }
      };
    }

    const currentArmor = input.currentArmor ?? 0;
    const armorCapRatio = input.isInvocation ? 1 : 0.5;
    const maxArmorAllowed = Math.floor(input.maxHp * armorCapRatio);
    const availableArmorGain = Math.max(0, maxArmorAllowed - currentArmor);
    const value = Math.min(uncappedValue, availableArmorGain);

    return {
      value,
      uncappedValue,
      cappedByMaxArmor: value < uncappedValue,
      maxArmorAllowed,
      breakdown: {
        baseValue: input.baseValue,
        criticalMultiplier,
        armorBonusMultiplier,
        friableMultiplier
      }
    };
  }

  calculateNextHealResistance(previousHealResistancePercent: number, receivedHealValue: number, targetMaxHp: number): number {
    if (targetMaxHp <= 0) {
      return this.clampPercent(previousHealResistancePercent);
    }

    const increment = (receivedHealValue / targetMaxHp) * 20;
    return this.clampPercent(previousHealResistancePercent + increment);
  }

  calculateApplicableResistancePercentFromBrut(resistanceBrut: number): number {
    const applicable = (1 - Math.pow(0.8, resistanceBrut / 100)) * 100;
    return this.clampPercent(Math.floor(applicable));
  }

  calculateBrutResistanceFromApplicablePercent(resistancePercent: number): number {
    const normalizedResistance = this.clampPercent(resistancePercent) / 100;

    if (normalizedResistance >= 1) {
      return Number.POSITIVE_INFINITY;
    }

    const brut = (100 * Math.log(1 - normalizedResistance)) / Math.log(0.8);
    return Math.ceil(brut);
  }

  private resolveApplicableResistancePercent(input: DirectDamageInput): number {
    if (typeof input.resistancePercent === 'number') {
      return this.clampPercent(input.resistancePercent);
    }

    if (typeof input.resistanceBrut === 'number') {
      return this.calculateApplicableResistancePercentFromBrut(input.resistanceBrut);
    }

    return 0;
  }

  private getOrientationBonus(orientation: Orientation): number {
    switch (orientation) {
      case 'side':
        return 1.1;
      case 'back':
        return 1.25;
      default:
        return 1;
    }
  }

  private clampPercent(value: number): number {
    return Math.min(100, Math.max(0, value));
  }
}
