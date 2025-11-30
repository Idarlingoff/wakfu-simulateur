/**
 * Simulation Engine Service
 * Moteur de simulation côté frontend - gère l'exécution des timelines et calculs
 * Remplace complètement la logique backend de simulation
 */

import { Injectable, inject } from '@angular/core';
import { DamageCalculatorService, DamageCalculationParams } from './damage-calculator.service';
import { StatsCalculatorService, TotalStats } from './stats-calculator.service';
import { BoardService } from '../board.service';
import { Build } from '../../models/build.model';
import { Timeline, TimelineStep, TimelineAction } from '../../models/timeline.model';
import { Spell } from '../../models/spell.model';

export interface SimulationContext {
  availablePa: number;
  availablePw: number;
  availableMp: number;
  currentPosition?: { x: number; y: number };
  buffs?: any[];
  debuffs?: any[];
}

export interface SimulationActionResult {
  success: boolean;
  actionId: string;
  actionType: string;
  spellId?: string;
  spellName?: string;
  damage?: number;
  paCost: number;
  pwCost: number;
  mpCost: number;
  message: string;
  details?: any;
}

export interface SimulationStepResult {
  stepId: string;
  stepNumber: number;
  actions: SimulationActionResult[];
  contextAfter: SimulationContext;
  success: boolean;
}

export interface SimulationResult {
  buildId: string;
  timelineId: string;
  buildStats: TotalStats;
  initialContext: SimulationContext;
  steps: SimulationStepResult[];
  finalContext: SimulationContext;
  totalDamage: number;
  totalPaUsed: number;
  totalPwUsed: number;
  totalMpUsed: number;
  success: boolean;
  errors: string[];
}

@Injectable({
  providedIn: 'root'
})
export class SimulationEngineService {

  // Cache pour les sorts complets (sera rempli par un service externe)
  private spellsCache = new Map<string, Spell>();
  private boardService = inject(BoardService);

  constructor(
    private damageCalculator: DamageCalculatorService,
    private statsCalculator: StatsCalculatorService
  ) {}

  /**
   * Définit le cache des sorts (appelé depuis l'extérieur avec les données complètes)
   */
  setSpellsCache(spells: Spell[]): void {
    this.spellsCache.clear();
    spells.forEach(spell => this.spellsCache.set(spell.id, spell));
  }

