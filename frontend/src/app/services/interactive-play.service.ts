/**
 * InteractivePlayService
 * Permet d'enchaîner des actions directement sur la map sans timeline :
 *  - Déplacement (PM ou PW si case heure du cadran)
 *  - Lancer un sort avec toutes ses interactions (dégâts, mécanismes, etc.)
 * Les résultats s'accumulent dans le cache réactif de SimulationService
 * et s'affichent dans le DamageSummaryComponent.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { Build } from '../models/build.model';
import { Position, TimelineAction, TimelineStep } from '../models/timeline.model';
import { SimulationContext, SimulationStepResult, SimulationEngineService } from './calculators/simulation-engine.service';
import { SimulationService } from './simulation.service';
import { StatsCalculatorService } from './calculators/stats-calculator.service';
import { BoardService } from './board.service';
import { Mechanism } from '../models/board.model';
import { getSpellMechanismType } from '../utils/mechanism-utils';

export type InteractiveMode = 'off' | 'idle';

@Injectable({ providedIn: 'root' })
export class InteractivePlayService {
  private readonly simulationEngine = inject(SimulationEngineService);
  private readonly simulationService = inject(SimulationService);
  private readonly statsCalculator = inject(StatsCalculatorService);
  private readonly boardService = inject(BoardService);

  private readonly _mode = signal<InteractiveMode>('off');
  public mode = computed(() => this._mode());

  /** Contexte courant (PA/PW/MP restants, position, classState…) */
  private readonly _context = signal<SimulationContext | null>(null);
  public context = computed(() => this._context());

  /** Mémoriser le build courant */
  private _build: Build | null = null;

  /** Nombre de steps accumulés dans la session courante */
  private _stepCount = 0;

  /** Active le mode interactif et initialise le contexte depuis le build */
  startSession(build: Build): void {
    this._build = build;
    this._stepCount = 0;

    const stats = this.statsCalculator.calculateTotalStats(build);
    const player = this.boardService.player();
    const entities = this.boardService.state().entities;
    const mechanisms: Mechanism[] = this.boardService.mechanisms();

    const activePassiveIds = build.passiveBar?.passives
      ?.filter(p => p !== null)
      ?.map(p => p!.passiveId) ?? [];

    const ctx: SimulationContext = {
      availablePa: stats.ap,
      availablePw: stats.wp,
      availableMp: stats.mp,
      currentPosition: player?.position ?? { x: 0, y: 0 },
      playerPosition: player?.position ?? { x: 0, y: 0 },
      range: stats.range ?? 0,
      entities: [...entities],
      mechanisms: [...mechanisms],
      buffs: [],
      debuffs: [],
      turn: 1,
      activePassiveIds,
      spellUsageThisTurn: new Map(),
      spellUsagePerTarget: new Map(),
      movementHistory: [],
    };

    this._context.set(ctx);
    this.simulationService.clearInteractiveSteps();
    this._mode.set('idle');
    console.log('[InteractivePlay] Session démarrée – PA:', stats.ap, 'PW:', stats.wp, 'MP:', stats.mp);
  }

  /** Arrête la session interactive et nettoie */
  stopSession(): void {
    this._mode.set('off');
    this._context.set(null);
    this._build = null;
    this._stepCount = 0;
    console.log('[InteractivePlay] Session arrêtée');
  }

  /** Remet les ressources à leur valeur initiale sans quitter le mode interactif */
  resetSession(build: Build): void {
    this.stopSession();
    this.simulationService.clearInteractiveSteps();
    this.startSession(build);
  }

  isActive(): boolean {
    return this._mode() === 'idle';
  }

  /**
   * Exécute un sort et retourne le résultat du step.
   * Met à jour le contexte interne et pousse le step dans SimulationService.
   */
  async castSpell(spellId: string, targetPosition: Position): Promise<SimulationStepResult | null> {
    if (!this.isActive() || !this._build) {
      console.warn('[InteractivePlay] Session non active');
      return null;
    }

    const ctx = this._context();
    if (!ctx) return null;

    this._stepCount++;
    const stepNumber = this._stepCount;

    const action: TimelineAction = {
      id: `iplay_action_${Date.now()}`,
      type: 'CastSpell',
      order: 1,
      spellId,
      targetPosition,
    };

    const step: TimelineStep = {
      id: `iplay_step_${Date.now()}`,
      actions: [action],
      description: `[Interactif] Sort ${spellId} sur (${targetPosition.x}, ${targetPosition.y})`,
    };

    try {
      const result = await this.simulationEngine.executeSingleStep(step, ctx, this._build, stepNumber);
      this._context.set(result.contextAfter);
      this.simulationService.appendInteractiveStep(result);

      if (!result.success) {
        const err = result.actions.find(a => !a.success)?.message ?? 'Impossible de lancer le sort';
        console.warn('[InteractivePlay] Sort échoué:', err);
      } else {
        const dmg = result.actions.reduce((acc, a) => acc + (a.damage ?? 0), 0);
        console.log(`[InteractivePlay] Sort exécuté – dégâts: ${dmg}`);
        this.syncPlayerPositionFromContext(result.contextAfter);
        this.syncMechanismsFromContext(result.contextAfter, spellId);
      }

      return result;
    } catch (e) {
      console.error('[InteractivePlay] Erreur lors du cast:', e);
      return null;
    }
  }

  /**
   * Exécute un déplacement (Move).
   * `via` = 'PM' (utilise des PM) ou 'PW' (utilise des PW – case heure cadran).
   */
  async move(targetPosition: Position, via: 'PM' | 'PW'): Promise<SimulationStepResult | null> {
    if (!this.isActive() || !this._build) {
      console.warn('[InteractivePlay] Session non active');
      return null;
    }

    const ctx = this._context();
    if (!ctx) return null;

    this._stepCount++;
    const stepNumber = this._stepCount;

    const action: TimelineAction = {
      id: `iplay_move_${Date.now()}`,
      type: 'Move',
      order: 1,
      targetPosition,
      details: {
        via,
        mpCost: via === 'PM' ? 1 : 0,
        pwCost: via === 'PW' ? 1 : 0,
      },
    };

    const step: TimelineStep = {
      id: `iplay_step_${Date.now()}`,
      actions: [action],
      description: `[Interactif] Déplacement ${via} vers (${targetPosition.x}, ${targetPosition.y})`,
    };

    try {
      const result = await this.simulationEngine.executeSingleStep(step, ctx, this._build, stepNumber);

      if (result.success) {
        this._context.set(result.contextAfter);
        this.simulationService.appendInteractiveStep(result);
        const player = this.boardService.player();
        if (player) {
          this.boardService.updateEntityPosition(player.id, targetPosition);
        }
        console.log(`[InteractivePlay] Déplacement ${via} vers (${targetPosition.x}, ${targetPosition.y})`);
      } else {
        const err = result.actions.find(a => !a.success)?.message ?? 'Déplacement impossible';
        console.warn('[InteractivePlay] Déplacement échoué:', err);
        this.simulationService.appendInteractiveStep(result);
      }

      return result;
    } catch (e) {
      console.error('[InteractivePlay] Erreur lors du déplacement:', e);
      return null;
    }
  }

  /**
   * Met à jour la position physique du joueur sur le board si le contexte
   * après exécution indique une nouvelle position
   */
  private syncPlayerPositionFromContext(ctx: SimulationContext): void {
    const player = this.boardService.player();
    if (!player) return;
    const ctxPlayer = ctx.entities?.find(e => e.type === 'player');
    if (!ctxPlayer) return;
    if (ctxPlayer.position.x !== player.position.x || ctxPlayer.position.y !== player.position.y) {
      this.boardService.updateEntityPosition(player.id, ctxPlayer.position);
      console.log(`[InteractivePlay] Position joueur synchronisée: (${ctxPlayer.position.x}, ${ctxPlayer.position.y})`);
    }
  }

  /**
   * Synchronise les mécanismes créés par la stratégie de classe dans le contexte
   * vers le BoardService (pour l'affichage visuel)
   */
  private syncMechanismsFromContext(ctx: SimulationContext, spellId: string): void {
    if (!ctx.mechanisms) return;

    const mechanismType = getSpellMechanismType(spellId);
    if (!mechanismType) return;

    for (const ctxMech of ctx.mechanisms) {
      if (ctxMech.type !== mechanismType) continue;

      const existing = this.boardService.getMechanism(ctxMech.id);
      if (existing) {
        if (existing.charges !== ctxMech.charges) {
          this.boardService.updateMechanismCharges(ctxMech.id, ctxMech.charges ?? 0);
        }
      } else {
        this.boardService.addMechanism(ctxMech);
        console.log(`[InteractivePlay] Mécanisme ${ctxMech.type} ajouté à (${ctxMech.position.x}, ${ctxMech.position.y})`);
      }
    }
  }

  /** Retourne le nombre de PA restants */
  get availablePa(): number { return this._context()?.availablePa ?? 0; }

  /** Retourne le nombre de PW restants */
  get availablePw(): number { return this._context()?.availablePw ?? 0; }

  /** Retourne le nombre de MP restants */
  get availableMp(): number { return this._context()?.availableMp ?? 0; }
}

