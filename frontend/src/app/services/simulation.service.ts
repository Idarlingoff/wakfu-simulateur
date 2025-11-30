/**
 * Simulation Service - Frontend
 * Gère les simulations en utilisant le moteur local (pas de backend)
 * Toute la logique de simulation est gérée côté frontend
 */

import { Injectable, signal, computed } from '@angular/core';
import { SimulationEngineService, SimulationResult } from './calculators/simulation-engine.service';
import { BuildService } from './build.service';
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

  public simulation = computed(() => this.currentSimulation());
  public isRunning = computed(() => this.isSimulating());
  public error = computed(() => this.simulationError());

  constructor(
    private readonly simulationEngine: SimulationEngineService,
    private readonly buildService: BuildService,
    private readonly timelineService: TimelineService
  ) {}

  /**
   * Run a simulation using local engine (no backend call)
   */
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

      const result = this.simulationEngine.runSimulation(build, timeline);
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

  /**
   * Run simulation with custom build and timeline objects
   */
  runSimulationDirect(build: Build, timeline: Timeline): SimulationResult | null {
    this.isSimulating.set(true);
    this.simulationError.set(null);

    try {
      const result = this.simulationEngine.runSimulation(build, timeline);
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

  /**
   * Clear current simulation
   */
  clearSimulation(): void {
    this.currentSimulation.set(null);
    this.simulationError.set(null);
  }

  /**
   * Execute a single step of the timeline
   * Useful for step-by-step execution
   */
  async executeStep(build: Build, timeline: Timeline, stepIndex: number): Promise<boolean> {
    if (stepIndex < 0 || stepIndex >= timeline.steps.length) {
      console.error('❌ Index d\'étape invalide:', stepIndex);
      return false;
    }

    try {
      const step = timeline.steps[stepIndex];
      console.log(`▶️ Exécution de l'étape ${stepIndex + 1}:`, step.description || step.id);

      // Pour l'instant, on exécute juste l'action via le simulationEngine
      // qui met à jour le plateau pour les déplacements
      // TODO: Garder un contexte entre les étapes pour les PA/PW/MP
      const result = this.simulationEngine.runSimulation(build, {
        ...timeline,
        steps: [step] // Exécuter seulement cette étape
      });

      if (result.success) {
        console.log('✅ Étape exécutée avec succès');
        return true;
      } else {
        console.error('❌ Échec de l\'exécution de l\'étape:', result.errors);
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'exécution de l\'étape:', error);
      return false;
    }
  }

  /**
   * Get simulation statistics
   */
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

