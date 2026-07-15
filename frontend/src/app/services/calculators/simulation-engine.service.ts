import { Injectable, inject } from '@angular/core';
import { DamageCalculatorService } from './damage-calculator.service';
import { StatsCalculatorService, TotalStats } from './stats-calculator.service';
import { BoardService } from '../board.service';
import { WakfuApiService } from '../wakfu-api.service';
import { Build } from '../../models/build.model';
import { Timeline, TimelineStep, TimelineAction, Position } from '../../models/timeline.model';
import { Spell, SpellEffect } from '../../models/spell.model';
import { BoardEntity, Mechanism } from '../../models/board.model';
import { SpellCastingValidatorService } from '../validators/spell-casting-validator.service';
import { MovementValidatorService } from '../validators/movement-validator.service';
import { ClassStrategyFactory } from '../strategies/class-strategy-factory.service';
import { ClassSimulationStrategy } from '../strategies/class-simulation-strategy.interface';
import { ResourceRegenerationService } from '../processors/resource-regeneration.service';
import { firstValueFrom } from 'rxjs';
import {buildSpellReferencesWithInnates, canonicalizeInnateSpellId} from '../../utils/innate-spells.utils';

/**
 * Phases d'exécution des effets de sorts
 * Correspond à la colonne `phase` de la table `spell_effect`
 */
export type EffectPhase =
  | 'PRE_CAST'              // Avant le cast (vérification de coûts supplémentaires)
  | 'ON_CAST'               // Au moment du lancer
  | 'IMMEDIATE'             // Immédiat (équivalent à ON_CAST)
  | 'ON_HIT'                // Quand le sort touche
  | 'ON_END_TURN'           // À la fin du tour du lanceur
  | 'ON_TARGET_TURN_START'  // Au début du tour de la cible
  | 'ON_TARGET_TURN_END'    // À la fin du tour de la cible
  | 'ON_HOUR_WRAPPED';      // Quand l'heure du cadran fait un tour complet

/**
 * Effet différé - Effet d'un sort qui sera résolu plus tard
 * Le passif "Maître du Cadran" déclenche RESOLVE_DELAYED_EFFECTS sur ON_HOUR_WRAPPED
 * pour résoudre ces effets immédiatement
 */
export interface DelayedEffect {
  id: string;
  spellId: string;
  spellName: string;
  originalPhase: EffectPhase;
  effectType: string;
  targetScope: string;
  targetPosition: Position;
  casterPosition: Position;
  params: Record<string, any>;
  registeredOnTurn: number;
  contextSnapshot?: {
    masteryFire?: number;
    masteryWater?: number;
    masteryEarth?: number;
    masteryAir?: number;
    masterySecondary?: number;
    critRate?: number;
    critMastery?: number;
    dommageInflict?: number;
  };
}

export interface MovementRecord {
  id: string;
  type: 'teleport' | 'push' | 'pull' | 'swap' | 'swap_mechanism' | 'move';
  targetId: string;
  targetType: 'entity' | 'mechanism';
  targetName: string;
  fromPosition: Position;
  toPosition: Position;
  sourceSpellId?: string;
  sourceActionId?: string;
  timestamp: number;
  swapPartner?: {
    id: string;
    type: 'entity' | 'mechanism';
    name: string;
    fromPosition: Position;
    toPosition: Position;
  };
}

export interface SimulationContext {
  availablePa: number;
  availablePw: number;
  availableMp: number;
  /** PW maximum (les PW régénérés ne peuvent pas dépasser ce plafond ; absent = pas de plafond). */
  maxPw?: number;
  currentPosition: Position;
  playerPosition: Position;
  range: number;
  entities?: BoardEntity[];
  mechanisms?: Mechanism[];
  buffs?: any[];
  debuffs?: any[];
  turn?: number;
  classState?: Record<string, any>;
  currentActionId?: string;
  activePassiveIds?: string[];
  spellUsageThisTurn?: Map<string, number>;
  spellUsagePerTarget?: Map<string, Map<string, number>>;
  movementHistory?: MovementRecord[];
  freeplay?: boolean;
  /** Recharge restante par sort, en tours de jeu (0/absent = disponible). */
  spellCooldowns?: Map<string, number>;
  /** Stats totales du lanceur (maîtrises, DI, coup critique...) pour le calcul déterministe des dégâts/soins. */
  casterStats?: TotalStats;
}

export interface SpellEffectResult {
  effectType: string;
  element?: string;
  damage?: number;
  heal?: number;
  shield?: number;
  isCritical?: boolean;
  breakdown?: any;
  normalValue?: number;
  critValue?: number;
  averageValue?: number;
}

