/**
 * Interface abstraite pour les stratégies de simulation par classe
 * Définit les méthodes spécifiques à chaque classe de personnage
 */

import { Spell } from '../../models/spell.model';
import { Position } from '../../models/timeline.model';
import { SimulationContext, SimulationActionResult } from '../calculators/simulation-engine.service';
import { TimelineAction } from '../../models/timeline.model';
import { Build } from '../../models/build.model';
import { TotalStats } from '../calculators/stats-calculator.service';

/**
 * Résultat de validation spécifique à une classe
 */
export interface ClassValidationResult {
  canCast: boolean;
  reason?: string;
  details?: any;
}

/**
 * Interface abstraite pour les stratégies de simulation par classe
 */
export abstract class ClassSimulationStrategy {

  /**
   * Nom de la classe (ex: 'Xelor', 'Iop', 'Eniripsa', etc.)
   */
  abstract readonly classId: string;

  /**
   * Vérifie les conditions de lancement spécifiques à la classe
   * (ex: pour Xelor - présence de mécanismes, charges, etc.)
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
   * (ex: pour Xelor - gestion des charges de mécanismes, création d'heures, etc.)
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
   * (ex: pour Xelor - bonus selon le nombre de mécanismes, etc.)
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
   * (ex: pour Xelor - pose de Rouage, Cadran, Sinistro, etc.)
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
   * Nettoie les données spécifiques à la classe à la fin d'un tour
   * (ex: décrémentation de durées de buffs, etc.)
   *
   * @param context Contexte à nettoyer
   */
  abstract cleanupTurn(context: SimulationContext): void;

  /**
   * Traite les effets de tour complet du cadran (hour wrap)
   * Méthode optionnelle - par défaut ne fait rien
   * (ex: pour Xelor - déclenche les dégâts des rouages, soins des sinistros, effets délayés)
   *
   * @param context Contexte de simulation
   */
  processHourWrap?(context: SimulationContext): void;
}
