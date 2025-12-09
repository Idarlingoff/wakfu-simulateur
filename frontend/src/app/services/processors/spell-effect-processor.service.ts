/**
 * Spell Effect Processor Service
 * Traite les effets des sorts basés sur la base de données SPELL_EFFECT
 * - Applique les dégâts
 * - Applique les téléportations
 * - Applique les buffs/debuffs
 * - Gère les conditions d'application (phase, conditions, etc.)
 */

import { Injectable } from '@angular/core';
import { SpellEffect, Spell } from '../../models/spell.model';
import { Position } from '../../models/timeline.model';
import { SimulationContext } from '../calculators/simulation-engine.service';
import { TotalStats } from '../calculators/stats-calculator.service';

export interface EffectApplicationResult {
  success: boolean;
  effectType: string;
  damage?: number;
  healing?: number;
  buffsApplied?: string[];
  debuffsApplied?: string[];
  message: string;
  details?: any;
}

export type EffectPhase =
  | 'ON_CAST'           // Au moment du lancer
  | 'ON_HIT'            // Quand le sort touche
  | 'ON_END_TURN'       // À la fin du tour
  | 'ON_TARGET_TURN_START'  // Au début du tour de la cible
  | 'IMMEDIATE';        // Immédiatement

export type EffectType =
  | 'DEAL_DAMAGE'       // Infliger des dégâts
  | 'TELEPORT'          // Téléportation
  | 'REWIND_LAST_MOVE'  // Rembobinage (retour position précédente)
  | 'REFUND_AP'         // Remboursement AP
  | 'REFUND_WP'         // Remboursement WP
  | 'ADD_AP'            // Ajouter des AP
  | 'ADD_WP'            // Ajouter des WP
  | 'SUB_AP'            // Retirer des AP
  | 'SUB_WP'            // Retirer des WP
  | 'APPLY_STATUS'      // Appliquer un statut
  | 'REMOVE_STATUS'     // Retirer un statut
  | 'ADVANCE_DIAL'      // Avancer le cadran
  | 'CREATE_MECHANISM'  // Créer un mécanisme
  | 'DESTROY_MECHANISM' // Détruire un mécanisme
  | 'HEAL';             // Soigner

export type TargetScope =
  | 'SELF'              // Le lanceur
  | 'TARGET'            // La cible
  | 'AREA'              // Zone autour de la cible
  | 'LAST_MOVED'        // Dernière entité déplacée
  | 'LAST_SWAPPED'      // Dernière entité échangée (transposition)
  | 'ALL_MECHANISMS'    // Tous les mécanismes
  | 'DIAL_CELLS';       // Les cellules du cadran (heures)

@Injectable({
  providedIn: 'root'
})
export class SpellEffectProcessorService {

  /**
   * Applique tous les effets d'un sort pour une phase donnée
   */
  applySpellEffects(
    spell: Spell,
    variant: 'NORMAL' | 'CRIT',
    phase: EffectPhase,
    casterPosition: Position,
    targetPosition: Position,
    context: SimulationContext,
    stats: TotalStats
  ): EffectApplicationResult[] {
    const results: EffectApplicationResult[] = [];

    // Trouver la variante du sort (NORMAL ou CRIT)
    const spellVariant = spell.variants.find(v => v.kind === variant);

    if (!spellVariant) {
      console.warn(`Variante ${variant} introuvable pour le sort ${spell.name}`);
      return results;
    }

    // Filtrer les effets pour cette phase
    const effects = spellVariant.effects
      .filter(effect => effect.phase === phase)
      .sort((a, b) => a.ordinal - b.ordinal); // Appliquer dans l'ordre

    // Appliquer chaque effet
    for (const effect of effects) {
      // Vérifier les conditions si présentes
      if (effect.condGroup) {
        const conditionsMet = this.checkConditions(effect.condGroup, context);
        if (!conditionsMet) {
          console.log(`⏭️  Conditions non remplies pour l'effet ${effect.effect}`);
          continue;
        }
      }

      const result = this.applySingleEffect(
        effect,
        casterPosition,
        targetPosition,
        context,
        stats
      );

      results.push(result);
    }

    return results;
  }

  /**
   * Applique un effet individuel
   */
  private applySingleEffect(
    effect: SpellEffect,
    casterPosition: Position,
    targetPosition: Position,
    context: SimulationContext,
    stats: TotalStats
  ): EffectApplicationResult {
    const effectType = effect.effect as EffectType;

    switch (effectType) {
      case 'DEAL_DAMAGE':
        return this.applyDamageEffect(effect, targetPosition, stats);

      case 'HEAL':
        return this.applyHealEffect(effect, targetPosition, stats);

      case 'TELEPORT':
        return this.applyTeleportEffect(effect, casterPosition, targetPosition, context);

      case 'ADD_AP':
        return this.applyResourceEffect(effect, context, 'ap', 'add');

      case 'ADD_WP':
        return this.applyResourceEffect(effect, context, 'wp', 'add');

      case 'SUB_AP':
        return this.applyResourceEffect(effect, context, 'ap', 'sub');

      case 'SUB_WP':
        return this.applyResourceEffect(effect, context, 'wp', 'sub');

      case 'REFUND_AP':
        return this.applyRefundEffect(effect, context, 'ap');

      case 'REFUND_WP':
        return this.applyRefundEffect(effect, context, 'wp');

      case 'APPLY_STATUS':
        return this.applyStatusEffect(effect, targetPosition, context);

      case 'ADVANCE_DIAL':
        return this.applyAdvanceDialEffect(effect, context);

      default:
        console.warn(`Type d'effet non implémenté: ${effectType}`);
        return {
          success: false,
          effectType: effectType,
          message: `Type d'effet non implémenté: ${effectType}`
        };
    }
  }

