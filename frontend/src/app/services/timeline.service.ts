/**
 * Timeline Service - IMPLEMENTATION
 * Gère l'état des timelines et combos via le backend
 */

import { Injectable, signal, computed } from '@angular/core';
import {Timeline, TimelineStep, ComboPreset, TimelineAction} from '../models/timeline.model';
import { WakfuApiService } from './wakfu-api.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TimelineService {
  // State Signals
  private timelines = signal<Timeline[]>([]);
  private comboPresets = signal<ComboPreset[]>([]);
  public currentTimelineId = signal<string | null>(null);
  public currentStepIndex = signal<number>(0);
  private isLoading = signal<boolean>(false);
  private loadError = signal<string | null>(null);

  // Computed
  public allTimelines = computed(() => this.timelines());
  public allPresets = computed(() => this.comboPresets());
  public loading = computed(() => this.isLoading());
  public error = computed(() => this.loadError());

  public currentTimeline = computed(() => {
    const id = this.currentTimelineId();
    return id ? this.timelines().find(t => t.id === id) || null : null;
  });

  public currentStep = computed(() => {
    const timeline = this.currentTimeline();
    const index = this.currentStepIndex();
    return timeline && index < timeline.steps.length ? timeline.steps[index] : null;
  });

  constructor(private api: WakfuApiService) {
    // Charger depuis le backend au démarrage
    this.loadFromBackend();
  }

  /**
   * Persist timelines to localStorage
   */
  private saveToPersistence(): void {
    try {
      localStorage.setItem('wakfu_timelines', JSON.stringify(this.timelines()));
    } catch (e) {
      console.warn('Failed to save timelines to localStorage', e);
    }
  }

  /**
   * Load timelines from localStorage
   */
  private loadFromPersistence(): void {
    try {
      const stored = localStorage.getItem('wakfu_timelines');
      if (stored) {
        const parsed = JSON.parse(stored) as Timeline[];
        this.timelines.set(parsed);
      }
    } catch (e) {
      console.warn('Failed to load timelines from localStorage', e);
    }
  }

  /**
   * Charger les timelines depuis le backend
   */
  async loadFromBackend(buildId?: string): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);

    // Charger d'abord depuis localStorage
    this.loadFromPersistence();

    try {
      const backendTimelines = await firstValueFrom(this.api.getAllTimelines(buildId));
      this.timelines.set(backendTimelines);
      this.saveToPersistence();
      console.log('✅ Timelines chargées depuis le backend:', backendTimelines.length);

      // Si aucune timeline n'est chargée et qu'on n'a pas de currentTimeline, on peut initialiser avec une timeline mock
      if (backendTimelines.length === 0 && this.timelines().length === 0) {
        console.warn('⚠️ Aucune timeline trouvée, utilisation de données mock');
        await this.initializeMockData();
      }
    } catch (error: any) {
      const errorMsg = `Erreur de chargement depuis le backend: ${error.message}`;
      this.loadError.set(errorMsg);
      console.error('❌', errorMsg);
      console.warn('⚠️ Utilisation des timelines depuis localStorage');
      // Les timelines de localStorage sont déjà chargées

      // Si toujours pas de timeline, initialiser avec des données mock
      if (this.timelines().length === 0) {
        console.warn('⚠️ Initialisation avec des données mock');
        await this.initializeMockData();
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Initialize with mock data (fallback uniquement)
   */
  private async initializeMockData(): Promise<void> {
    const mockTimeline: Timeline = {
      id: 'timeline_1',
      name: 'Combo Xélor Test',
      buildId: 'build_1',
      steps: [
        {
          id: 'step_1',
          actions: [
            {
              id: 'action_1',
              type: 'CastSpell',
              order: 1,
              spellId: 'vol_du_temps',
              targetPosition: { x: 8, y: 10 },
              details: { damage: 420 },
              tags: ['Spell']
            }
          ],
          description: 'Cast Vol du Temps on enemy'
        },
        {
          id: 'step_2',
          actions: [
            {
              id: 'action_2',
              type: 'CastSpell',
              order: 1,
              spellId: 'rouage',
              targetPosition: { x: 7, y: 10 },
              details: { mechanism: 'gear', charges: 0 },
              tags: ['Mechanism']
            }
          ],
          description: 'Place Rouage'
        }
      ],
      createdAt: new Date()
    };

    // Tenter de créer sur le backend
    try {
      const created = await firstValueFrom(this.api.createTimeline(mockTimeline));
      this.timelines.set([created]);
      this.currentTimelineId.set(created.id);
      this.saveToPersistence();
      console.log('✅ Timeline mock créée sur le backend:', created.id);
    } catch (error) {
      // Si erreur backend, garder en local seulement
      this.timelines.set([mockTimeline]);
      this.currentTimelineId.set('timeline_1');
      this.saveToPersistence();
      console.warn('⚠️ Timeline mock gardée en local uniquement');
    }
  }

  // ============ Helper Methods ============

  /**
   * Prépare une timeline pour l'envoi au backend
   * Convertit les objets Date en ISO strings
   */
  private prepareTimelineForBackend(timeline: Timeline): any {
    return {
      ...timeline,
      createdAt: timeline.createdAt ? new Date(timeline.createdAt).toISOString() : undefined,
      updatedAt: timeline.updatedAt ? new Date(timeline.updatedAt).toISOString() : undefined
    };
  }

  /**
   * Convertit une timeline reçue du backend en objet Timeline
   */
  private parseTimelineFromBackend(data: any): Timeline {
    return {
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined
    };
  }

  // ============ Timeline CRUD ============

  public async createTimeline(timeline: Timeline): Promise<Timeline | null> {
    // Ajouter immédiatement au state local
    this.timelines.update(tls => [...tls, timeline]);
    this.saveToPersistence();
    console.log('✅ Timeline créée localement:', timeline.id);

    // Tenter de synchroniser avec le backend en arrière-plan
    try {
      const timelineForBackend = this.prepareTimelineForBackend(timeline);
      const created = await firstValueFrom(this.api.createTimeline(timelineForBackend));
      const parsedTimeline = this.parseTimelineFromBackend(created);

      // Remplacer par la version backend si elle diffère
      this.timelines.update(tls =>
        tls.map(t => t.id === timeline.id ? parsedTimeline : t)
      );
      this.saveToPersistence();
      console.log('✅ Timeline synchronisée avec le backend:', created.id);
      return parsedTimeline;
    } catch (error) {
      console.warn('⚠️ Impossible de synchroniser avec le backend, timeline gardée en local:', error);
      return timeline; // Retourner la timeline locale même si backend échoue
    }
  }

  public async updateTimeline(timelineId: string, updates: Partial<Timeline>): Promise<Timeline | null> {
    const existingTimeline = this.getTimelineById(timelineId);
    if (!existingTimeline) {
      console.error('❌ Timeline introuvable:', timelineId);
      return null;
    }

    const updatedTimeline = { ...existingTimeline, ...updates, updatedAt: new Date() };

    // Mettre à jour immédiatement en local
    this.timelines.update(tls =>
      tls.map(t => t.id === timelineId ? updatedTimeline : t)
    );
    this.saveToPersistence();
    console.log('✅ Timeline mise à jour localement:', timelineId);

    // Tenter de synchroniser avec le backend en arrière-plan
    try {
      const timelineForBackend = this.prepareTimelineForBackend(updatedTimeline);
      const updated = await firstValueFrom(this.api.updateTimeline(timelineId, timelineForBackend));
      const parsedTimeline = this.parseTimelineFromBackend(updated);

      this.timelines.update(tls =>
        tls.map(t => t.id === timelineId ? parsedTimeline : t)
      );
      this.saveToPersistence();
      console.log('✅ Timeline synchronisée avec le backend:', timelineId);
      return parsedTimeline;
    } catch (error) {
      console.warn('⚠️ Impossible de synchroniser avec le backend, timeline gardée en local:', error);
      return updatedTimeline; // Retourner la timeline locale même si backend échoue
    }
  }

  public async deleteTimeline(timelineId: string): Promise<boolean> {
    // Supprimer immédiatement en local
    this.timelines.update(tls => tls.filter(t => t.id !== timelineId));

    if (this.currentTimelineId() === timelineId) {
      this.currentTimelineId.set(null);
      this.currentStepIndex.set(0);
    }
    this.saveToPersistence();
    console.log('✅ Timeline supprimée localement:', timelineId);

    // Tenter de synchroniser avec le backend en arrière-plan
    try {
      await firstValueFrom(this.api.deleteTimeline(timelineId));
      console.log('✅ Timeline supprimée du backend:', timelineId);
      return true;
    } catch (error) {
      console.warn('⚠️ Impossible de synchroniser avec le backend, timeline supprimée en local:', error);
      return true; // Retourner true car la suppression locale a réussi
    }
  }

  public getTimelineById(timelineId: string): Timeline | undefined {
    return this.timelines().find(t => t.id === timelineId);
  }

  // ============ Timeline Loading ============

  public loadTimeline(timelineId: string): void {
    // Check if timeline exists
    const timeline = this.timelines().find(t => t.id === timelineId);
    if (timeline) {
      this.currentTimelineId.set(timelineId);
      this.currentStepIndex.set(0);
      console.log('✅ Timeline loaded:', timelineId);
    } else {
      console.warn('⚠️ Timeline not found:', timelineId);
      console.log('Available timelines:', this.timelines().map(t => t.id));
    }
  }

  // ============ Step Management ============

  public async addStep(step: TimelineStep): Promise<void> {
    const timeline = this.currentTimeline();
    if (!timeline) return;

    const updatedSteps = [...timeline.steps, step];
    await this.updateTimeline(timeline.id, { steps: updatedSteps });
  }

  public async updateStep(stepIndex: number, updates: Partial<TimelineStep>): Promise<void> {
    const timeline = this.currentTimeline();
    if (!timeline) return;

    const newSteps = [...timeline.steps];
    if (stepIndex >= 0 && stepIndex < newSteps.length) {
      newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates };
      await this.updateTimeline(timeline.id, { steps: newSteps });
    }
  }

  public async removeStep(stepIndex: number): Promise<void> {
    const timeline = this.currentTimeline();
    if (!timeline) return;

    const newSteps = timeline.steps.filter((_, i) => i !== stepIndex);
    await this.updateTimeline(timeline.id, { steps: newSteps });

    // Adjust current step if needed
    if (this.currentStepIndex() >= newSteps.length) {
      this.currentStepIndex.set(Math.max(0, newSteps.length - 1));
    }
  }

  public async reorderStep(fromIndex: number, toIndex: number): Promise<void> {
    const timeline = this.currentTimeline();
    if (!timeline) return;

    const newSteps = [...timeline.steps];
    const [removed] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, removed);
    await this.updateTimeline(timeline.id, { steps: newSteps });
  }

  // ============ Navigation ============

  public nextStep(): void {
    const timeline = this.currentTimeline();
    if (timeline && this.currentStepIndex() < timeline.steps.length) {
      this.currentStepIndex.update(i => i + 1);
    }
  }

  public previousStep(): void {
    if (this.currentStepIndex() > 0) {
      this.currentStepIndex.update(i => i - 1);
    }
  }

  public resetTimeline(): void {
    this.currentStepIndex.set(0);
  }

  /**
   * Exécute l'étape courante de la timeline
   * Retourne les actions exécutées
   */
  public executeCurrentStep(): TimelineAction[] {
    const step = this.currentStep();
    if (!step) {
      console.warn('⚠️ Aucune étape à exécuter');
      return [];
    }

    console.log('▶️ Exécution de l\'étape:', step.id);
    return step.actions;
  }

  public async clearSteps(): Promise<void> {
    const timeline = this.currentTimeline();
    if (timeline) {
      await this.updateTimeline(timeline.id, { steps: [] });
      this.currentStepIndex.set(0);
    }
  }

  // ============ Validation ============

  public validateTimeline(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const timeline = this.currentTimeline();

    if (!timeline) {
      return { valid: false, errors: ['No timeline loaded'] };
    }

    if (timeline.steps.length === 0) {
      errors.push('Timeline has no steps');
    }

    // Basic validation: check for duplicate spell IDs in same turn
    const spellCounts = new Map<string, number>();
    timeline.steps.forEach((step, stepIndex) => {
      step.actions.forEach(action => {
        if (action.type === 'CastSpell' && action.spellId) {
          const count = (spellCounts.get(action.spellId) || 0) + 1;
          spellCounts.set(action.spellId, count);
          if (count > 1) {
            errors.push(`Spell ${action.spellId} appears multiple times (step ${stepIndex + 1})`);
          }
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ============ Presets ============

  public saveAsPreset(name: string, description?: string, tags?: string[]): ComboPreset {
    const timeline = this.currentTimeline();
    if (!timeline) throw new Error('No timeline loaded');

    const preset: ComboPreset = {
      id: `preset_${Date.now()}`,
      name,
      description: description || '',
      timeline: { ...timeline },
      classId: '', // Will be filled from context
      tags: tags || [],
      createdAt: new Date()
    };

    this.comboPresets.update(presets => [...presets, preset]);
    return preset;
  }

  public loadPreset(presetId: string): void {
    const preset = this.comboPresets().find(p => p.id === presetId);
    if (preset) {
      this.currentTimelineId.set(preset.timeline.id);
      this.currentStepIndex.set(0);
    }
  }

  public deletePreset(presetId: string): void {
    this.comboPresets.update(presets => presets.filter(p => p.id !== presetId));
  }

  // ============ Clear ============

  public clearCurrentTimeline(): void {
    this.currentTimelineId.set(null);
    this.currentStepIndex.set(0);
  }

  // ============ Export/Import ============

  public exportTimeline(timelineId: string): string {
    const timeline = this.timelines().find(t => t.id === timelineId);
    if (!timeline) throw new Error('Timeline not found');
    return JSON.stringify(timeline, null, 2);
  }

  public async importTimeline(jsonString: string): Promise<Timeline | null> {
    try {
      const timeline = JSON.parse(jsonString) as Timeline;
      return await this.createTimeline(timeline);
    } catch (e) {
      throw new Error('Invalid JSON format');
    }
  }
}

