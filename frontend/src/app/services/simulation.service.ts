import { Injectable, signal, computed } from '@angular/core';
import {
  SimulationEngineService,
  SimulationResult,
  SimulationStepResult
} from './calculators/simulation-engine.service';import { BuildService } from './build.service';
import { TimelineService } from './timeline.service';
import { Build } from '../models/build.model';
import { Timeline } from '../models/timeline.model';

@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  private readonly currentSimulation = signal<SimulationResult | null>(null);
  private readonly isSimulating = signal<boolean>(false);
  private readonly simulationError = signal<string | null>(null);

  private simulationResultsCache: SimulationResult | null = null;
  private currentTimelineId: string | null = null;
  private currentBuildId: string | null = null;

  public simulation = computed(() => this.currentSimulation());
  public isRunning = computed(() => this.isSimulating());
  public error = computed(() => this.simulationError());

  constructor(
    private readonly simulationEngine: SimulationEngineService,
    private readonly buildService: BuildService,
    private readonly timelineService: TimelineService
  ) {}

  async runSimulation(buildId: string, timelineId: string): Promise<SimulationResult | null> {
    this.isSimulating.set(true);
    this.simulationError.set(null);

    try {
      const build = this.buildService.allBuilds().find(b => b.id === buildId);
      const timeline = this.timelineService.allTimelines().find(t => t.id === timelineId);

      if (!build) {
        throw new Error(`Build not found: ${buildId}`);
      }

      if (!timeline) {
        throw new Error(`Timeline not found: ${timelineId}`);
      }

      const result = await this.simulationEngine.runSimulation(build, timeline);
      this.currentSimulation.set(result);

      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Simulation failed';
      this.simulationError.set(errorMessage);
      console.error('Simulation error:', error);
      return null;
    } finally {
      this.isSimulating.set(false);
    }
  }

  clearSimulation(): void {
    this.currentSimulation.set(null);
    this.simulationError.set(null);
    this.simulationResultsCache = null;
    this.currentTimelineId = null;
    this.currentBuildId = null;
  }

  /**
   * Recalcule les totaux agrégés (dégâts/coûts) à partir d'une liste de steps
   */
  private aggregateStepTotals(steps: SimulationStepResult[]): Pick<SimulationResult, 'totalDamage' | 'totalPaUsed' | 'totalPwUsed' | 'totalMpUsed'> {
    return steps.reduce(
      (totals, step) => {
        for (const action of step.actions) {
          totals.totalDamage += action.damage || 0;
          totals.totalPaUsed += action.paCost || 0;
          totals.totalPwUsed += action.pwCost || 0;
          totals.totalMpUsed += action.mpCost || 0;
        }

        return totals;
      },
      {
        totalDamage: 0,
        totalPaUsed: 0,
        totalPwUsed: 0,
        totalMpUsed: 0
      }
    );
  }

  /**
   * Tronque le cache de simulation pour revenir à un index donné
   * stepIndex représente le prochain step à exécuter (0 = aucun step exécuté)
   */
  trimSimulationCacheToStep(stepIndex: number): void {
    if (!this.simulationResultsCache) {
      return;
    }

    const boundedStepIndex = Math.max(0, stepIndex);
    const trimmedSteps = this.simulationResultsCache.steps.slice(0, boundedStepIndex);
    const contextAfterTrim = boundedStepIndex > 0
      ? trimmedSteps[trimmedSteps.length - 1].contextAfter
      : this.simulationResultsCache.initialContext;

    const totals = this.aggregateStepTotals(trimmedSteps);

    this.simulationResultsCache = {
      ...this.simulationResultsCache,
      steps: trimmedSteps,
      finalContext: contextAfterTrim,
      ...totals,
      success: trimmedSteps.every(step => step.success),
      errors: []
    };

    console.log(`🧹 [SimulationService] Cache tronqué à ${boundedStepIndex} step(s)`);
  }

  /**
   * Obtient le résultat d'un step spécifique depuis le cache
   */
  getStepResult(stepIndex: number): SimulationStepResult | null {
    if (!this.simulationResultsCache) {
      return null;
    }

    if (stepIndex < 0 || stepIndex >= this.simulationResultsCache.steps.length) {
      return null;
    }

    return this.simulationResultsCache.steps[stepIndex];
  }

  private isCacheValid(build: Build, timeline: Timeline): boolean {
    return this.simulationResultsCache !== null &&
      this.currentTimelineId === (timeline.id || '') &&
      this.currentBuildId === (build.id || '');
  }

  private async executeStepUsingIncrementalCache(build: Build, timeline: Timeline, stepIndex: number): Promise<void> {
    const step = timeline.steps[stepIndex];
    const previousContext = this.simulationResultsCache!.finalContext;

    const stepResult = await this.simulationEngine.executeSingleStep(
      step,
      previousContext,
      build,
      stepIndex + 1
    );

    this.simulationResultsCache!.steps.push(stepResult);
    this.simulationResultsCache!.finalContext = stepResult.contextAfter;

    const totals = this.aggregateStepTotals([stepResult]);
    this.simulationResultsCache!.totalDamage += totals.totalDamage;
    this.simulationResultsCache!.totalPaUsed += totals.totalPaUsed;
    this.simulationResultsCache!.totalPwUsed += totals.totalPwUsed;
    this.simulationResultsCache!.totalMpUsed += totals.totalMpUsed;

    if (!stepResult.success) {
      this.simulationResultsCache!.success = false;
      this.simulationResultsCache!.errors.push(
        `Step ${stepIndex + 1} failed: ${stepResult.actions.find(a => !a.success)?.message}`
      );
    }

    console.log(`✅ Cache étendu avec le step ${stepIndex + 1}`);
  }

  private async executeStepFromScratch(build: Build, timeline: Timeline, stepIndex: number): Promise<void> {
    console.log(`🔄 Exécution de la simulation depuis le début jusqu'au step ${stepIndex + 1}`);

    const partialTimeline: Timeline = {
      ...timeline,
      steps: timeline.steps.slice(0, stepIndex + 1)
    };

    const result = await this.simulationEngine.runSimulation(build, partialTimeline);

    this.simulationResultsCache = result;
    this.currentTimelineId = timeline.id || '';
    this.currentBuildId = build.id || '';

    console.log(`✅ Cache initialisé avec ${result.steps.length} steps`);
  }

  private validateExecutedStep(stepIndex: number): boolean {
    const stepResult = this.simulationResultsCache!.steps[stepIndex];

    if (!stepResult || !stepResult.success) {
      const failedAction = stepResult?.actions.find(a => !a.success);
      console.error('❌ [executeStep] Step échoué:', failedAction?.message || 'Erreur inconnue');
      return false;
    }

    console.log('✅ [executeStep] Step validé avec succès');
    return true;
  }

  /**
   * Execute un step de la timeline
   * Valide et exécute un step spécifique en tenant compte de tous les steps précédents
   * Retourne true si le step réussit, false sinon
   */
  async executeStep(build: Build, timeline: Timeline, stepIndex: number): Promise<boolean> {
    if (stepIndex < 0 || stepIndex >= timeline.steps.length) {
      console.error('Index d\'étape invalide:', stepIndex);
      return false;
    }

    console.log('');
    console.log('🎯 [executeStep] Exécution et validation du step', stepIndex + 1);

    try {
      const cacheIsValid = this.isCacheValid(build, timeline);

      const cacheHasThisStep = cacheIsValid && this.simulationResultsCache!.steps.length > stepIndex;

      const cacheHasPreviousSteps = cacheIsValid && this.simulationResultsCache!.steps.length === stepIndex;

      if (cacheHasThisStep) {
        console.log('📦 [executeStep] Utilisation des résultats en cache');
      } else if (cacheHasPreviousSteps) {
        console.log(`🔄 [executeStep] Exécution incrémentale du step ${stepIndex + 1} uniquement`);

        await this.executeStepUsingIncrementalCache(build, timeline, stepIndex);
      } else {
        await this.executeStepFromScratch(build, timeline, stepIndex);
      }

      return this.validateExecutedStep(stepIndex);
    } catch (error) {
      console.error('💥 [executeStep] Erreur lors de l\'exécution du step:', error);
      return false;
    }
  }

  getSimulationStats() {
    const sim = this.currentSimulation();
    if (!sim) return null;

    const totalActions = sim.steps.reduce((acc, step) => acc + step.actions.length, 0);
    const successfulActions = sim.steps.reduce(
      (acc, step) => acc + step.actions.filter(a => a.success).length,
      0
    );
    const failedActions = totalActions - successfulActions;

    return {
      totalActions,
      successfulActions,
      failedActions,
      totalPaUsed: sim.totalPaUsed,
      totalPwUsed: sim.totalPwUsed,
      totalMpUsed: sim.totalMpUsed,
      totalDamage: sim.totalDamage,
      remainingPa: sim.finalContext.availablePa,
      remainingPw: sim.finalContext.availablePw,
      remainingMp: sim.finalContext.availableMp,
      hasFailure: !sim.success
    };
  }
}