export interface SimulationActionResult {
  success: boolean;
  actionId: string;
  actionType: string;
  spellId?: string;
  spellName?: string;
  iconId?: number;
  damage?: number;
  heal?: number;
  shield?: number;
  averageDamage?: number;
  averageHeal?: number;
  averageShield?: number;
  paCost: number;
  pwCost: number;
  mpCost: number;
  message: string;
  effects?: SpellEffectResult[];
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
  averageDamage: number;
  totalHeal: number;
  totalShield: number;
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

  private readonly spellsCache = new Map<string, Spell>();
  private readonly boardService: BoardService = inject(BoardService);
  private readonly spellCastingValidator: SpellCastingValidatorService = inject(SpellCastingValidatorService);
  private readonly movementValidator: MovementValidatorService = inject(MovementValidatorService);
  private readonly classStrategyFactory: ClassStrategyFactory = inject(ClassStrategyFactory);
  private readonly regenerationService: ResourceRegenerationService = inject(ResourceRegenerationService);

  private currentClassStrategy?: ClassSimulationStrategy;

  constructor(
    private readonly damageCalculator: DamageCalculatorService,
    private readonly statsCalculator: StatsCalculatorService,
    private readonly wakfuApi: WakfuApiService
  ) {}

  /**
   * Clone une position pour éviter les mutations partagées entre steps
   */
  private clonePosition(position: Position): Position {
    return { ...position };
  }

  /**
   * Clone le contexte de simulation pour figer un snapshot par step
   */
  private cloneContext(context: SimulationContext): SimulationContext {
    return {
      ...context,
      currentPosition: this.clonePosition(context.currentPosition),
      playerPosition: this.clonePosition(context.playerPosition),
      entities: context.entities?.map(entity => ({
        ...entity,
        position: this.clonePosition(entity.position)
      })),
      mechanisms: context.mechanisms?.map(mechanism => ({
        ...mechanism,
        position: this.clonePosition(mechanism.position)
      })),
      buffs: context.buffs ? [...context.buffs] : undefined,
      debuffs: context.debuffs ? [...context.debuffs] : undefined,
      activePassiveIds: context.activePassiveIds ? [...context.activePassiveIds] : undefined,
      spellUsageThisTurn: context.spellUsageThisTurn ? new Map(context.spellUsageThisTurn) : undefined,
      spellUsagePerTarget: context.spellUsagePerTarget
        ? new Map(
          Array.from(context.spellUsagePerTarget.entries()).map(([spellId, usageMap]) => [
            spellId,
            new Map(usageMap)
          ])
        )
        : undefined,
      spellCooldowns: context.spellCooldowns ? new Map(context.spellCooldowns) : undefined,
      movementHistory: context.movementHistory?.map(movement => ({
        ...movement,
        fromPosition: this.clonePosition(movement.fromPosition),
        toPosition: this.clonePosition(movement.toPosition),
        swapPartner: movement.swapPartner
          ? {
            ...movement.swapPartner,
            fromPosition: this.clonePosition(movement.swapPartner.fromPosition),
            toPosition: this.clonePosition(movement.swapPartner.toPosition)
          }
          : undefined
      })),
      classState: context.classState ? structuredClone(context.classState)
        : undefined
    };
  }

