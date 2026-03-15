/**
 * Stats Calculator Service
 * Calcule les statistiques totales d'un build (équipements + passifs + sublimations)
 */

import { Injectable } from '@angular/core';
import { Build } from '../../models/build.model';
import { getHighestElementalMastery } from '../../utils/mastery-utils';

export interface TotalStats {
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
  hp?: number;
  armor?: number;
  dodge?: number;
  lock?: number;
  initiative?: number;
  control?: number;
  block?: number;
  healingMastery?: number;
  berserkMastery?: number;
  meleeMastery?: number;
  distanceMastery?: number;
  singleTargetMastery?: number;
  areaMastery?: number;
  resistanceFire?: number;
  resistanceWater?: number;
  resistanceEarth?: number;
  resistanceAir?: number;
  critResistance?: number;
}

@Injectable({
  providedIn: 'root'
})
export class StatsCalculatorService {

  constructor() {}

  /**
   * Calcule les stats totales d'un build
   */
  calculateTotalStats(build: Build): TotalStats {
    const baseStats = build.stats || this.getDefaultStats();

    const total: TotalStats = { ...baseStats };

    if (build.passiveBar?.passives) {
      for (const passive of build.passiveBar.passives) {
        if (passive) {
          this.applyPassiveStats(total, passive);
        }
      }
    }

    if (build.sublimationBar?.sublimations) {
      for (const sublimation of build.sublimationBar.sublimations) {
        if (sublimation) {
          this.applySublimationStats(total, sublimation);
        }
      }
    }

    return total;
  }

  private applyPassiveStats(total: TotalStats, passive: any): void {
    if (passive.stats) {
      this.mergeStats(total, passive.stats);
    }
  }

  private applySublimationStats(total: TotalStats, sublimation: any): void {
    if (sublimation.stats) {
      this.mergeStats(total, sublimation.stats);
    }
  }

  private mergeStats(total: TotalStats, additionalStats: Record<string, number>): void {
    for (const [key, value] of Object.entries(additionalStats)) {
      if (key in total) {
        (total as any)[key] = ((total as any)[key] || 0) + value;
      }
    }
  }

  private getDefaultStats(): TotalStats {
    return {
      level: 1,
      masteryFire: 0,
      masteryWater: 0,
      masteryEarth: 0,
      masteryAir: 0,
      masterySecondary: 0,
      backMastery: 0,
      dommageInflict: 0,
      critRate: 0,
      critMastery: 0,
      resistance: 0,
      ap: 6,
      mp: 3,
      wp: 6,
      range: 0
    };
  }

  /**
   * Calcule les stats effectives en combat (avec buffs temporaires)
   */
  calculateEffectiveStats(baseStats: TotalStats, buffs: any[] = []): TotalStats {
    const effective = { ...baseStats };

    for (const buff of buffs) {
      if (buff.stats) {
        this.mergeStats(effective, buff.stats);
      }
    }

    return effective;
  }

  validateStats(stats: TotalStats): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (stats.ap < 0) errors.push('Les PA ne peuvent pas être négatifs');
    if (stats.mp < 0) errors.push('Les PM ne peuvent pas être négatifs');
    if (stats.wp < 0) errors.push('Les PW ne peuvent pas être négatifs');
    if (stats.critRate > 100) errors.push('Le taux de critique ne peut pas dépasser 100%');
    if (stats.critRate < 0) errors.push('Le taux de critique ne peut pas être négatif');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Compare deux builds et retourne les différences de stats
   */
  compareBuilds(build1: Build, build2: Build): Record<string, number> {
    const stats1 = this.calculateTotalStats(build1);
    const stats2 = this.calculateTotalStats(build2);
    const differences: Record<string, number> = {};

    for (const key of Object.keys(stats1)) {
      const diff = (stats2 as any)[key] - (stats1 as any)[key];
      if (diff !== 0) {
        differences[key] = diff;
      }
    }

    return differences;
  }

  /**
   * Calcule un score global du build (pour comparaison)
   */
  calculateBuildScore(stats: TotalStats): number {
    return (
      getHighestElementalMastery(stats) * 1.0 +
      stats.masterySecondary * 0.5 +
      stats.dommageInflict * 0.8 +
      stats.critRate * 0.5 +
      stats.critMastery * 0.5 +
      stats.ap * 100 +
      stats.wp * 50 +
      stats.range * 20
    );
  }
}