  /**
   * Applique un effet de dégâts
   */
  private applyDamageEffect(
    effect: SpellEffect,
    targetPosition: Position,
    stats: TotalStats
  ): EffectApplicationResult {
    // Extraire les valeurs de dégâts
    const minDamage = effect.minValue || 0;
    const maxDamage = effect.maxValue || minDamage;
    const baseDamage = (minDamage + maxDamage) / 2;

    // TODO: Intégrer avec le DamageCalculatorService pour les calculs complets
    const finalDamage = Math.round(baseDamage);

    return {
      success: true,
      effectType: 'DEAL_DAMAGE',
      damage: finalDamage,
      message: `Inflige ${finalDamage} dégâts (${effect.element || 'neutre'})`,
      details: {
        element: effect.element,
        minDamage,
        maxDamage,
        baseDamage
      }
    };
  }

  /**
   * Applique un effet de soin
   */
  private applyHealEffect(
    effect: SpellEffect,
    targetPosition: Position,
    stats: TotalStats
  ): EffectApplicationResult {
    const minHeal = effect.minValue || 0;
    const maxHeal = effect.maxValue || minHeal;
    const healing = Math.round((minHeal + maxHeal) / 2);

    return {
      success: true,
      effectType: 'HEAL',
      healing,
      message: `Soigne ${healing} PV`,
      details: { minHeal, maxHeal }
    };
  }

  /**
   * Applique un effet de téléportation
   */
  private applyTeleportEffect(
    effect: SpellEffect,
    casterPosition: Position,
    targetPosition: Position,
    context: SimulationContext
  ): EffectApplicationResult {
    // TODO: Implémenter la logique de téléportation
    return {
      success: true,
      effectType: 'TELEPORT',
      message: `Téléportation appliquée`,
      details: { from: casterPosition, to: targetPosition }
    };
  }

  /**
   * Applique un effet de modification de ressource (AP/WP)
   */
  private applyResourceEffect(
    effect: SpellEffect,
    context: SimulationContext,
    resource: 'ap' | 'wp',
    operation: 'add' | 'sub'
  ): EffectApplicationResult {
    const amount = effect.minValue || 1;
    const resourceName = resource === 'ap' ? 'PA' : 'WP';

    if (operation === 'add') {
      if (resource === 'ap') {
        context.availablePa += amount;
      } else {
        context.availablePw += amount;
      }
      return {
        success: true,
        effectType: `ADD_${resource.toUpperCase()}` as EffectType,
        message: `+${amount} ${resourceName}`,
        details: { amount }
      };
    } else {
      if (resource === 'ap') {
        context.availablePa = Math.max(0, context.availablePa - amount);
      } else {
        context.availablePw = Math.max(0, context.availablePw - amount);
      }
      return {
        success: true,
        effectType: `SUB_${resource.toUpperCase()}` as EffectType,
        message: `-${amount} ${resourceName}`,
        details: { amount }
      };
    }
  }

  /**
   * Applique un effet de remboursement de ressource
   */
  private applyRefundEffect(
    effect: SpellEffect,
    context: SimulationContext,
    resource: 'ap' | 'wp'
  ): EffectApplicationResult {
    const amount = effect.minValue || 1;
    const resourceName = resource === 'ap' ? 'PA' : 'WP';

    if (resource === 'ap') {
      context.availablePa += amount;
    } else {
      context.availablePw += amount;
    }

    return {
      success: true,
      effectType: `REFUND_${resource.toUpperCase()}` as EffectType,
      message: `Remboursement de ${amount} ${resourceName}`,
      details: { amount }
    };
  }

  /**
   * Applique un effet de statut
   */
  private applyStatusEffect(
    effect: SpellEffect,
    targetPosition: Position,
    context: SimulationContext
  ): EffectApplicationResult {
    // TODO: Implémenter la gestion des statuts (buffs/debuffs)
    return {
      success: true,
      effectType: 'APPLY_STATUS',
      message: `Statut appliqué`,
      details: { duration: effect.duration }
    };
  }

  /**
   * Applique un effet d'avancement de cadran
   */
  private applyAdvanceDialEffect(
    effect: SpellEffect,
    context: SimulationContext
  ): EffectApplicationResult {
    const hours = effect.minValue || 1;

    // TODO: Implémenter l'avancement du cadran
    return {
      success: true,
      effectType: 'ADVANCE_DIAL',
      message: `Cadran avancé de ${hours} heure(s)`,
      details: { hours }
    };
  }

  /**
   * Vérifie si les conditions d'un effet sont remplies
   */
  private checkConditions(
    condGroup: any,
    context: SimulationContext
  ): boolean {
    // TODO: Implémenter la vérification des conditions
    // Exemples de conditions:
    // - ON_DIAL_CELL: Le lanceur est sur une case de cadran
    // - EXCHANGE_OCCURRED: Une transposition a eu lieu
    // - ONCE_PER_TURN: Une fois par tour
    return true;
  }
}

