/**
 * Stratégie de simulation par défaut
 * Utilisée pour les classes qui n'ont pas encore d'implémentation spécifique
 */

import { Injectable } from '@angular/core';
import { ClassSimulationStrategy, ClassValidationResult } from './class-simulation-strategy.interface';
import { Spell } from '../../models/spell.model';
import { Position, TimelineAction } from '../../models/timeline.model';
import { SimulationContext, SimulationActionResult } from '../calculators/simulation-engine.service';
import { Build } from '../../models/build.model';
import { TotalStats } from '../calculators/stats-calculator.service';

@Injectable({
  providedIn: 'root'
})
export class DefaultSimulationStrategy extends ClassSimulationStrategy {

  readonly classId = 'Default';

  validateClassSpecificCasting(
    spell: Spell,
    casterPosition: Position,
    targetPosition: Position,
    context: SimulationContext
  ): ClassValidationResult {
    // Pas de validation spécifique pour la classe par défaut
    return {
      canCast: true
    };
  }

  processClassSpecificEffects(
    spell: Spell,
    action: TimelineAction,
    context: SimulationContext,
    actionResult: SimulationActionResult
  ): void {
    // Pas d'effets spécifiques pour la classe par défaut
  }

  applyClassPassives(
    build: Build,
    baseStats: TotalStats,
    context: SimulationContext
  ): TotalStats {
    // Pas de passifs spécifiques, retourner les stats de base
    return baseStats;
  }

  isClassMechanismSpell(spellId: string): boolean {
    // Pas de mécanismes pour la classe par défaut
    return false;
  }

  executeClassMechanismSpell(
    action: TimelineAction,
    context: SimulationContext,
    spell: Spell,
    paCost: number,
    pwCost: number
  ): SimulationActionResult {
    // Pas de mécanismes pour la classe par défaut
    return {
      success: false,
      actionId: action.id || '',
      actionType: 'CastSpell',
      spellId: spell.id,
      spellName: spell.name,
      paCost,
      pwCost,
      mpCost: 0,
      message: 'No mechanism spells for default class'
    };
  }

  initializeClassContext(context: SimulationContext, build: Build): void {
    // Pas d'initialisation spécifique
  }

  cleanupTurn(context: SimulationContext): void {
    // Pas de nettoyage spécifique
  }
}

