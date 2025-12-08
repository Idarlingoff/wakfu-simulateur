/**
 * Damage Calculator Service
 * Calcule les dégâts basés sur les stats du build et les effets des sorts
 * Toute la logique de calcul est gérée côté frontend
 */

import { Injectable } from '@angular/core';

export interface DamageCalculationParams {
  baseDamage: number;
  masteryPrimary: number;
  masterySecondary?: number;
  backMastery?: number;
  dommageInflict: number;
  critRate: number;
  critMastery: number;
  resistance: number;
  isCritical?: boolean;
  isBackAttack?: boolean;
  elementalMultiplier?: number;
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

  constructor() {}

  /**
   * Calcule les dégâts d'un sort
   */
  calculateDamage(params: DamageCalculationParams): DamageResult {
    // 1. Dégâts de base
    const baseDamage = params.baseDamage;

    // 2. Bonus de maîtrise
    let mastery = params.masteryPrimary;
    if (params.isBackAttack && params.backMastery) {
      mastery += params.backMastery;
    } else if (params.masterySecondary) {
      mastery += params.masterySecondary * 0.5; // Maîtrise secondaire compte pour 50%
    }
    const masteryBonus = this.calculateMasteryBonus(baseDamage, mastery);

    // 3. Bonus de dommages infligés
    const damageInflictBonus = this.calculateInflictBonus(baseDamage + masteryBonus, params.dommageInflict);

    // 4. Dégâts normaux (avant crit)
    const normalDamage = baseDamage + masteryBonus + damageInflictBonus;

    // 5. Dégâts critiques
    const critBonus = this.calculateCritBonus(normalDamage, params.critMastery);
    const criticalDamage = normalDamage + critBonus;

    // 6. Déterminer si c'est un coup critique
    const isCritical = params.isCritical ?? this.rollCritical(params.critRate);

    // 7. Bonus d'attaque de dos
    const backAttackBonus = params.isBackAttack ? normalDamage * 0.25 : 0;

    // 8. Bonus élémentaire
    const elementalBonus = params.elementalMultiplier
      ? normalDamage * (params.elementalMultiplier - 1)
      : 0;

    // 9. Réduction par résistance
    const totalDamage = isCritical ? criticalDamage : normalDamage;
    const resistanceReduction = this.calculateResistanceReduction(totalDamage, params.resistance);

    // 10. Dégâts finaux
    const finalDamage = Math.max(1, Math.round(totalDamage + backAttackBonus + elementalBonus - resistanceReduction));

    return {
      normalDamage: Math.round(normalDamage),
      criticalDamage: Math.round(criticalDamage),
      finalDamage,
      isCritical,
      breakdown: {
        baseDamage: Math.round(baseDamage),
        masteryBonus: Math.round(masteryBonus),
        damageInflictBonus: Math.round(damageInflictBonus),
        critBonus: Math.round(critBonus),
        backAttackBonus: Math.round(backAttackBonus),
        elementalBonus: Math.round(elementalBonus),
        resistanceReduction: Math.round(resistanceReduction)
      }
    };
  }

  /**
   * Calcule le bonus de maîtrise
   * Formule Wakfu: Mastery / 100 * BaseDamage
   */
  private calculateMasteryBonus(baseDamage: number, mastery: number): number {
    return (mastery / 100) * baseDamage;
  }

  /**
   * Calcule le bonus de dommages infligés
   * Formule: (DamageInflict / 100) * CurrentDamage
   */
  private calculateInflictBonus(currentDamage: number, damageInflict: number): number {
    return (damageInflict / 100) * currentDamage;
  }

  /**
   * Calcule le bonus de coup critique
   * Formule: (CritMastery / 100) * CurrentDamage
   */
  private calculateCritBonus(currentDamage: number, critMastery: number): number {
    return (critMastery / 100) * currentDamage;
  }

  /**
   * Calcule la réduction par résistance
   * Formule: (Resistance / 100) * CurrentDamage
   */
  private calculateResistanceReduction(currentDamage: number, resistance: number): number {
    return (resistance / 100) * currentDamage;
  }

  /**
   * Tire un coup critique basé sur le taux de critique
   */
  private rollCritical(critRate: number): boolean {
    return Math.random() * 100 < critRate;
  }

  /**
   * Calcule les dégâts moyens (sans RNG de critique)
   */
  calculateAverageDamage(params: DamageCalculationParams): number {
    const normalResult = this.calculateDamage({ ...params, isCritical: false });
    const critResult = this.calculateDamage({ ...params, isCritical: true });

    const critChance = params.critRate / 100;
    return Math.round(
      normalResult.finalDamage * (1 - critChance) +
      critResult.finalDamage * critChance
    );
  }

  /**
   * Calcule le DPS (Damage Per Second) basé sur les PA et le cooldown
   */
  calculateDPS(damage: number, paCost: number, cooldown: number = 0): number {
    // Assume 1 turn = 1 second pour simplification
    // DPS = Damage / (PA_Cost + Cooldown)
    const turnsPerCast = paCost + cooldown;
    return turnsPerCast > 0 ? damage / turnsPerCast : 0;
  }
}