  /**
   * Exécute une simulation complète
   */
  runSimulation(build: Build, timeline: Timeline): SimulationResult {
    // Calculer les stats totales du build
    const buildStats = this.statsCalculator.calculateTotalStats(build);

    // Créer le contexte initial
    const initialContext: SimulationContext = {
      availablePa: buildStats.ap,
      availablePw: buildStats.wp,
      availableMp: buildStats.mp,
      currentPosition: { x: 7, y: 7 }, // Position par défaut au centre
      buffs: [],
      debuffs: []
    };

    const steps: SimulationStepResult[] = [];
    const errors: string[] = [];
    let currentContext = { ...initialContext };
    let totalDamage = 0;

    // Exécuter chaque step de la timeline
    for (let i = 0; i < timeline.steps.length; i++) {
      const step = timeline.steps[i];
      const stepResult = this.executeStep(
        step,
        currentContext,
        build,
        buildStats,
        i + 1
      );

      steps.push(stepResult);
      currentContext = stepResult.contextAfter;

      // Accumuler les dégâts
      for (const action of stepResult.actions) {
        if (action.damage) {
          totalDamage += action.damage;
        }
      }

      // Si le step échoue, arrêter la simulation
      if (!stepResult.success) {
        errors.push(`Step ${i + 1} failed: ${stepResult.actions.find(a => !a.success)?.message}`);
        break;
      }
    }

    return {
      buildId: build.id || '',
      timelineId: timeline.id || '',
      buildStats,
      initialContext,
      steps,
      finalContext: currentContext,
      totalDamage,
      totalPaUsed: initialContext.availablePa - currentContext.availablePa,
      totalPwUsed: initialContext.availablePw - currentContext.availablePw,
      totalMpUsed: initialContext.availableMp - currentContext.availableMp,
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Exécute un step de la timeline
   */
  private executeStep(
    step: TimelineStep,
    context: SimulationContext,
    build: Build,
    buildStats: TotalStats,
    stepNumber: number
  ): SimulationStepResult {
    const actions: SimulationActionResult[] = [];
    let currentContext = { ...context };
    let stepSuccess = true;

    // Exécuter chaque action du step
    for (const action of step.actions) {
      const actionResult = this.executeAction(action, currentContext, build, buildStats);
      actions.push(actionResult);

      if (actionResult.success) {
        // Déduire les ressources utilisées
        currentContext.availablePa -= actionResult.paCost;
        currentContext.availablePw -= actionResult.pwCost;
        currentContext.availableMp -= actionResult.mpCost;
      } else {
        stepSuccess = false;
        break; // Arrêter le step si une action échoue
      }
    }

    return {
      stepId: step.id || `step_${stepNumber}`,
      stepNumber,
      actions,
      contextAfter: currentContext,
      success: stepSuccess
    };
  }

  /**
   * Exécute une action individuelle
   */
  private executeAction(
    action: TimelineAction,
    context: SimulationContext,
    build: Build,
    buildStats: TotalStats
  ): SimulationActionResult {
    const baseResult: SimulationActionResult = {
      success: false,
      actionId: action.id || '',
      actionType: action.type,
      paCost: 0,
      pwCost: 0,
      mpCost: 0,
      message: ''
    };

    switch (action.type) {
      case 'CastSpell':
        return this.executeCastSpell(action, context, build, buildStats);

      case 'Move':
        return this.executeMove(action, context);

      default:
        return {
          ...baseResult,
          message: `Unknown action type: ${action.type}`
        };
    }
  }

  /**
   * Exécute un sort
   */
  private executeCastSpell(
    action: TimelineAction,
    context: SimulationContext,
    build: Build,
    buildStats: TotalStats
  ): SimulationActionResult {
    // Trouver la référence du sort dans le build
    const spellRef = build.spellBar?.spells?.find(s => s && s.spellId === action.spellId);

    if (!spellRef) {
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: action.spellId,
        spellName: 'Unknown',
        paCost: 0,
        pwCost: 0,
        mpCost: 0,
        message: `Spell not found in build: ${action.spellId}`
      };
    }

    // Récupérer les données complètes du sort depuis le cache
    const spell = this.spellsCache.get(spellRef.spellId);

    if (!spell) {
      // Fallback: utiliser des valeurs par défaut si le sort n'est pas dans le cache
      console.warn(`Spell ${spellRef.spellId} not in cache, using default values`);
      return this.executeCastSpellWithDefaults(action, context, spellRef.spellId, buildStats);
    }

    const paCost = spell.paCost || 0;
    const pwCost = spell.pwCost || 0;

    // Vérifier les ressources
    if (context.availablePa < paCost) {
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: spell.id,
        spellName: spell.name,
        paCost,
        pwCost,
        mpCost: 0,
        message: `Insufficient PA (need ${paCost}, have ${context.availablePa})`
      };
    }

    if (context.availablePw < pwCost) {
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: spell.id,
        spellName: spell.name,
        paCost,
        pwCost,
        mpCost: 0,
        message: `Insufficient PW (need ${pwCost}, have ${context.availablePw})`
      };
    }

    // Calculer les dégâts (utilisez les effets du sort pour obtenir le baseDamage)
    const baseDamage = this.extractBaseDamageFromSpell(spell);

    const damageParams: DamageCalculationParams = {
      baseDamage,
      masteryPrimary: buildStats.masteryPrimary,
      masterySecondary: buildStats.masterySecondary,
      backMastery: buildStats.backMastery,
      dommageInflict: buildStats.dommageInflict,
      critRate: buildStats.critRate,
      critMastery: buildStats.critMastery,
      resistance: 0 // La résistance de l'ennemi sera ajoutée plus tard
    };

    const damageResult = this.damageCalculator.calculateDamage(damageParams);

