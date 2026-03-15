import { Injectable } from '@angular/core';
import {
  HealComputationResult,
  Orientation,
  ShieldComputationResult,
  WakfuCombatCalculator
} from '../../domain/combat-resolution';

export interface DamageCalculationParams {
  baseDamage: number;
  masteryElemental: number;
  masterySecondary?: number;
  backMastery?: number;
  dommageInflict: number;
  critRate: number;
  critMastery: number;
  resistance: number;
  isCritical?: boolean;
  isBackAttack?: boolean;
  elementalMultiplier?: number;
  masteryApplicableSum?: number;
  orientation?: Orientation;
  fixedDamage?: number;
  barrier?: number;
  isParried?: boolean;
  resistanceBrut?: number;
}

export interface HealCalculationParams {
  baseHeal: number;
  masteryApplicableSum: number;
  healPerformedBonusSum?: number;
  healReceivedBonusSum?: number;
  healResistancePercent?: number;
  incurablePercent?: number;
  critRate?: number;
  isCritical?: boolean;
}

export interface ShieldCalculationParams {
  baseShield: number;
  armorGivenBonusSum?: number;
  armorReceivedBonusSum?: number;
  friablePercent?: number;
  critRate?: number;
  isCritical?: boolean;
  currentArmor?: number;
  maxHp?: number;
  isInvocation?: boolean;
}

export interface DamageResult {
  normalDamage: number;
  criticalDamage: number;
  finalDamage: number;
  isCritical: boolean;
  breakdown: {
    baseDamage: number;
    masteryBonus: number;
    damageInflictBonus: number;
    critBonus: number;
    backAttackBonus: number;
    elementalBonus: number;
    resistanceReduction: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class DamageCalculatorService {

  private readonly calculator = new WakfuCombatCalculator();

  calculateDamage(params: DamageCalculationParams): DamageResult {
    const isCritical = params.isCritical ?? this.rollCritical(params.critRate);

    const normalComputation = this.computeDamage(params, false);
    const criticalComputation = this.computeDamage(params, true);
    const finalComputation = isCritical ? criticalComputation : normalComputation;

    const baseDamage = params.baseDamage;
    const masteryBonus = Math.max(0, Math.round(baseDamage * (finalComputation.breakdown.masteryMultiplier - 1)));
    const damageInflictBonus = Math.max(
      0,
      Math.round(
        baseDamage *
        finalComputation.breakdown.masteryMultiplier *
        (finalComputation.breakdown.inflictedDamageMultiplier - 1)
      )
    );
    const critBonus = Math.max(
      0,
      Math.round(
        baseDamage *
        finalComputation.breakdown.masteryMultiplier *
        finalComputation.breakdown.inflictedDamageMultiplier *
        (finalComputation.breakdown.criticalMultiplier - 1)
      )
    );

    return {
      normalDamage: normalComputation.value,
      criticalDamage: criticalComputation.value,
      finalDamage: finalComputation.value,
      isCritical,
      breakdown: {
        baseDamage: Math.round(baseDamage),
        masteryBonus,
        damageInflictBonus,
        critBonus,
        backAttackBonus: finalComputation.breakdown.orientationBonus > 1 ? Math.round(baseDamage * (finalComputation.breakdown.orientationBonus - 1)) : 0,
        elementalBonus: 0,
        resistanceReduction: Math.round(
          baseDamage *
          finalComputation.breakdown.masteryMultiplier *
          finalComputation.breakdown.inflictedDamageMultiplier *
          (1 - finalComputation.breakdown.resistanceMultiplier)
        )
      }
    };
  }

  calculateDirectHeal(params: HealCalculationParams): HealComputationResult {
    const isCritical = params.isCritical ?? this.rollCritical(params.critRate ?? 0);

    return this.calculator.calculateDirectHeal({
      baseValue: params.baseHeal,
      applicableMasterySum: params.masteryApplicableSum,
      healPerformedBonusSum: params.healPerformedBonusSum ?? 0,
      healReceivedBonusSum: params.healReceivedBonusSum ?? 0,
      healResistancePercent: params.healResistancePercent ?? 0,
      incurablePercent: params.incurablePercent ?? 0,
      isCritical
    });
  }

  calculateShield(params: ShieldCalculationParams): ShieldComputationResult {
    const isCritical = params.isCritical ?? this.rollCritical(params.critRate ?? 0);
    return this.calculator.calculateShield({
      baseValue: params.baseShield,
      armorGivenBonusSum: params.armorGivenBonusSum ?? 0,
      armorReceivedBonusSum: params.armorReceivedBonusSum ?? 0,
      friablePercent: params.friablePercent ?? 0,
      isCritical,
      currentArmor: params.currentArmor,
      maxHp: params.maxHp,
      isInvocation: params.isInvocation
    });
  }

  calculateNextHealResistance(previousHealResistancePercent: number, receivedHealValue: number, targetMaxHp: number): number {
    return this.calculator.calculateNextHealResistance(previousHealResistancePercent, receivedHealValue, targetMaxHp);
  }

  calculateAverageDamage(params: DamageCalculationParams): number {
    const normalResult = this.calculateDamage({ ...params, isCritical: false });
    const critResult = this.calculateDamage({ ...params, isCritical: true });

    const critChance = (params.critRate ?? 0) / 100;
    return Math.round(normalResult.finalDamage * (1 - critChance) + critResult.finalDamage * critChance);
  }

  private computeDamage(params: DamageCalculationParams, isCritical: boolean) {
    const masteryApplicableSum =
      params.masteryApplicableSum ??
      this.deriveLegacyMastery(params, isCritical);

    const orientation = params.orientation ?? (params.isBackAttack ? 'back' : 'front');

    return this.calculator.calculateDirectDamage({
      baseValue: params.baseDamage,
      applicableMasterySum: masteryApplicableSum,
      damageInflictedBonusSum: params.dommageInflict,
      resistancePercent: params.resistance,
      resistanceBrut: params.resistanceBrut,
      isCritical,
      orientation,
      fixedDamage: params.fixedDamage,
      barrier: params.barrier,
      isParried: params.isParried
    });
  }

  private deriveLegacyMastery(params: DamageCalculationParams, isCritical: boolean): number {
    let mastery = params.masteryElemental + (params.masterySecondary ?? 0);

    if (params.isBackAttack) {
      mastery += params.backMastery ?? 0;
    }

    if (isCritical) {
      mastery += params.critMastery ?? 0;
    }

    return mastery;
  }

  private rollCritical(critRate: number): boolean {
    return Math.random() * 100 < critRate;
  }
}