  /**
   * Exécute une simulation complète
   */
  async runSimulation(build: Build, timeline: Timeline, runTurnLifecycle: boolean = true): Promise<SimulationResult> {
    console.log('CALLED runSimulation');

    this.regenerationService.clearHistory();

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  DÉMARRAGE DE LA SIMULATION                       ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('Build:', build.name);
    console.log('Classe:', build.classId || 'Default');
    console.log('Timeline:', timeline.name);
    console.log('Nombre d\'étapes:', timeline.steps.length);
    console.log('');

    this.currentClassStrategy = this.classStrategyFactory.getStrategyForBuild(build);
    console.log(`Stratégie de classe: ${this.currentClassStrategy.classId}`);
    console.log('');

    let buildStats = this.statsCalculator.calculateTotalStats(build);

    console.log('📊 Stats calculées:', {
      AP: buildStats.ap,
      WP: buildStats.wp,
      MP: buildStats.mp,
      HP: buildStats.hp,
      'Maitrise Feu': buildStats.masteryFire,
      'Maitrise Eau': buildStats.masteryWater,
      'Maitrise Terre': buildStats.masteryEarth,
      'Maitrise Air': buildStats.masteryAir
    });
    console.log('');

    const boardState = this.boardService.state();
    const entities = boardState.entities || [];
    const mechanisms: Mechanism[] = this.boardService.mechanisms();

    const playerEntity = entities.find((e: BoardEntity) => e.type === 'player');
    const playerPosition = playerEntity?.position || { x: 7, y: 7 };

    const activePassiveIds = build.passiveBar?.passives
      ?.filter(p => p !== null)
      ?.map(p => p!.passiveId) || [];

    const initialContext: SimulationContext = {
      availablePa: buildStats.ap,
      availablePw: buildStats.wp,
      maxPw: buildStats.wp,
      availableMp: buildStats.mp,
      currentPosition: playerPosition,
      playerPosition: playerPosition,
      range: buildStats.range || 0,
      entities: entities,
      mechanisms: mechanisms,
      buffs: [],
      debuffs: [],
      turn: 1,
      activePassiveIds: activePassiveIds,
      spellUsageThisTurn: new Map<string, number>(),
      spellUsagePerTarget: new Map<string, Map<string, number>>(),
    };

    if (this.currentClassStrategy) {
      this.currentClassStrategy.initializeClassContext(initialContext, build);

      buildStats = this.currentClassStrategy.applyClassPassives(build, buildStats, initialContext);
      console.log('📊 Stats après passifs de classe:', {
        AP: buildStats.ap,
        'Maitrise Feu': buildStats.masteryFire,
        'Maitrise Eau': buildStats.masteryWater,
        'Maitrise Terre': buildStats.masteryEarth,
        'Maitrise Air': buildStats.masteryAir
      });
      console.log('');
    }

    // Rend les stats du lanceur disponibles pour les calculs déterministes (dégâts/soins mécanismes Xélor, etc.).
    initialContext.casterStats = buildStats;

    const steps: SimulationStepResult[] = [];
    const errors: string[] = [];
    let currentContext = this.cloneContext(initialContext);
    let totalDamage = 0;
    let averageDamage = 0;
    let totalHeal = 0;
    let totalShield = 0;

    for (let i = 0; i < timeline.steps.length; i++) {
      const step = timeline.steps[i];
      const stepResult = await this.executeStep(
        step,
        currentContext,
        build,
        buildStats,
        i + 1,
        runTurnLifecycle
      );

      steps.push(stepResult);
      currentContext = this.cloneContext(stepResult.contextAfter);

      for (const action of stepResult.actions) {
        if (action.damage) totalDamage += action.damage;
        averageDamage += action.averageDamage ?? action.damage ?? 0;
        if (action.heal) totalHeal += action.heal;
        if (action.shield) totalShield += action.shield;
      }

      if (!stepResult.success) {
        errors.push(`Step ${i + 1} failed: ${stepResult.actions.find(a => !a.success)?.message}`);
        break;
      }
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  ✅ FIN DE LA SIMULATION                             ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('📊 Résultat:');
    console.log('  ✅ Succès:', errors.length === 0);
    console.log('  💥 Dégâts totaux:', totalDamage);
    console.log('  💚 Soins totaux:', totalHeal);
    console.log('  🛡️ Armure totale:', totalShield);
    console.log('  ⚡ PA utilisés:', initialContext.availablePa - currentContext.availablePa);
    console.log('  🔮 WP utilisés:', initialContext.availablePw - currentContext.availablePw);
    console.log('  🏃 MP utilisés:', initialContext.availableMp - currentContext.availableMp);
    if (errors.length > 0) {
      console.log('  ❌ Erreurs:', errors);
    }
    console.log('');

    this.regenerationService.logRegenerationSummary('RÉSUMÉ RÉGÉNÉRATION - FIN DE SIMULATION');

    return {
      buildId: build.id || '',
      timelineId: timeline.id || '',
      buildStats,
      initialContext: this.cloneContext(initialContext),
      steps,
      finalContext: this.cloneContext(currentContext),
      totalDamage,
      averageDamage,
      totalHeal,
      totalShield,
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
  private async executeStep(
    step: TimelineStep,
    context: SimulationContext,
    build: Build,
    buildStats: TotalStats,
    stepNumber: number,
    runTurnLifecycle: boolean = true
  ): Promise<SimulationStepResult> {
    console.log('');
    console.log('┌───────────────────────────────────────────────────────┐');
    console.log(`│  🔹 ÉTAPE ${stepNumber}: ${step.description || step.id}`);
    console.log('└───────────────────────────────────────────────────────┘');
    console.log(`🎬 Nombre d'actions: ${step.actions.length}`);
    console.log(`📍 Position joueur (context): (${context.playerPosition?.x}, ${context.playerPosition?.y})`);
    console.log(`📍 Position joueur (BoardService): (${this.boardService.player()?.position?.x}, ${this.boardService.player()?.position?.y})`);
    console.log('');

    const actions: SimulationActionResult[] = [];
    let currentContext = this.cloneContext(context);
    let stepSuccess = true;

    // Cycle de tour : pour une timeline pré-écrite, chaque step = un tour (runTurnLifecycle=true).
    // En jeu interactif (executeSingleStep), une action != un tour -> pas de cycle de tour ici,
    // il est déclenché explicitement via endInteractiveTurn().
    if (runTurnLifecycle) {
      currentContext.turn = stepNumber;
      this.decrementSpellCooldowns(currentContext);
      this.currentClassStrategy?.onTurnStart?.(currentContext);
    }

    for (const action of step.actions) {
      console.log(`▶️  Action ${action.type}...`);
      currentContext.currentActionId = action.id;
      const actionResult = await this.executeAction(action, currentContext, build, buildStats);
      currentContext.currentActionId = undefined;
      actions.push(actionResult);

      if (actionResult.success) {
        currentContext.availablePa -= actionResult.paCost;
        currentContext.availablePw -= actionResult.pwCost;
        currentContext.availableMp -= actionResult.mpCost;

        if (action.type === 'Move' && action.targetPosition) {
          // Position RÉELLE du joueur après le déplacement : un hook onMoveExecuted a pu le
          // repositionner (ex: tour de cadran déclenché par ce déplacement -> échange Permutation
          // puis téléportation Horlogerie). Sinon on retombe sur la case d'arrivée du déplacement.
          const finalPlayerPos = this.boardService.player()?.position ?? action.targetPosition;
          this.updateContextPosition(currentContext, finalPlayerPos);
        }
      } else {
        stepSuccess = false;
        break;
      }
    }

    // Fin de tour : effets de fin de tour de la classe (uniquement si step = tour).
    if (runTurnLifecycle) {
      this.currentClassStrategy?.cleanupTurn?.(currentContext);
    }

    const triggeredActions = this.consumeTriggeredActions(currentContext);
    if (triggeredActions.length > 0) {
      console.log(`⚙️ [STEP] ${triggeredActions.length} action(s) déclenchée(s) ajoutée(s) au résultat`);
      actions.push(...triggeredActions);
    }

    return {
      stepId: step.id || `step_${stepNumber}`,
      stepNumber,
      actions,
      contextAfter: this.cloneContext(currentContext),
      success: stepSuccess
    };
  }

  private consumeTriggeredActions(context: SimulationContext): SimulationActionResult[] {
    if (!context.classState) {
      return [];
    }

    const triggered: SimulationActionResult[] = [];
    for (const key of Object.keys(context.classState)) {
      const state = context.classState[key] as Record<string, any>;
      if (!state || !Array.isArray(state['triggeredActions'])) {
        continue;
      }

      triggered.push(...state['triggeredActions']);
      state['triggeredActions'] = [];
    }

    return triggered;
  }

  /**
   * Exécute une action individuelle
   */
  private async executeAction(
    action: TimelineAction,
    context: SimulationContext,
    build: Build,
    buildStats: TotalStats
  ): Promise<SimulationActionResult> {
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
        return await this.executeCastSpell(action, context, build, buildStats);

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
  private async executeCastSpell(
    action: TimelineAction,
    context: SimulationContext,
    build: Build,
    buildStats: TotalStats
  ): Promise<SimulationActionResult> {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎯 [CAST SPELL] Tentative de lancement de sort');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Spell ID:', action.spellId);
    console.log('📍 Position cible:', action.targetPosition);
    console.log('⚡ Ressources disponibles:', {
      AP: context.availablePa,
      WP: context.availablePw,
      MP: context.availableMp
    });
    console.log('═══════════════════════════════════════════════════════');

    const spellRef = context.freeplay
      ? { spellId: canonicalizeInnateSpellId(action.spellId ?? '') }
      : buildSpellReferencesWithInnates(build).find(s => s.spellId === action.spellId);

    if (!spellRef) {
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: canonicalizeInnateSpellId(action.spellId),
        spellName: 'Unknown',
        paCost: 0,
        pwCost: 0,
        mpCost: 0,
        message: `Sort non trouvé dans le build: ${action.spellId}`
      };
    }

    let spell = this.spellsCache.get(spellRef.spellId);

    if (!spell) {
      console.warn(`⚠️ Sort ${spellRef.spellId} non trouvé dans le cache, chargement depuis l'API...`);

      try {
        spell = await firstValueFrom(this.wakfuApi.getSpellById(spellRef.spellId));

        this.spellsCache.set(spell.id, spell);

        console.log(`✅ Sort chargé depuis l'API:`, spell.name);
      } catch (error) {
        console.error(`❌ Impossible de charger le sort ${spellRef.spellId} depuis l'API:`, error);
        return {
          success: false,
          actionId: action.id || '',
          actionType: 'CastSpell',
          spellId: spellRef.spellId,
          spellName: spellRef.spellId,
          paCost: 0,
          pwCost: 0,
          mpCost: 0,
          message: `Sort introuvable: ${spellRef.spellId}. Vérifiez que le sort existe en base de données.`
        };
      }
    }

    let paCost = spell.paCost || 0;
    let pwCost = spell.pwCost || 0;

    if (this.currentClassStrategy?.getSpellExtraCost) {
      const extraCost = this.currentClassStrategy.getSpellExtraCost(spell, context);
      paCost += extraCost.extraPaCost;
      pwCost += extraCost.extraPwCost;

      if (extraCost.extraPaCost > 0 || extraCost.extraPwCost > 0) {
        console.log(`💰 [EXTRA COST] Coûts supplémentaires appliqués: +${extraCost.extraPaCost} PA, +${extraCost.extraPwCost} PW`);
        console.log(`💰 [EXTRA COST] Coût total: ${paCost} PA, ${pwCost} PW`);
      }
    }

    const targetPosition = action.targetPosition || context.currentPosition;

    const playerFromBoard = this.boardService.player();
    const casterPosition = playerFromBoard?.position || context.playerPosition || context.currentPosition;

    if (playerFromBoard?.position &&
        (context.playerPosition?.x !== playerFromBoard.position.x ||
         context.playerPosition?.y !== playerFromBoard.position.y)) {
      console.log(`🔄 [SYNC] Synchronizing context position with BoardService: (${context.playerPosition?.x}, ${context.playerPosition?.y}) → (${playerFromBoard.position.x}, ${playerFromBoard.position.y})`);
      context.playerPosition = playerFromBoard.position;
      context.currentPosition = playerFromBoard.position;

      if (context.entities) {
        const playerEntityInContext = context.entities.find(e => e.type === 'player');
        if (playerEntityInContext) {
          playerEntityInContext.position = playerFromBoard.position;
        }
      }
    }

    if (!targetPosition || !casterPosition) {
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: spell.id,
        spellName: spell.name,
        iconId: spell.iconId,
        paCost,
        pwCost,
        mpCost: 0,
        message: 'Position invalide pour lancer le sort'
      };
    }

    console.log('🔍 [VALIDATION] Vérification des conditions de lancement...');
    console.log('🔍 [VALIDATION] Position du lanceur (context.playerPosition):', casterPosition);
    console.log('🔍 [VALIDATION] Position cible:', targetPosition);
    console.log('🔍 [VALIDATION] Position du joueur dans BoardService:', this.boardService.player()?.position);
    const validation = this.spellCastingValidator.validateSpellCast(
      spell,
      casterPosition,
      targetPosition,
      context
    );

    console.log('✅ [VALIDATION] Résultat:', {
      canCast: validation.canCast,
      reason: validation.reason,
      details: validation.details
    });

    if (!validation.canCast) {
      console.log('❌ [CAST SPELL] Sort impossible à lancer !');
      console.log('═══════════════════════════════════════════════════════');
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: spell.id,
        spellName: spell.name,
        iconId: spell.iconId,
        paCost,
        pwCost,
        mpCost: 0,
        message: validation.reason || 'Cannot cast spell',
        details: validation.details
      };
    }

    console.log('✅ [CAST SPELL] Validation réussie ! Le sort peut être lancé');

    if (this.currentClassStrategy) {
      const classValidation = this.currentClassStrategy.validateClassSpecificCasting(
        spell,
        casterPosition,
        targetPosition,
        context
      );

      if (!classValidation.canCast) {
        console.log(`❌ [CLASS VALIDATION] ${classValidation.reason}`);
        return {
          success: false,
          actionId: action.id || '',
          actionType: 'CastSpell',
          spellId: spell.id,
          spellName: spell.name,
          iconId: spell.iconId,
          paCost,
          pwCost,
          mpCost: 0,
          message: classValidation.reason || 'Condition de classe non remplie'
        };
      }

      const isClassMechanism = this.currentClassStrategy.isClassMechanismSpell(spell.id);

      if (isClassMechanism) {
        console.log(`🔧 [CLASS MECHANISM] Detected class mechanism spell for ${this.currentClassStrategy.classId}`);
        const result = this.currentClassStrategy.executeClassMechanismSpell(action, context, spell, paCost, pwCost);

        if (result.success) {
          this.currentClassStrategy.processClassSpecificEffects(spell, action, context, result);
          this.updateSpellUsageCounters(spell, action.targetPosition, context);
        }

        return result;
      }
    }

    const contextualStats = buildStats;

    const normalEffects = this.extractSpellEffects(spell, 'NORMAL');
    const critEffects = this.extractSpellEffects(spell, 'CRIT');

    const targetEntity = this.boardService.getEntityAtPosition(targetPosition);
    const orientation = this.resolveOrientation(targetEntity?.facing?.direction) as 'front' | 'side' | 'back';
    const distanceCases = this.manhattanDistanceToTarget(context, targetPosition);

    const effectResults: SpellEffectResult[] = [];
    let totalDamage = 0, totalHeal = 0, totalShield = 0;
    let avgDamage = 0, avgHeal = 0, avgShield = 0;

    for (let i = 0; i < normalEffects.length; i++) {
      const eff = normalEffects[i];
      const critBase = critEffects[i]?.type === eff.type ? critEffects[i].baseValue : undefined;
      const values = this.damageCalculator.computeEffectValues({
        effectType: eff.type as 'DEAL_DAMAGE' | 'HEAL' | 'GIVE_ARMOR',
        normalBase: eff.baseValue,
        critBase,
        element: eff.element,
        stats: contextualStats as any,
        distanceCases,
        orientation,
      });
      const result: SpellEffectResult = {
        effectType: eff.type, element: eff.element,
        normalValue: values.normal, critValue: values.crit, averageValue: values.average,
      };
      if (eff.type === 'DEAL_DAMAGE') { result.damage = values.normal; totalDamage += values.normal; avgDamage += values.average; }
      else if (eff.type === 'HEAL') { result.heal = values.normal; totalHeal += values.normal; avgHeal += values.average; }
      else if (eff.type === 'GIVE_ARMOR') { result.shield = values.normal; totalShield += values.normal; avgShield += values.average; }
      effectResults.push(result);
    }

    const messageParts: string[] = [];
    if (totalDamage > 0) messageParts.push(`${totalDamage} dégâts`);
    if (totalHeal > 0) messageParts.push(`${totalHeal} soins`);
    if (totalShield > 0) messageParts.push(`${totalShield} armure`);
    const effectsSummary = messageParts.length > 0 ? messageParts.join(', ') : 'aucun effet';

    const result: SimulationActionResult = {
      success: true,
      actionId: action.id || '',
      actionType: 'CastSpell',
      spellId: spell.id,
      spellName: spell.name,
      iconId: spell.iconId,
      damage: totalDamage,
      heal: totalHeal,
      shield: totalShield,
      averageDamage: Math.round(avgDamage),
      averageHeal: Math.round(avgHeal),
      averageShield: Math.round(avgShield),
      paCost,
      pwCost,
      mpCost: 0,
      message: `${spell.name}: ${effectsSummary}`,
      effects: effectResults,
      details: {
        lineOfSight: spell.lineOfSight,
        effectCount: normalEffects.length
      }
    };

    if (this.currentClassStrategy && result.success) {
      this.currentClassStrategy.processClassSpecificEffects(spell, action, context, result);
    }

    if (result.success) {
      this.updateSpellUsageCounters(spell, action.targetPosition, context);
    }

    return result;
  }