    return {
      success: true,
      actionId: action.id || '',
      actionType: 'CastSpell',
      spellId: spell.id,
      spellName: spell.name,
      damage: damageResult.finalDamage,
      paCost,
      pwCost,
      mpCost: 0,
      message: `Cast ${spell.name} for ${damageResult.finalDamage} damage${damageResult.isCritical ? ' (CRITICAL!)' : ''}`,
      details: {
        damageBreakdown: damageResult.breakdown,
        isCritical: damageResult.isCritical
      }
    };
  }

  /**
   * Exécute un sort avec des valeurs par défaut (fallback)
   */
  private executeCastSpellWithDefaults(
    action: TimelineAction,
    context: SimulationContext,
    spellId: string,
    buildStats: TotalStats
  ): SimulationActionResult {
    const defaultPaCost = 3;
    const defaultPwCost = 0;
    const defaultBaseDamage = 100;

    if (context.availablePa < defaultPaCost) {
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId,
        spellName: spellId,
        paCost: defaultPaCost,
        pwCost: defaultPwCost,
        mpCost: 0,
        message: `Insufficient PA (need ${defaultPaCost}, have ${context.availablePa})`
      };
    }

    const damageParams: DamageCalculationParams = {
      baseDamage: defaultBaseDamage,
      masteryPrimary: buildStats.masteryPrimary,
      masterySecondary: buildStats.masterySecondary,
      backMastery: buildStats.backMastery,
      dommageInflict: buildStats.dommageInflict,
      critRate: buildStats.critRate,
      critMastery: buildStats.critMastery,
      resistance: 0
    };

    const damageResult = this.damageCalculator.calculateDamage(damageParams);

    return {
      success: true,
      actionId: action.id || '',
      actionType: 'CastSpell',
      spellId,
      spellName: spellId,
      damage: damageResult.finalDamage,
      paCost: defaultPaCost,
      pwCost: defaultPwCost,
      mpCost: 0,
      message: `Cast ${spellId} for ${damageResult.finalDamage} damage (default values)`,
      details: {
        damageBreakdown: damageResult.breakdown,
        isCritical: damageResult.isCritical
      }
    };
  }

  /**
   * Extrait les dégâts de base d'un sort
   */
  private extractBaseDamageFromSpell(spell: Spell): number {
    // Pour l'instant, utiliser une valeur par défaut
    // TODO: Analyser les effets du sort pour extraire les dégâts réels
    return 100;
  }

  /**
   * Exécute un déplacement
   */
  private executeMove(
    action: TimelineAction,
    context: SimulationContext
  ): SimulationActionResult {
    const mpCost = action.details?.['mpCost'] || 1;

    if (context.availableMp < mpCost) {
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'Move',
        paCost: 0,
        pwCost: 0,
        mpCost,
        message: `Insufficient MP (need ${mpCost}, have ${context.availableMp})`
      };
    }

    // Mettre à jour la position de l'entité sur le plateau
    if (action.targetPosition) {
      // Déterminer quelle entité déplacer
      let entityToMove;

      if (action.entityId) {
        // Si un entityId est spécifié, utiliser cette entité
        entityToMove = this.boardService.getEntity(action.entityId);
        if (!entityToMove) {
          console.error(`❌ Entité introuvable: ${action.entityId}`);
          return {
            success: false,
            actionId: action.id || '',
            actionType: 'Move',
            paCost: 0,
            pwCost: 0,
            mpCost: 0,
            message: `Entity not found: ${action.entityId}`
          };
        }
      } else {
        // Sinon, déplacer le joueur par défaut
        entityToMove = this.boardService.player();
        if (!entityToMove) {
          console.error(`❌ Aucun joueur trouvé sur le plateau`);
          return {
            success: false,
            actionId: action.id || '',
            actionType: 'Move',
            paCost: 0,
            pwCost: 0,
            mpCost: 0,
            message: 'No player found on board'
          };
        }
      }

      // Effectuer le déplacement
      this.boardService.updateEntityPosition(entityToMove.id, action.targetPosition);
      console.log(`🚶 ${entityToMove.name} déplacé vers (${action.targetPosition.x}, ${action.targetPosition.y})`);

      // Mettre à jour la direction si spécifiée
      if (action.targetFacing) {
        this.boardService.updateEntityFacing(entityToMove.id, action.targetFacing);
        console.log(`🔄 ${entityToMove.name} orienté vers ${action.targetFacing.direction}`);
      }

      return {
        success: true,
        actionId: action.id || '',
        actionType: 'Move',
        paCost: 0,
        pwCost: 0,
        mpCost,
        message: `${entityToMove.name} moved to (${action.targetPosition.x}, ${action.targetPosition.y})`
      };
    }

    return {
      success: false,
      actionId: action.id || '',
      actionType: 'Move',
      paCost: 0,
      pwCost: 0,
      mpCost: 0,
      message: 'No target position specified'
    };
  }

  /**
   * Exécute une attente de tour
   */
  private executeWaitTurn(
    action: TimelineAction
  ): SimulationActionResult {
    return {
      success: true,
      actionId: action.id || '',
      actionType: 'Move',
      paCost: 0,
      pwCost: 0,
      mpCost: 0,
      message: 'Waited for next turn'
    };
  }
}

