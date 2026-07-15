import { Injectable } from '@angular/core';
import {
  HealComputationResult,
  Orientation,
  ShieldComputationResult,
  WakfuCombatCalculator
} from '../../domain/combat-resolution';
import { resolveApplicableMasterySum, ApplicableMasteryStats } from '../../domain/combat-resolution/applicable-mastery';

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

export interface EffectValueStats extends ApplicableMasteryStats {
  dommageInflict: number;
  critRate: number;
}

export interface EffectValueInput {
  effectType: 'DEAL_DAMAGE' | 'HEAL' | 'GIVE_ARMOR';
  normalBase: number;
  /** Base critique (pour DEAL_DAMAGE : ratio CRIT, qui inclut déjà le ×1.25). Absent = crit dérivé de normalBase. */
  critBase?: number;
  element?: string;
  stats: EffectValueStats;
  distanceCases: number;
  orientation: 'front' | 'side' | 'back';
}

export interface EffectValues {
  normal: number;
  crit: number;
  average: number;
}

@Injectable({
  providedIn: 'root'
})
export class DamageCalculatorService {

  private readonly calculator = new WakfuCombatCalculator();

  /**
   * Calcule les valeurs déterministes { normal, crit, average } d'un effet.
   * - Pas de tirage aléatoire.
   * - DEAL_DAMAGE avec critBase : la base CRIT inclut déjà le ×1.25 → on n'ajoute PAS le
   *   multiplicateur critique de la formule (seulement la maîtrise critique).
   * - Sans critBase (soin/bouclier) : le crit applique ×1.25 sur la base normale.
   * - Résistance / parade / barrière = 0 (stats cible non disponibles).
   * - HEAL/GIVE_ARMOR n'utilisent pas la maîtrise élémentaire (soin = maîtrise de soin ;
   *   bouclier = pas de maîtrise), uniquement le multiplicateur critique ×1.25.
   */
  computeEffectValues(input: EffectValueInput): EffectValues {
    if (input.effectType === 'DEAL_DAMAGE') {
      return this.computeDamageEffectValues(input);
    }
    return this.computeNonDamageEffectValues(input);
  }

  private computeDamageEffectValues(input: EffectValueInput): EffectValues {
    const masteryNormal = resolveApplicableMasterySum({
      element: input.element, stats: input.stats, distanceCases: input.distanceCases,
      orientation: input.orientation, isCritical: false, isHeal: false,
    });
    const masteryCrit = resolveApplicableMasterySum({
      element: input.element, stats: input.stats, distanceCases: input.distanceCases,
      orientation: input.orientation, isCritical: true, isHeal: false,
    });

    const di = input.stats.dommageInflict ?? 0;

    const normal = this.calculator.calculateDirectDamage({
      baseValue: input.normalBase,
      applicableMasterySum: masteryNormal,
      damageInflictedBonusSum: di,
      resistancePercent: 0,
      isCritical: false,
      orientation: input.orientation,
    }).value;

    const hasCritBase = typeof input.critBase === 'number';
    const crit = this.calculator.calculateDirectDamage({
      baseValue: hasCritBase ? input.critBase! : input.normalBase,
      applicableMasterySum: masteryCrit,
      damageInflictedBonusSum: di,
      resistancePercent: 0,
      // Si critBase fournie, elle inclut déjà le ×1.25 → ne pas le réappliquer.
      isCritical: !hasCritBase,
      orientation: input.orientation,
    }).value;

    return this.withAverage(normal, crit, input.stats.critRate);
  }

  private computeNonDamageEffectValues(input: EffectValueInput): EffectValues {
    if (input.effectType === 'HEAL') {
      // Le soin utilise la maîtrise de soin uniquement (pas d'élémentaire, distance, dos...).
      const mastery = input.stats.masteryHealing ?? 0;
      const normal = this.calculator.calculateDirectHeal({
        baseValue: input.normalBase,
        applicableMasterySum: mastery,
        healPerformedBonusSum: 0,
        healReceivedBonusSum: 0,
        healResistancePercent: 0,
        incurablePercent: 0,
        isCritical: false,
      }).value;
      const crit = this.calculator.calculateDirectHeal({
        baseValue: input.normalBase,
        applicableMasterySum: mastery,
        healPerformedBonusSum: 0,
        healReceivedBonusSum: 0,
        healResistancePercent: 0,
        incurablePercent: 0,
        isCritical: true,
      }).value;
      return this.withAverage(normal, crit, input.stats.critRate);
    }

    // GIVE_ARMOR : aucune maîtrise ne s'applique, seul le critique ×1.25.
    const normal = this.calculator.calculateShield({
      baseValue: input.normalBase,
      armorGivenBonusSum: 0,
      armorReceivedBonusSum: 0,
      friablePercent: 0,
      isCritical: false,
    }).value;
    const crit = this.calculator.calculateShield({
      baseValue: input.normalBase,
      armorGivenBonusSum: 0,
      armorReceivedBonusSum: 0,
      friablePercent: 0,
      isCritical: true,
    }).value;
    return this.withAverage(normal, crit, input.stats.critRate);
  }

  private withAverage(normal: number, crit: number, rawCritRate: number | undefined): EffectValues {
    const critRate = Math.min(100, Math.max(0, rawCritRate ?? 0)) / 100;
    const average = Math.round(normal * (1 - critRate) + crit * critRate);
    return { normal, crit, average };
  }

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