  /**
   * Met à jour les compteurs d'utilisation de sort
   * Note: Pour usePerTarget, on utilise l'ID de l'entité ciblée
   * afin que le compteur suive l'entité même si elle se déplace
   */
  private updateSpellUsageCounters(spell: Spell, targetPosition: Position | undefined, context: SimulationContext): void {
    context.spellUsageThisTurn ??= new Map<string, number>();
    context.spellUsagePerTarget ??= new Map<string, Map<string, number>>();

    const currentUsage = context.spellUsageThisTurn.get(spell.id) || 0;
    context.spellUsageThisTurn.set(spell.id, currentUsage + 1);
    console.log(`📊 [USAGE] ${spell.name}: ${currentUsage + 1} utilisation(s) ce tour`);

    if (targetPosition) {
      const targetEntity = this.boardService.getEntityAtPosition(targetPosition);

      const targetKey = targetEntity
        ? `entity:${targetEntity.id}`
        : `pos:${targetPosition.x},${targetPosition.y}`;

      if (!context.spellUsagePerTarget.has(spell.id)) {
        context.spellUsagePerTarget.set(spell.id, new Map<string, number>());
      }

      const spellTargetUsage = context.spellUsagePerTarget.get(spell.id)!;
      const currentTargetUsage = spellTargetUsage.get(targetKey) || 0;
      spellTargetUsage.set(targetKey, currentTargetUsage + 1);

      if (targetEntity) {
        console.log(`📊 [USAGE] ${spell.name} sur ${targetEntity.name} (${targetEntity.id}): ${currentTargetUsage + 1} utilisation(s) sur cette cible`);
      } else {
        console.log(`📊 [USAGE] ${spell.name} sur position (${targetPosition.x}, ${targetPosition.y}): ${currentTargetUsage + 1} utilisation(s) sur cette cible`);
      }
    }

    // Recharge (cooldown) : déclenchée à la réussite du cast, décrémentée à chaque début de tour.
    if (spell.cooldown && spell.cooldown > 0) {
      context.spellCooldowns ??= new Map<string, number>();
      context.spellCooldowns.set(spell.id, spell.cooldown);
      console.log(`⏳ [COOLDOWN] ${spell.name} en recharge pour ${spell.cooldown} tour(s)`);
    }
  }

