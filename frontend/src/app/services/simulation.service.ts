/**
 * Simulation Service - Frontend
 * Gère les simulations en utilisant le moteur local (pas de backend)
 * Toute la logique de simulation est gérée côté frontend
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { SimulationEngineService, SimulationResult } from './calculators/simulation-engine.service';
import { BuildService } from './build.service';
import { TimelineService } from './timeline.service';
import { BoardService } from './board.service';
import { Build } from '../models/build.model';
import { Timeline, TimelineAction, Position } from '../models/timeline.model';
import { Mechanism } from '../models/board.model';
import { getSpellMechanismType } from '../utils/mechanism-utils';

@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  private readonly currentSimulation = signal<SimulationResult | null>(null);
  private readonly isSimulating = signal<boolean>(false);
  private readonly simulationError = signal<string | null>(null);

  // 🆕 Stocker les résultats de simulation pour navigation step-by-step
  private simulationResultsCache: SimulationResult | null = null;
  private currentTimelineId: string | null = null;
  private currentBuildId: string | null = null;

  public simulation = computed(() => this.currentSimulation());
  public isRunning = computed(() => this.isSimulating());
  public error = computed(() => this.simulationError());

  private readonly boardService = inject(BoardService);

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

  /**
   * Run simulation with custom build and timeline objects
   */
  async runSimulationDirect(build: Build, timeline: Timeline): Promise<SimulationResult | null> {
    this.isSimulating.set(true);
    this.simulationError.set(null);

    try {
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

  /**
   * Clear current simulation
   */
  clearSimulation(): void {
    this.currentSimulation.set(null);
    this.simulationError.set(null);
    this.simulationResultsCache = null;
    this.currentTimelineId = null;
    this.currentBuildId = null;
  }

  /**
   * 🆕 Exécute la simulation COMPLÈTE une seule fois et stocke les résultats
   * Utilisé au début pour calculer tous les steps
   */
  async runFullSimulation(build: Build, timeline: Timeline): Promise<SimulationResult | null> {
    console.log('');
    console.log('🚀 [SIMULATION SERVICE] Exécution de la simulation COMPLÈTE');
    console.log('📦 Build:', build.name);
    console.log('📋 Timeline:', timeline.name);
    console.log('🔢 Nombre d\'étapes:', timeline.steps.length);

    this.isSimulating.set(true);
    this.simulationError.set(null);

    try {
      // Exécuter toute la simulation d'un coup
      const result = await this.simulationEngine.runSimulation(build, timeline);

      // Stocker les résultats pour navigation ultérieure
      this.simulationResultsCache = result;
      this.currentTimelineId = timeline.id || '';
      this.currentBuildId = build.id || '';
      this.currentSimulation.set(result);

      console.log('✅ Simulation complète terminée:', {
        success: result.success,
        totalDamage: result.totalDamage,
        stepsExecuted: result.steps.length
      });

      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Simulation failed';
      this.simulationError.set(errorMessage);
      console.error('❌ Erreur simulation:', error);
      return null;
    } finally {
      this.isSimulating.set(false);
    }
  }

  /**
   * 🆕 Obtient le résultat d'un step spécifique depuis le cache
   */
  getStepResult(stepIndex: number): any | null {
    if (!this.simulationResultsCache) {
      return null;
    }

    if (stepIndex < 0 || stepIndex >= this.simulationResultsCache.steps.length) {
      return null;
    }

    return this.simulationResultsCache.steps[stepIndex];
  }

  /**
   * 🆕 Vérifie si la simulation est encore valide pour ce build/timeline
   */
  isSimulationValid(buildId: string, timelineId: string): boolean {
    return this.simulationResultsCache !== null
      && this.currentBuildId === buildId
      && this.currentTimelineId === timelineId;
  }

  /**
   * Execute a single step of the timeline
   * Valide et exécute un step spécifique en tenant compte de tous les steps précédents
   * Vérifie : ligne de vue, distance, AP/WP/MP disponibles
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
      // Si c'est le premier step ou si on n'a pas encore de cache, ou si le step demandé n'est pas dans le cache
      // alors on doit exécuter la simulation jusqu'à ce step
      const needsComputation = !this.simulationResultsCache ||
                               stepIndex === 0 ||
                               !this.simulationResultsCache.steps[stepIndex];

      if (needsComputation) {
        console.log('🔄 Exécution de la simulation depuis le début jusqu\'au step', stepIndex + 1);

        // Créer une timeline partielle avec tous les steps jusqu'à celui-ci inclus
        const partialTimeline: Timeline = {
          ...timeline,
          steps: timeline.steps.slice(0, stepIndex + 1)
        };

        // Exécuter la simulation partielle
        const result = await this.simulationEngine.runSimulation(build, partialTimeline);

        // Mettre à jour le cache
        this.simulationResultsCache = result;
        this.currentTimelineId = timeline.id || '';
        this.currentBuildId = build.id || '';

        // Vérifier le résultat du step demandé
        const stepResult = result.steps[stepIndex];

        if (!stepResult || !stepResult.success) {
          const failedAction = stepResult?.actions.find((a: any) => !a.success);
          console.error('❌ [executeStep] Step échoué:', failedAction?.message || 'Erreur inconnue');
          return false;
        }

        console.log('✅ [executeStep] Step validé avec succès');

        // Traiter les actions pour créer les mécanismes visuels
        const step = timeline.steps[stepIndex];
        for (const action of step.actions) {
          await this.processAction(action, build, stepIndex);
        }

        return true;
      } else {
        // Utiliser le cache existant
        console.log('📦 [executeStep] Utilisation des résultats en cache');

        const stepResult = this.simulationResultsCache!.steps[stepIndex];

        if (!stepResult || !stepResult.success) {
          const failedAction = stepResult?.actions.find((a: any) => !a.success);
          console.error('❌ [executeStep] Step échoué (depuis cache):', failedAction?.message || 'Erreur inconnue');
          return false;
        }

        console.log('✅ [executeStep] Step validé avec succès (depuis cache)');

        // Traiter les actions pour créer les mécanismes visuels
        const step = timeline.steps[stepIndex];
        for (const action of step.actions) {
          await this.processAction(action, build, stepIndex);
        }

        return true;
      }
    } catch (error) {
      console.error('💥 [executeStep] Erreur lors de l\'exécution du step:', error);
      return false;
    }
  }

  /**
   * Process a single action (create mechanisms, move entities, etc.)
   */
  private async processAction(action: TimelineAction, build: Build, stepIndex: number): Promise<void> {
    if (action.type === 'CastSpell' && action.spellId) {
      // Vérifier si le sort crée un mécanisme
      console.log(`🔍 Analyse du sort: "${action.spellId}"`);
      const mechanismType = getSpellMechanismType(action.spellId);
      console.log(`🎯 Type de mécanisme détecté: ${mechanismType || 'aucun'}`);

      if (mechanismType && action.targetPosition) {
        console.log(`✅ Création d'un mécanisme ${mechanismType} à la position (${action.targetPosition.x}, ${action.targetPosition.y})`);

        // Créer le mécanisme
        const mechanism: Mechanism = {
          id: `mechanism_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          type: mechanismType,
          position: action.targetPosition,
          charges: 0,
          turn: stepIndex + 1,
          spellId: action.spellId
        };

        // Ajouter le mécanisme au plateau
        this.boardService.addMechanism(mechanism);
        console.log('🎉 Mécanisme créé et ajouté au plateau:', mechanism);

        // Si c'est un cadran, créer les 12 heures autour (orientées selon la direction du lancer)
        if (mechanismType === 'dial') {
          // Récupérer la position du joueur
          const playerEntity = this.boardService.player();
          const playerPosition = playerEntity?.position || { x: 6, y: 6 };

          this.createDialHours(mechanism.id, action.targetPosition, playerPosition);
        }
      } else if (mechanismType && !action.targetPosition) {
        console.warn('⚠️ Mécanisme détecté mais pas de targetPosition!');
      } else {
        console.log('ℹ️ Ce sort ne crée pas de mécanisme');
      }
    }
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

