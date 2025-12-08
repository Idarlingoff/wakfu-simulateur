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
import { Timeline, TimelineStep, TimelineAction, Position } from '../../models/timeline.model';
import { Spell } from '../../models/spell.model';
import { BoardEntity, Mechanism } from '../../models/board.model';
import { isSpellMechanism, getSpellMechanismType, getMechanismImagePath } from '../../utils/mechanism-utils';

export interface SimulationContext {
  availablePa: number;
  availablePw: number;
  availableMp: number;
  currentPosition?: Position;
  playerPosition?: Position;
  entities?: BoardEntity[];
  mechanisms?: Mechanism[];
  buffs?: any[];
  debuffs?: any[];
  turn?: number;
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
  private readonly spellsCache = new Map<string, Spell>();
  private readonly boardService = inject(BoardService);

  constructor(
    private readonly damageCalculator: DamageCalculatorService,
    private readonly statsCalculator: StatsCalculatorService
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
    // Calculer les stats totales du build avec les passifs
    let buildStats = this.statsCalculator.calculateTotalStats(build);

    // Récupérer les entités et mécanismes du plateau
    const boardState = this.boardService.state();
    const entities = boardState.entities || [];
    const mechanisms: Mechanism[] = this.boardService.mechanisms();

    // Trouver la position du joueur
    const playerEntity = entities.find((e: BoardEntity) => e.type === 'player');
    const playerPosition = playerEntity?.position || { x: 7, y: 7 };

    // Créer le contexte initial
    const initialContext: SimulationContext = {
      availablePa: buildStats.ap,
      availablePw: buildStats.wp,
      availableMp: buildStats.mp,
      currentPosition: playerPosition,
      playerPosition: playerPosition,
      entities: entities,
      mechanisms: mechanisms,
      buffs: [],
      debuffs: [],
      turn: 1
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

        // Mettre à jour la position si c'était un déplacement
        if (action.type === 'Move' && action.targetPosition) {
          this.updateContextPosition(currentContext, action.targetPosition);
        }
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

    // Déterminer la position de la cible
    const targetPosition = action.targetPosition || context.currentPosition;
    const casterPosition = context.playerPosition || context.currentPosition;

    if (!targetPosition || !casterPosition) {
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: spell.id,
        spellName: spell.name,
        paCost,
        pwCost,
        mpCost: 0,
        message: 'Position invalide pour lancer le sort'
      };
    }

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

    // Vérifier si c'est un sort de mécanisme
    const isMechanism = isSpellMechanism(spell.id);

    if (isMechanism) {
      return this.executeMechanismSpell(action, context, spell, paCost, pwCost);
    }

    // Utiliser les stats du build directement (les passifs sont déjà appliqués)
    const contextualStats = buildStats;

    // Calculer les dégâts
    const baseDamage = this.extractBaseDamageFromSpell(spell);

    const damageParams: DamageCalculationParams = {
      baseDamage,
      masteryPrimary: contextualStats.masteryPrimary,
      masterySecondary: contextualStats.masterySecondary,
      backMastery: contextualStats.backMastery,
      dommageInflict: contextualStats.dommageInflict,
      critRate: contextualStats.critRate,
      critMastery: contextualStats.critMastery,
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
        isCritical: damageResult.isCritical,
        lineOfSight: spell.lineOfSight
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
  private extractBaseDamageFromSpell(_spell: Spell): number {
    // Pour l'instant, utiliser une valeur par défaut
    // TODO: Analyser les effets du sort pour extraire les dégâts réels
    return 100;
  }

  /**
   * Exécute un sort de mécanisme (Rouage, Sinistro, Cadran, Régulateur)
   */
  private executeMechanismSpell(
    action: TimelineAction,
    context: SimulationContext,
    spell: Spell,
    paCost: number,
    pwCost: number
  ): SimulationActionResult {
    console.log(`🔧 [MECHANISM] executeMechanismSpell called for spell: ${spell.id} (${spell.name})`);

    const mechanismType = getSpellMechanismType(spell.id);

    if (!mechanismType) {
      console.error(`❌ [MECHANISM] Type not found for spell: ${spell.id}`);
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: spell.id,
        spellName: spell.name,
        paCost,
        pwCost,
        mpCost: 0,
        message: `Mechanism type not found for ${spell.name}`
      };
    }

    const imageUrl = 'http://localhost:8080/' + getMechanismImagePath(mechanismType, 0);

    console.log(`✅ [MECHANISM] Type found:`, {
      type: mechanismType,
      imageUrl: imageUrl
    });

    // Vérifier que la position cible est fournie
    if (!action.targetPosition) {
      console.error(`❌ [MECHANISM] No target position for spell ${spell.name}`);
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: spell.id,
        spellName: spell.name,
        paCost,
        pwCost,
        mpCost: 0,
        message: `No target position for mechanism ${spell.name}`
      };
    }

    console.log(`📍 [MECHANISM] Target position: (${action.targetPosition.x}, ${action.targetPosition.y})`);

    // Créer le mécanisme
    const mechanism: Mechanism = {
      id: `${mechanismType}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: mechanismType,
      position: action.targetPosition,
      charges: 0,
      spellId: spell.id
    };

    console.log(`🏗️ [MECHANISM] Mechanism object created:`, mechanism);

    // Ajouter le mécanisme au plateau via le BoardService
    this.boardService.addMechanism(mechanism);

    console.log(`✅ [MECHANISM] Mechanism ${spell.name} placed at (${action.targetPosition.x}, ${action.targetPosition.y})`);

    // Si c'est un cadran, créer les 12 heures autour (orientées selon la direction du lancer)
    if (mechanismType === 'dial') {
      // Récupérer la position du joueur
      const playerEntity = this.boardService.player();
      const playerPosition = playerEntity?.position || context.playerPosition || { x: 6, y: 6 };

      this.createDialHours(mechanism.id, action.targetPosition, playerPosition);
    }

    // Consommer les ressources
    context.availablePa -= paCost;
    context.availablePw -= pwCost;

    return {
      success: true,
      actionId: action.id || '',
      actionType: 'CastSpell',
      spellId: spell.id,
      spellName: spell.name,
      paCost,
      pwCost,
      mpCost: 0,
      message: `Placed ${spell.name} at (${action.targetPosition.x}, ${action.targetPosition.y})`,
      details: {
        mechanismType: mechanismType,
        mechanismId: mechanism.id
      }
    };
  }

  /**
   * Crée les 12 heures autour d'un cadran, orientées selon la direction du lancer
   */
  private createDialHours(dialId: string, centerPosition: Position, playerPosition: Position): void {
    console.log(`🕐 [DIAL_HOURS] Creating 12 hours around dial at (${centerPosition.x}, ${centerPosition.y})`);
    console.log(`👤 [DIAL_HOURS] Player position: (${playerPosition.x}, ${playerPosition.y})`);

    // Calculer la direction du lancer (du joueur vers le cadran)
    const dx = centerPosition.x - playerPosition.x;
    const dy = centerPosition.y - playerPosition.y;

    console.log(`📐 [DIAL_HOURS] Direction vector: (${dx}, ${dy})`);

    // Déterminer la rotation à appliquer selon la direction dominante
    let rotation = 0; // En quarts de tour (0, 1, 2, 3)
    let directionName = '';

    if (Math.abs(dx) > Math.abs(dy)) {
      // Direction horizontale dominante
      if (dx > 0) {
        // Droite (Est)
        rotation = 1; // 90° sens horaire
        directionName = 'DROITE (Est)';
      } else {
        // Gauche (Ouest)
        rotation = 3; // 270° sens horaire (ou -90°)
        directionName = 'GAUCHE (Ouest)';
      }
    } else {
      // Direction verticale dominante
      if (dy > 0) {
        // Bas (Sud) - Y+ = vers le bas
        rotation = 2; // 180°
        directionName = 'BAS (Sud)';
      } else {
        // Haut (Nord) - Y- = vers le haut
        rotation = 0; // 0° (orientation par défaut)
        directionName = 'HAUT (Nord)';
      }
    }

    console.log(`🧭 [DIAL_HOURS] Direction détectée: ${directionName}, Rotation: ${rotation * 90}°`);

    // Positions de base des heures (12h vers le HAUT/NORD par défaut)
    // Avec Y- = Nord, Y+ = Sud, X+ = Est, X- = Ouest
    const baseHourPositions = [
      { hour: 12, offsetX: 0, offsetY: -3 },   // 12h - Nord (haut)
      { hour: 1, offsetX: +1, offsetY: -2 },   // 1h
      { hour: 2, offsetX: +2, offsetY: -1 },   // 2h
      { hour: 3, offsetX: +3, offsetY: 0 },    // 3h - Est (droite)
      { hour: 4, offsetX: +2, offsetY: +1 },   // 4h
      { hour: 5, offsetX: +1, offsetY: +2 },   // 5h
      { hour: 6, offsetX: 0, offsetY: +3 },    // 6h - Sud (bas)
      { hour: 7, offsetX: -1, offsetY: +2 },   // 7h
      { hour: 8, offsetX: -2, offsetY: +1 },   // 8h
      { hour: 9, offsetX: -3, offsetY: 0 },    // 9h - Ouest (gauche)
      { hour: 10, offsetX: -2, offsetY: -1 },  // 10h
      { hour: 11, offsetX: -1, offsetY: -2 }   // 11h
    ];

    let hoursCreated = 0;

    baseHourPositions.forEach(({ hour, offsetX, offsetY }) => {
      // Appliquer la rotation
      let rotatedX = offsetX;
      let rotatedY = offsetY;

      // Rotation par quarts de tour (sens horaire)
      for (let i = 0; i < rotation; i++) {
        const tempX = rotatedX;
        rotatedX = -rotatedY;  // Rotation 90° sens horaire: (x,y) -> (-y,x)
        rotatedY = tempX;
      }

      const hourPosition: Position = {
        x: centerPosition.x + rotatedX,
        y: centerPosition.y + rotatedY
      };

      // Vérifier que la position est dans les limites du plateau (13x13)
      if (hourPosition.x >= 0 && hourPosition.x < 13 && hourPosition.y >= 0 && hourPosition.y < 13) {
        const dialHour = {
          id: `dial_hour_${hour}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          dialId: dialId,  // Référence au cadran central
          hour: hour,      // Numéro de l'heure (1-12)
          position: hourPosition
        };

        this.boardService.addDialHour(dialHour);
        hoursCreated++;
        console.log(`  ✅ Hour ${hour} created at (${hourPosition.x}, ${hourPosition.y}) [rotated offset: (${rotatedX}, ${rotatedY})]`);
      } else {
        console.warn(`  ⚠️ Hour ${hour} skipped - position out of bounds: (${hourPosition.x}, ${hourPosition.y})`);
      }
    });

    console.log(`🕐 [DIAL_HOURS] Created ${hoursCreated}/12 hours around dial ${dialId} (oriented ${directionName})`);
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
          console.error(`Entité introuvable: ${action.entityId}`);
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
          console.error(`Aucun joueur trouvé sur le plateau`);
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
      console.log(`${entityToMove.name} déplacé vers (${action.targetPosition.x}, ${action.targetPosition.y})`);

      // Mettre à jour le contexte si c'est le joueur
      if (entityToMove.type === 'player') {
        this.updateContextPosition(context, action.targetPosition);
      }

      // Mettre à jour la direction si spécifiée
      if (action.targetFacing) {
        this.boardService.updateEntityFacing(entityToMove.id, action.targetFacing);
        console.log(`${entityToMove.name} orienté vers ${action.targetFacing.direction}`);
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


  /**
   * Met à jour la position du joueur dans le contexte après un déplacement
   */
  private updateContextPosition(context: SimulationContext, newPosition: Position): void {
    context.currentPosition = newPosition;
    context.playerPosition = newPosition;

    // Mettre à jour aussi dans les entités
    if (context.entities) {
      const playerEntity = context.entities.find(e => e.type === 'player');
      if (playerEntity) {
        playerEntity.position = newPosition;
      }
    }
  }
}