  /** Décrémente d'1 la recharge de tous les sorts en cooldown (appelé à chaque début de tour). */
  private decrementSpellCooldowns(context: SimulationContext): void {
    if (!context.spellCooldowns) return;
    for (const [spellId, remaining] of context.spellCooldowns) {
      if (remaining > 0) {
        context.spellCooldowns.set(spellId, remaining - 1);
      }
    }
  }


  /**
   * Structure représentant un effet brut extrait d'un sort
   */
  private extractBaseValue(effect: SpellEffect): number {
    if (effect.minValue !== undefined && effect.minValue !== null &&
        effect.maxValue !== undefined && effect.maxValue !== null) {
      return (effect.minValue + effect.maxValue) / 2;
    }

    if (effect.extendedData) {
      const params = effect.extendedData;
      if (params.amount !== undefined) {
        return params.amount;
      }
      if (params.minValue !== undefined && params.maxValue !== undefined) {
        return (params.minValue + params.maxValue) / 2;
      }
    }

    return 0;
  }

  /**
   * Extrait tous les effets calculables (DEAL_DAMAGE, HEAL, GIVE_ARMOR) d'un sort
   * pour une variante donnée (NORMAL ou CRIT)
   */
  private extractSpellEffects(spell: Spell, variantKind: string): { type: string; baseValue: number; element?: string }[] {
    const variant = spell.variants.find(v => v.kind === variantKind)
      ?? spell.variants.find(v => v.kind === 'NORMAL');

    if (!variant) {
      console.warn(`⚠️ Aucune variante ${variantKind} trouvée pour ${spell.name}`);
      return [];
    }

    const breakpoint = spell.breakpoints?.find(b => b.kind === variantKind)
      ?? spell.breakpoints?.find(b => b.kind === 'NORMAL');
    const ratioFromBreakpoint = breakpoint?.ratio ?? null;

    const computableEffects: { type: string; baseValue: number; element?: string }[] = [];

    for (const effect of variant.effects) {
      const effectType = effect.effect;

      if (effectType === 'DEAL_DAMAGE' || effectType === 'HEAL' || effectType === 'GIVE_ARMOR') {
        let baseValue: number;
        if (effectType === 'DEAL_DAMAGE' && ratioFromBreakpoint !== null) {
          baseValue = ratioFromBreakpoint;
        } else {
          baseValue = this.extractBaseValue(effect);
        }

        if (baseValue > 0) {
          computableEffects.push({
            type: effectType,
            baseValue,
            element: effect.element ?? (effect.extendedData?.element ?? undefined)
          });
        }
      }
    }

    console.log(`🔍 [EFFECTS] ${spell.name} (${variantKind}): ${computableEffects.length} effet(s) calculable(s) extraits (ratio breakpoint: ${ratioFromBreakpoint})`);
    return computableEffects;
  }

