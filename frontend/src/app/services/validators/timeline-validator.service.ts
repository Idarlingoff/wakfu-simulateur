/**
 * Timeline Validator Service
 * Valide les contraintes et règles métier des timelines
 */

import { Injectable } from '@angular/core';
import { Timeline, TimelineStep, TimelineAction } from '../../models/timeline.model';
import { Build } from '../../models/build.model';
import {
  areEquivalentSpellIds,
  buildSpellReferencesWithInnates,
  canonicalizeInnateSpellId
} from '../../utils/innate-spells.utils';

export interface TimelineValidationResult {
  valid: boolean;
  errors: TimelineValidationError[];
  warnings: TimelineValidationWarning[];
}

export interface TimelineValidationError {
  stepIndex?: number;
  actionIndex?: number;
  field: string;
  message: string;
  code: string;
}

export interface TimelineValidationWarning {
  stepIndex?: number;
  actionIndex?: number;
  field: string;
  message: string;
  code: string;
}

@Injectable({
  providedIn: 'root'
})
export class TimelineValidatorService {

  constructor() {}

  /**
   * Valide une timeline complète
   */
  validateTimeline(timeline: Timeline, build?: Build): TimelineValidationResult {
    const errors: TimelineValidationError[] = [];
    const warnings: TimelineValidationWarning[] = [];

    if (!timeline.name || timeline.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Le nom de la timeline est requis',
        code: 'NAME_REQUIRED'
      });
    }

    if (!timeline.steps || timeline.steps.length === 0) {
      errors.push({
        field: 'steps',
        message: 'La timeline doit contenir au moins un step',
        code: 'NO_STEPS'
      });
      return { valid: false, errors, warnings };
    }

    for (let index = 0; index < timeline.steps.length; index++) {
      const step = timeline.steps[index];
      const stepValidation = this.validateStep(step, index, build);
      errors.push(...stepValidation.errors);
      warnings.push(...stepValidation.warnings);
    }

    const coherenceValidation = this.validateTimelineCoherence(timeline, build);
    errors.push(...coherenceValidation.errors);
    warnings.push(...coherenceValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Valide un step individuel
   */
  private validateStep(
    step: TimelineStep,
    stepIndex: number,
    build?: Build
  ): TimelineValidationResult {
    const errors: TimelineValidationError[] = [];
    const warnings: TimelineValidationWarning[] = [];

    if (!step.actions || step.actions.length === 0) {
      errors.push({
        stepIndex,
        field: 'actions',
        message: `Le step ${stepIndex + 1} ne contient aucune action`,
        code: 'NO_ACTIONS'
      });
      return { valid: false, errors, warnings };
    }

    for (let actionIndex = 0; actionIndex < step.actions.length; actionIndex++) {
      const action = step.actions[actionIndex];
      const actionValidation = this.validateAction(action, stepIndex, actionIndex, build);
      errors.push(...actionValidation.errors);
      warnings.push(...actionValidation.warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Valide une action individuelle
   */
  private validateAction(
    action: TimelineAction,
    stepIndex: number,
    actionIndex: number,
    build?: Build
  ): TimelineValidationResult {
    const errors: TimelineValidationError[] = [];
    const warnings: TimelineValidationWarning[] = [];

    if (!action.type) {
      errors.push({
        stepIndex,
        actionIndex,
        field: 'type',
        message: `L'action ${actionIndex + 1} du step ${stepIndex + 1} n'a pas de type`,
        code: 'NO_ACTION_TYPE'
      });
      return { valid: false, errors, warnings };
    }

    const validActionTypes = ['CastSpell', 'Move', 'WaitTurn', 'UseItem', 'Teleport'];
    if (!validActionTypes.includes(action.type)) {
      errors.push({
        stepIndex,
        actionIndex,
        field: 'type',
        message: `Type d'action invalide: ${action.type}`,
        code: 'INVALID_ACTION_TYPE'
      });
    }

    switch (action.type) {
      case 'CastSpell':
        this.validateCastSpellAction(action, stepIndex, actionIndex, build, errors, warnings);
        break;
      case 'Move':
        this.validateMoveAction(action, stepIndex, actionIndex, errors, warnings);
        break;
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Valide une action de cast de sort
   */
  private validateCastSpellAction(
    action: TimelineAction,
    stepIndex: number,
    actionIndex: number,
    build: Build | undefined,
    errors: TimelineValidationError[],
    warnings: TimelineValidationWarning[]
  ): void {
    if (!action.spellId) {
      errors.push({
        stepIndex,
        actionIndex,
        field: 'spellId',
        message: `L'action CastSpell du step ${stepIndex + 1} n'a pas de spellId`,
        code: 'NO_SPELL_ID'
      });
      return;
    }

    if (build?.spellBar?.spells) {
      const spellExists = buildSpellReferencesWithInnates(build).some(s => s.spellId === action.spellId);
      if (!spellExists) {
        errors.push({
          stepIndex,
          actionIndex,
          field: 'spellId',
          message: `Le sort ${action.spellId} n'existe pas dans le build`,
          code: 'SPELL_NOT_IN_BUILD'
        });
      }
    }

    if (!action.targetPosition) {
      warnings.push({
        stepIndex,
        actionIndex,
        field: 'targetPosition',
        message: `L'action CastSpell du step ${stepIndex + 1} n'a pas de position cible`,
        code: 'NO_TARGET_POSITION'
      });
    }
  }

  /**
   * Valide une action de déplacement
   */
  private validateMoveAction(
    action: TimelineAction,
    stepIndex: number,
    actionIndex: number,
    errors: TimelineValidationError[],
    warnings: TimelineValidationWarning[]
  ): void {
    if (!action.targetPosition) {
      errors.push({
        stepIndex,
        actionIndex,
        field: 'targetPosition',
        message: `L'action Move du step ${stepIndex + 1} n'a pas de position cible`,
        code: 'NO_TARGET_POSITION'
      });
    }

    if (action.targetPosition) {
      const { x, y } = action.targetPosition;
      if (x < 0 || x > 14 || y < 0 || y > 14) {
        errors.push({
          stepIndex,
          actionIndex,
          field: 'targetPosition',
          message: `Position hors limites: (${x}, ${y})`,
          code: 'POSITION_OUT_OF_BOUNDS'
        });
      }
    }
  }

  /**
   * Valide la cohérence globale de la timeline
   */
  private validateTimelineCoherence(
    timeline: Timeline,
    build?: Build
  ): TimelineValidationResult {
    const errors: TimelineValidationError[] = [];
    const warnings: TimelineValidationWarning[] = [];

    if (!build) {
      return { valid: true, errors, warnings };
    }

    const spellUsageCount = new Map<string, number>();

    // Note: Le calcul des coûts PA/PW nécessiterait les données complètes des sorts
    // (via Spell au lieu de SpellReference). Cette validation devrait être faite
    // côté composant avec accès aux données complètes.

    for (const step of timeline.steps) {
      for (const action of step.actions) {
        if (action.type === 'CastSpell' && action.spellId) {
          const spellId = canonicalizeInnateSpellId(action.spellId);
          spellUsageCount.set(spellId, (spellUsageCount.get(spellId) || 0) + 1);
        }
      }
    }

    if (build.spellBar?.spells) {
      const unusedSpells = buildSpellReferencesWithInnates(build).filter(
        spell => !spellUsageCount.has(canonicalizeInnateSpellId(spell.spellId))
      );
      if (unusedSpells.length > 0) {
        warnings.push({
          field: 'steps',
          message: `${unusedSpells.length} sort(s) du build ne sont jamais utilisés dans la timeline`,
          code: 'UNUSED_SPELLS'
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Valide qu'une timeline peut être exécutée avec un build donné
   */
  validateTimelineForBuild(timeline: Timeline, build: Build): TimelineValidationResult {
    return this.validateTimeline(timeline, build);
  }

  /**
   * Vérifie si une action est valide à un moment donné de la simulation
   * Note: Cette méthode nécessiterait les données complètes des sorts (Spell)
   * pour valider les coûts PA/PW. Actuellement limitée avec SpellReference.
   */
  isActionValidAtContext(
    action: TimelineAction,
    availablePa: number,
    availablePw: number,
    availableMp: number,
    build: Build
  ): { valid: boolean; reason?: string } {
    switch (action.type) {
      case 'CastSpell': {
        const spell = buildSpellReferencesWithInnates(build).find(s => areEquivalentSpellIds(s.spellId, action.spellId));
        if (!spell) {
          return { valid: false, reason: 'Sort non trouvé dans le build' };
        }
        // Note: SpellReference n'a pas pa/pw, cette validation nécessite
        // les données complètes du sort
        return { valid: true };
      }

      case 'Move': {
        const mpCost = action.details?.['mpCost'] || 1;
        if (availableMp < mpCost) {
          return { valid: false, reason: 'PM insuffisants' };
        }
        return { valid: true };
      }

      default:
        return { valid: true };
    }
  }
}
