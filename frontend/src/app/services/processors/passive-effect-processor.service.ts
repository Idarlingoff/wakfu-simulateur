/**
 * Passive Effect Processor Service
 * Traite les effets des passifs basés sur la base de données PASSIVE_EFFECT
 * - Applique les bonus de stats
 * - Gère les effets passifs permanents
 * - Calcule les bonus conditionnels
 */

import { Injectable } from '@angular/core';
import { Passive, PassiveEffect } from '../../models/passive.model';
import { TotalStats } from '../calculators/stats-calculator.service';

export interface PassiveApplicationResult {
  passiveId: string;
  passiveName: string;
  effectsApplied: {
    stat: string;
    value: number;
  }[];
  success: boolean;
}

/**
 * Types de stats modifiables par les passifs
 */
export type PassiveStatType =
  | 'HP'                    // Points de vie
  | 'AP'                    // Points d'action
  | 'MP'                    // Points de mouvement
  | 'WP'                    // Points de Wakfu
  | 'MASTERY_FIRE'          // Maîtrise Feu
  | 'MASTERY_WATER'         // Maîtrise Eau
  | 'MASTERY_EARTH'         // Maîtrise Terre
  | 'MASTERY_AIR'           // Maîtrise Air
  | 'MASTERY_ELEMENTARY'    // Maîtrise Élémentaire (tous éléments)
  | 'CRITICAL_HIT'          // Coup Critique
  | 'CRITICAL_MASTERY'      // Maîtrise Critique
  | 'BACK_MASTERY'          // Maîtrise Dos
  | 'HEALING_MASTERY'       // Maîtrise Soin
  | 'BERSERK_MASTERY'       // Maîtrise Berserk
  | 'MELEE_MASTERY'         // Maîtrise Mêlée
  | 'DISTANCE_MASTERY'      // Maîtrise Distance
  | 'SINGLE_TARGET_MASTERY' // Maîtrise Monocible
  | 'AREA_MASTERY'          // Maîtrise Zone
  | 'DODGE'                 // Esquive
  | 'LOCK'                  // Tacle
  | 'INITIATIVE'            // Initiative
  | 'RANGE'                 // Portée
  | 'CONTROL'               // Contrôle
  | 'DAMAGE_INFLICTED'      // Dommages Infligés
  | 'RESISTANCE_FIRE'       // Résistance Feu
  | 'RESISTANCE_WATER'      // Résistance Eau
  | 'RESISTANCE_EARTH'      // Résistance Terre
  | 'RESISTANCE_AIR'        // Résistance Air
  | 'RESISTANCE_ELEMENTARY' // Résistance Élémentaire
  | 'CRITICAL_RESISTANCE';  // Résistance Critique

@Injectable({
  providedIn: 'root'
})
export class PassiveEffectProcessorService {

  /**
   * Applique tous les effets d'un passif sur les stats
   */
  applyPassiveEffects(
    passive: Passive,
    baseStats: TotalStats
  ): PassiveApplicationResult {
    const effectsApplied: { stat: string; value: number }[] = [];

    // Parcourir tous les effets du passif
    for (const effect of passive.effects) {
      this.applySinglePassiveEffect(effect, baseStats);
      effectsApplied.push({
        stat: effect.stat,
        value: effect.value
      });
    }

    return {
      passiveId: passive.id,
      passiveName: passive.name,
      effectsApplied,
      success: true
    };
  }