  /**
   * Exécute un déplacement
   */
  private executeMove(
    action: TimelineAction,
    context: SimulationContext
  ): SimulationActionResult {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚶 [MOVE] Tentative de déplacement');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📍 Position cible:', action.targetPosition);
    console.log('⚡ Ressources disponibles:', {
      AP: context.availablePa,
      WP: context.availablePw,
      MP: context.availableMp
    });
    console.log('═══════════════════════════════════════════════════════');

    let entityToMove;
    let currentPosition: Position;

    if (action.entityId) {
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
      currentPosition = entityToMove.position;
    } else {
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
      currentPosition = context.playerPosition || entityToMove.position;
    }

    if (!action.targetPosition) {
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

    console.log('🔍 [VALIDATION] Vérification du déplacement...');
    console.log('  De:', currentPosition);
    console.log('  Vers:', action.targetPosition);

    let validation: ReturnType<typeof this.movementValidator.validateMovement>;
    if (context.freeplay) {
      const fromIsDialHour = this.boardService.dialHours().some(
        h => h.position.x === currentPosition.x && h.position.y === currentPosition.y
      );
      const toIsDialHour = this.boardService.dialHours().some(
        h => h.position.x === action.targetPosition!.x && h.position.y === action.targetPosition!.y
      );
      if (fromIsDialHour && toIsDialHour) {
        validation = { canMove: true, reason: undefined, cost: { mp: 0, wp: 1 }, details: { movementType: 'dial_hour' } };
      } else {
        validation = { canMove: true, reason: undefined, cost: { mp: 0, wp: 0 }, details: { movementType: 'normal' } };
      }
    } else {
      validation = this.movementValidator.validateMovement(currentPosition, action.targetPosition, context);
    }

    console.log('✅ [VALIDATION] Résultat:', {
      canMove: validation.canMove,
      reason: validation.reason,
      cost: validation.cost,
      details: validation.details
    });

    if (!validation.canMove) {
      console.log('❌ [MOVE] Déplacement impossible !');
      console.log('═══════════════════════════════════════════════════════');
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'Move',
        paCost: 0,
        pwCost: validation.cost.wp,
        mpCost: validation.cost.mp,
        message: validation.reason || 'Cannot move',
        details: validation.details
      };
    }

