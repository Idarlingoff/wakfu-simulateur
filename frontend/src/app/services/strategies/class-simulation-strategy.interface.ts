import { Spell } from '../../models/spell.model';
import { Position, TimelineAction } from '../../models/timeline.model';
import { SimulationContext, SimulationActionResult } from '../calculators/simulation-engine.service';
import { Build } from '../../models/build.model';
import { TotalStats } from '../calculators/stats-calculator.service';
import { MovementValidationResult } from '../validators/movement-validator.service';

export interface ClassValidationResult {
  canCast: boolean;
  reason?: string;
  details?: any;
}

/**
 * Interface abstraite pour les stratégies de simulation par classe
 * Définit les méthodes spécifiques à chaque classe de personnage
 */
export abstract class ClassSimulationStrategy {

  abstract readonly classId: string;

  /**
   * Vérifie les conditions de lancement spécifiques à la classe
   *
   * @param spell Sort à vérifier
   * @param casterPosition Position du lanceur
   * @param targetPosition Position de la cible
   * @param context Contexte de simulation
   * @returns Résultat de validation
   */
  abstract validateClassSpecificCasting(
    spell: Spell,
    casterPosition: Position,
    targetPosition: Position,
    context: SimulationContext
  ): ClassValidationResult;

  /**
   * Traite les effets spécifiques à la classe après le lancement d'un sort
   *
   * @param spell Sort lancé
   * @param action Action de la timeline
   * @param context Contexte de simulation
   * @param actionResult Résultat de l'action
   */
  abstract processClassSpecificEffects(
    spell: Spell,
    action: TimelineAction,
    context: SimulationContext,
    actionResult: SimulationActionResult
  ): void;

  /**
   * Applique les passifs spécifiques à la classe sur les stats du build
   *
   * @param build Build du joueur
   * @param baseStats Stats de base calculées
   * @param context Contexte de simulation actuel
   * @returns Stats modifiées par les passifs de classe
   */
  abstract applyClassPassives(
    build: Build,
    baseStats: TotalStats,
    context: SimulationContext
  ): TotalStats;

  /**
   * Vérifie si un sort est un sort de mécanisme pour cette classe
   *
   * @param spellId ID du sort
   * @returns true si c'est un sort de mécanisme
   */
  abstract isClassMechanismSpell(spellId: string): boolean;

  /**
   * Exécute un sort de mécanisme spécifique à la classe
   *
   * @param action Action de la timeline
   * @param context Contexte de simulation
   * @param spell Sort à lancer
   * @param paCost Coût en PA
   * @param pwCost Coût en WP
   * @returns Résultat de l'action
   */
  abstract executeClassMechanismSpell(
    action: TimelineAction,
    context: SimulationContext,
    spell: Spell,
    paCost: number,
    pwCost: number
  ): SimulationActionResult;

  /**
   * Initialise le contexte de simulation avec les données spécifiques à la classe
   * (appelé au début de la simulation)
   *
   * @param context Contexte à initialiser
   * @param build Build du joueur
   */
  abstract initializeClassContext(context: SimulationContext, build: Build): void;

  /**
   * Hook optionnel appelé après un déplacement validé/exécuté.
   * Permet à une classe de traiter ses règles de mouvement spécifiques.
   *
   * @param action Action de la timeline
   * @param context Contexte de la simulation
   * @param validation Résultat de la validation du mouvement
   * @param result Résultat de l'exécution du mouvement
   */
  onMoveExecuted?(
    action: TimelineAction,
    context: SimulationContext,
    validation: MovementValidationResult,
    result: SimulationActionResult
  ): void;

  /**
   * Calcule le coût supplémentaire en ressources pour un sort basé sur les passifs actifs
   * Méthode optionnelle - par défaut retourne 0
   *
   * @param spell Sort à vérifier
   * @param context Contexte de simulation
   * @returns Objet avec les coûts supplémentaires { extraPaCost, extraPwCost }
   */
  getSpellExtraCost?(spell: Spell, context: SimulationContext): { extraPaCost: number; extraPwCost: number };
}