  /**
   * Applique un effet de passif individuel
   */
  private applySinglePassiveEffect(
    effect: PassiveEffect,
    stats: TotalStats
  ): void {
    const statType = effect.stat as PassiveStatType;
    const value = effect.value;

    switch (statType) {
      case 'HP':
        stats.hp = (stats.hp || 0) + value;
        break;

      case 'AP':
        stats.ap += value;
        break;

      case 'MP':
        stats.mp += value;
        break;

      case 'WP':
        stats.wp += value;
        break;

      case 'MASTERY_FIRE':
        stats.masteryFire = (stats.masteryFire || 0) + value;
        break;

      case 'MASTERY_WATER':
        stats.masteryWater = (stats.masteryWater || 0) + value;
        break;

      case 'MASTERY_EARTH':
        stats.masteryEarth = (stats.masteryEarth || 0) + value;
        break;

      case 'MASTERY_AIR':
        stats.masteryAir = (stats.masteryAir || 0) + value;
        break;

      case 'MASTERY_ELEMENTARY':
        // Applique à tous les éléments
        stats.masteryFire = (stats.masteryFire || 0) + value;
        stats.masteryWater = (stats.masteryWater || 0) + value;
        stats.masteryEarth = (stats.masteryEarth || 0) + value;
        stats.masteryAir = (stats.masteryAir || 0) + value;
        break;

      case 'CRITICAL_HIT':
        stats.critRate += value;
        break;

      case 'CRITICAL_MASTERY':
        stats.critMastery += value;
        break;

      case 'BACK_MASTERY':
        stats.backMastery += value;
        break;

      case 'HEALING_MASTERY':
        stats.healingMastery = (stats.healingMastery || 0) + value;
        break;

      case 'BERSERK_MASTERY':
        stats.berserkMastery = (stats.berserkMastery || 0) + value;
        break;

      case 'MELEE_MASTERY':
        stats.meleeMastery = (stats.meleeMastery || 0) + value;
        break;

      case 'DISTANCE_MASTERY':
        stats.distanceMastery = (stats.distanceMastery || 0) + value;
        break;

      case 'SINGLE_TARGET_MASTERY':
        stats.singleTargetMastery = (stats.singleTargetMastery || 0) + value;
        break;

      case 'AREA_MASTERY':
        stats.areaMastery = (stats.areaMastery || 0) + value;
        break;

      case 'DODGE':
        stats.dodge = (stats.dodge || 0) + value;
        break;

      case 'LOCK':
        stats.lock = (stats.lock || 0) + value;
        break;

      case 'INITIATIVE':
        stats.initiative = (stats.initiative || 0) + value;
        break;

      case 'RANGE':
        stats.range += value;
        break;

      case 'CONTROL':
        stats.control = (stats.control || 0) + value;
        break;

      case 'DAMAGE_INFLICTED':
        stats.dommageInflict += value;
        break;

      case 'RESISTANCE_FIRE':
        stats.resistanceFire = (stats.resistanceFire || 0) + value;
        break;

      case 'RESISTANCE_WATER':
        stats.resistanceWater = (stats.resistanceWater || 0) + value;
        break;

      case 'RESISTANCE_EARTH':
        stats.resistanceEarth = (stats.resistanceEarth || 0) + value;
        break;

      case 'RESISTANCE_AIR':
        stats.resistanceAir = (stats.resistanceAir || 0) + value;
        break;

      case 'RESISTANCE_ELEMENTARY':
        // Applique à toutes les résistances
        stats.resistanceFire = (stats.resistanceFire || 0) + value;
        stats.resistanceWater = (stats.resistanceWater || 0) + value;
        stats.resistanceEarth = (stats.resistanceEarth || 0) + value;
        stats.resistanceAir = (stats.resistanceAir || 0) + value;
        break;

      case 'CRITICAL_RESISTANCE':
        stats.critResistance = (stats.critResistance || 0) + value;
        break;

      default:
        console.warn(`Type de stat de passif inconnu: ${statType}`);
    }
  }

  /**
   * Applique tous les passifs d'un build
   */
  applyAllPassives(
    passives: Passive[],
    baseStats: TotalStats
  ): PassiveApplicationResult[] {
    const results: PassiveApplicationResult[] = [];

    for (const passive of passives) {
      const result = this.applyPassiveEffects(passive, baseStats);
      results.push(result);
    }

    return results;
  }

  /**
   * Calcule le bonus total d'une stat spécifique depuis une liste de passifs
   */
  calculateStatBonus(
    passives: Passive[],
    statType: PassiveStatType
  ): number {
    let total = 0;

    for (const passive of passives) {
      for (const effect of passive.effects) {
        if (effect.stat === statType) {
          total += effect.value;
        }
      }
    }

    return total;
  }

  /**
   * Obtient la description des effets d'un passif
   */
  getPassiveEffectsDescription(passive: Passive): string {
    const descriptions = passive.effects.map(effect => {
      const value = effect.value >= 0 ? `+${effect.value}` : `${effect.value}`;
      return `${value} ${this.getStatDisplayName(effect.stat)}`;
    });

    return descriptions.join(', ');
  }

  /**
   * Obtient le nom d'affichage d'une stat
   */
  private getStatDisplayName(stat: string): string {
    const displayNames: Record<string, string> = {
      HP: 'PV',
      AP: 'PA',
      MP: 'PM',
      WP: 'PW',
      MASTERY_FIRE: 'Maîtrise Feu',
      MASTERY_WATER: 'Maîtrise Eau',
      MASTERY_EARTH: 'Maîtrise Terre',
      MASTERY_AIR: 'Maîtrise Air',
      MASTERY_ELEMENTARY: 'Maîtrise Élémentaire',
      CRITICAL_HIT: 'Coup Critique',
      CRITICAL_MASTERY: 'Maîtrise Critique',
      BACK_MASTERY: 'Maîtrise Dos',
      HEALING_MASTERY: 'Maîtrise Soin',
      BERSERK_MASTERY: 'Maîtrise Berserk',
      MELEE_MASTERY: 'Maîtrise Mêlée',
      DISTANCE_MASTERY: 'Maîtrise Distance',
      SINGLE_TARGET_MASTERY: 'Maîtrise Monocible',
      AREA_MASTERY: 'Maîtrise Zone',
      DODGE: 'Esquive',
      LOCK: 'Tacle',
      INITIATIVE: 'Initiative',
      RANGE: 'Portée',
      CONTROL: 'Contrôle',
      DAMAGE_INFLICTED: 'Dommages Infligés',
      RESISTANCE_FIRE: 'Résistance Feu',
      RESISTANCE_WATER: 'Résistance Eau',
      RESISTANCE_EARTH: 'Résistance Terre',
      RESISTANCE_AIR: 'Résistance Air',
      RESISTANCE_ELEMENTARY: 'Résistance Élémentaire',
      CRITICAL_RESISTANCE: 'Résistance Critique'
    };

    return displayNames[stat] || stat;
  }
}