    console.log('✅ [MOVE] Validation réussie ! Déplacement autorisé');
    console.log(`💰 Coût: ${validation.cost.mp} MP, ${validation.cost.wp} WP`);
    console.log('═══════════════════════════════════════════════════════');

    this.boardService.updateEntityPosition(entityToMove.id, action.targetPosition);
    console.log(`${entityToMove.name} déplacé vers (${action.targetPosition.x}, ${action.targetPosition.y})`);

    if (entityToMove.type === 'player') {
      this.updateContextPosition(context, action.targetPosition);
    }

    if (action.targetFacing) {
      this.boardService.updateEntityFacing(entityToMove.id, action.targetFacing);
      console.log(`${entityToMove.name} orienté vers ${action.targetFacing.direction}`);
    }

    // Trace le déplacement classique (PM/PW) pour Retour Spontané : "annule le dernier mouvement effectué".
    context.movementHistory ??= [];
    context.movementHistory.push({
      id: `move_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: 'move',
      targetId: entityToMove.id,
      targetType: 'entity',
      targetName: entityToMove.name,
      fromPosition: { ...currentPosition },
      toPosition: { ...action.targetPosition },
      sourceActionId: context.currentActionId,
      timestamp: Date.now(),
    });
    console.log(`[MOVE] 📝 Déplacement tracé: ${entityToMove.name} (${currentPosition.x}, ${currentPosition.y}) → (${action.targetPosition.x}, ${action.targetPosition.y})`);

    const moveResult: SimulationActionResult = {
      success: true,
      actionId: action.id || '',
      actionType: 'Move',
      paCost: 0,
      pwCost: validation.cost.wp,
      mpCost: validation.cost.mp,
      message: `${entityToMove.name} moved to (${action.targetPosition.x}, ${action.targetPosition.y})`,
      details: validation.details
    };

    this.currentClassStrategy?.onMoveExecuted?.(action, context, validation, moveResult);
    return moveResult;
  }

  /**
   * Exécute un SEUL step avec le contexte fourni (sans ré-exécuter les steps précédents)
   * Utilisé pour l'exécution incrémentale step-by-step
   */
  async executeSingleStep(
    step: TimelineStep,
    context: SimulationContext,
    build: Build,
    stepNumber: number
  ): Promise<SimulationStepResult> {
    this.currentClassStrategy ??= this.classStrategyFactory.getStrategyForBuild(build);

    let buildStats = this.statsCalculator.calculateTotalStats(build);

    if (this.currentClassStrategy) {
      buildStats = this.currentClassStrategy.applyClassPassives(build, buildStats, context);
    }

    // Rend les stats du lanceur disponibles pour les calculs déterministes en jeu interactif.
    context.casterStats = buildStats;

    // Jeu interactif : une action n'est PAS un tour -> pas de cycle de tour automatique.
    return await this.executeStep(step, context, build, buildStats, stepNumber, false);
  }

  /**
   * Termine explicitement le tour courant en jeu interactif :
   * applique les effets de fin de tour (Permutation, ticks mécanismes, purge des mouvements)
   * puis le début du tour suivant (Horlogerie, TP différé Prémonition, reset des gardes).
   * Retourne un step result contenant les actions déclenchées (pour l'affichage).
   */
  endInteractiveTurn(context: SimulationContext, build: Build): SimulationStepResult {
    this.currentClassStrategy ??= this.classStrategyFactory.getStrategyForBuild(build);

    const ctx = this.cloneContext(context);

    // Garantit la présence des stats du lanceur pour les ticks de fin/début de tour (explosion Rouage, soin Sinistro).
    if (!ctx.casterStats) {
      let buildStats = this.statsCalculator.calculateTotalStats(build);
      if (this.currentClassStrategy) {
        buildStats = this.currentClassStrategy.applyClassPassives(build, buildStats, ctx);
      }
      ctx.casterStats = buildStats;
    }

    // Fin du tour courant
    this.currentClassStrategy?.cleanupTurn?.(ctx);

    // Début du tour suivant
    ctx.turn = (ctx.turn || 1) + 1;
    this.decrementSpellCooldowns(ctx);
    this.currentClassStrategy?.onTurnStart?.(ctx);

    const triggeredActions = this.consumeTriggeredActions(ctx);

    return {
      stepId: `turn_end_${Date.now()}`,
      stepNumber: ctx.turn,
      actions: triggeredActions,
      contextAfter: this.cloneContext(ctx),
      success: true
    };
  }


  /**
   * Met à jour la position du joueur dans le contexte après un déplacement
   */
  private updateContextPosition(context: SimulationContext, newPosition: Position): void {
    context.currentPosition = newPosition;
    context.playerPosition = newPosition;

    if (context.entities) {
      const playerEntity = context.entities.find(e => e.type === 'player');
      if (playerEntity) {
        playerEntity.position = newPosition;
      }
    }
  }

  private resolveOrientation(facingDirection?: string): string {
    if (facingDirection === 'back') return 'back';
    if (facingDirection === 'side') return 'side';
    return 'front';
  }

  private manhattanDistanceToTarget(context: SimulationContext, target: { x: number; y: number }): number {
    const p = context.playerPosition ?? context.currentPosition;
    if (!p) return 1;
    return Math.abs(p.x - target.x) + Math.abs(p.y - target.y);
  }
}
