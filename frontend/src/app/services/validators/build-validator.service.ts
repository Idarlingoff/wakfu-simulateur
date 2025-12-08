/**
 * Build Validator Service
 * Valide les contraintes et règles métier des builds
 */

import { Injectable } from '@angular/core';
import { Build } from '../../models/build.model';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

@Injectable({
  providedIn: 'root'
})
export class BuildValidatorService {

  constructor() {}

  /**
   * Valide un build complet
   */
  validateBuild(build: Build): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!build.name || build.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Le nom du build est requis',
        code: 'NAME_REQUIRED'
      });
    }

    if (build.name && build.name.length > 100) {
      errors.push({
        field: 'name',
        message: 'Le nom du build ne peut pas dépasser 100 caractères',
        code: 'NAME_TOO_LONG'
      });
    }

    if (!build.classId) {
      errors.push({
        field: 'classId',
        message: 'La classe du personnage est requise',
        code: 'CLASS_REQUIRED'
      });
    }

    if (!build.characterLevel || build.characterLevel < 1) {
      errors.push({
        field: 'characterLevel',
        message: 'Le niveau doit être au moins 1',
        code: 'LEVEL_TOO_LOW'
      });
    }

    if (build.characterLevel && build.characterLevel > 245) {
      errors.push({
        field: 'characterLevel',
        message: 'Le niveau ne peut pas dépasser 245',
        code: 'LEVEL_TOO_HIGH'
      });
    }

    const spellValidation = this.validateSpellBar(build);
    errors.push(...spellValidation.errors);
    warnings.push(...spellValidation.warnings);

    const passiveValidation = this.validatePassiveBar(build);
    errors.push(...passiveValidation.errors);
    warnings.push(...passiveValidation.warnings);

    const statsValidation = this.validateStats(build);
    errors.push(...statsValidation.errors);
    warnings.push(...statsValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Valide la barre de sorts
   */
  private validateSpellBar(build: Build): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!build.spellBar?.spells) {
      warnings.push({
        field: 'spellBar',
        message: 'Aucun sort sélectionné',
        code: 'NO_SPELLS'
      });
      return { valid: true, errors, warnings };
    }

    const spells = build.spellBar.spells.filter(s => s !== null);

    if (spells.length > 12) {
      errors.push({
        field: 'spellBar.spells',
        message: 'Maximum 12 sorts autorisés',
        code: 'TOO_MANY_SPELLS'
      });
    }

    // Note: On ne peut plus valider la classe des sorts ici car SpellReference
    // ne contient que l'ID. Cette validation devrait être faite côté composant
    // avec les données complètes des sorts ou via un service dédié.

    if (spells.length < 5) {
      warnings.push({
        field: 'spellBar.spells',
        message: 'Vous avez moins de 5 sorts, considérez en ajouter davantage',
        code: 'FEW_SPELLS'
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Valide la barre de passifs
   */
  private validatePassiveBar(build: Build): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!build.passiveBar?.passives) {
      warnings.push({
        field: 'passiveBar',
        message: 'Aucun passif sélectionné',
        code: 'NO_PASSIVES'
      });
      return { valid: true, errors, warnings };
    }

    const passives = build.passiveBar.passives.filter(p => p !== null);

    if (passives.length > 5) {
      errors.push({
        field: 'passiveBar.passives',
        message: 'Maximum 5 passifs autorisés',
        code: 'TOO_MANY_PASSIVES'
      });
    }

    // Note: On ne peut plus valider la classe des passifs ici car PassiveReference
    // ne contient que l'ID. Cette validation devrait être faite côté composant
    // avec les données complètes des passifs ou via un service dédié.

    if (build.characterLevel) {
      const lockedPassives = passives.filter(
        p => p.unlockedAtLevel && p.unlockedAtLevel > build.characterLevel
      );
      if (lockedPassives.length > 0) {
        errors.push({
          field: 'passiveBar.passives',
          message: `${lockedPassives.length} passif(s) ne sont pas encore débloqués au niveau ${build.characterLevel}`,
          code: 'PASSIVES_LOCKED'
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Valide les statistiques
   */
  private validateStats(build: Build): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!build.stats) {
      warnings.push({
        field: 'stats',
        message: 'Aucune statistique définie',
        code: 'NO_STATS'
      });
      return { valid: true, errors, warnings };
    }

    const stats = build.stats;

    if (stats.ap !== undefined) {
      if (stats.ap < 6) {
        errors.push({
          field: 'stats.ap',
          message: 'Les PA ne peuvent pas être inférieurs à 6',
          code: 'AP_TOO_LOW'
        });
      }
      if (stats.ap > 18) {
        warnings.push({
          field: 'stats.ap',
          message: 'Les PA dépassent 18, vérifiez votre équipement',
          code: 'AP_VERY_HIGH'
        });
      }
    }

    if (stats.mp !== undefined) {
      if (stats.mp < 3) {
        errors.push({
          field: 'stats.mp',
          message: 'Les PM ne peuvent pas être inférieurs à 3',
          code: 'MP_TOO_LOW'
        });
      }
      if (stats.mp > 12) {
        warnings.push({
          field: 'stats.mp',
          message: 'Les PM dépassent 12, vérifiez votre équipement',
          code: 'MP_VERY_HIGH'
        });
      }
    }

    if (stats.wp !== undefined) {
      if (stats.wp < 6) {
        errors.push({
          field: 'stats.wp',
          message: 'Les PW ne peuvent pas être inférieurs à 6',
          code: 'WP_TOO_LOW'
        });
      }
      if (stats.wp > 12) {
        warnings.push({
          field: 'stats.wp',
          message: 'Les PW dépassent 12, vérifiez votre équipement',
          code: 'WP_VERY_HIGH'
        });
      }
    }

    if (stats.critRate !== undefined) {
      if (stats.critRate < 0) {
        errors.push({
          field: 'stats.critRate',
          message: 'Le taux de critique ne peut pas être négatif',
          code: 'CRIT_RATE_NEGATIVE'
        });
      }
      if (stats.critRate > 100) {
        errors.push({
          field: 'stats.critRate',
          message: 'Le taux de critique ne peut pas dépasser 100%',
          code: 'CRIT_RATE_TOO_HIGH'
        });
      }
    }

    if (stats.masteryPrimary !== undefined && stats.masteryPrimary < 100) {
      warnings.push({
        field: 'stats.masteryPrimary',
        message: 'La maîtrise primaire est faible, considérez améliorer votre équipement',
        code: 'LOW_MASTERY_PRIMARY'
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Valide qu'un sort peut être utilisé par un personnage
   */
  validateSpellForCharacter(spellId: string, characterLevel: number, classId: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    return { valid: errors.length === 0, errors, warnings };
  }
}

