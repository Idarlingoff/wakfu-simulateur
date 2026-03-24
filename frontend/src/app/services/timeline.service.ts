/**
 * Timeline Service - Mode statique (localStorage)
 * Gère l'état des timelines et combos en local uniquement
 */

import { Injectable, signal, computed } from '@angular/core';
import { Timeline, TimelineStep, ComboPreset, TimelineAction } from '../models/timeline.model';
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
    this.loadTimelines();
  }

  /**
   * Charge les timelines depuis le localStorage (via WakfuApiService)
   */
  async loadTimelines(buildId?: string): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);
    try {
      const timelines = await firstValueFrom(this.api.getAllTimelines(buildId));
      this.timelines.set(timelines);
    } catch (e: any) {
      this.loadError.set(e.message);
    } finally {
      this.isLoading.set(false);
    }
  }

  // ============ Timeline CRUD ============

  public async createTimeline(timeline: Timeline): Promise<Timeline | null> {
    const created = await firstValueFrom(this.api.createTimeline(timeline));
    this.timelines.update(tls => [...tls, created]);
    return created;
  }

  public async updateTimeline(timelineId: string, updates: Partial<Timeline>): Promise<Timeline | null> {
    const existing = this.getTimelineById(timelineId);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    await firstValueFrom(this.api.updateTimeline(timelineId, updated));
    this.timelines.update(tls => tls.map(t => t.id === timelineId ? updated : t));
    return updated;
  }

  public async deleteTimeline(timelineId: string): Promise<boolean> {
    await firstValueFrom(this.api.deleteTimeline(timelineId));
    this.timelines.update(tls => tls.filter(t => t.id !== timelineId));
    if (this.currentTimelineId() === timelineId) {
      this.currentTimelineId.set(null);
      this.currentStepIndex.set(0);
    }
    return true;
  }

  public getTimelineById(timelineId: string): Timeline | undefined {
    return this.timelines().find(t => t.id === timelineId);
  }

  // ============ Timeline Loading ============

  public loadTimeline(timelineId: string): void {
    const timeline = this.timelines().find(t => t.id === timelineId);
    if (timeline) {
      this.currentTimelineId.set(timelineId);
      this.currentStepIndex.set(0);
    } else {
      console.warn('Timeline not found:', timelineId);
    }
  }

  // ============ Step Management ============

  public async addStep(step: TimelineStep): Promise<void> {
    const timeline = this.currentTimeline();
    if (!timeline) return;
    await this.updateTimeline(timeline.id, { steps: [...timeline.steps, step] });
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

  public async swapSteps(indexA: number, indexB: number): Promise<void> {
    const timeline = this.currentTimeline();
    if (!timeline) return;
    if (indexA < 0 || indexA >= timeline.steps.length || indexB < 0 || indexB >= timeline.steps.length) return;
    const newSteps = [...timeline.steps];
    [newSteps[indexA], newSteps[indexB]] = [newSteps[indexB], newSteps[indexA]];
    await this.updateTimeline(timeline.id, { steps: newSteps });
  }

  public async moveStepUp(index: number): Promise<void> {
    if (index <= 0) return;
    await this.swapSteps(index, index - 1);
  }

  public async moveStepDown(index: number): Promise<void> {
    const timeline = this.currentTimeline();
    if (!timeline || index >= timeline.steps.length - 1) return;
    await this.swapSteps(index, index + 1);
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

  public executeCurrentStep(): TimelineAction[] {
    const step = this.currentStep();
    if (!step) return [];
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
    if (!timeline) return { valid: false, errors: ['No timeline loaded'] };
    if (timeline.steps.length === 0) errors.push('Timeline has no steps');

    const spellCounts = new Map<string, number>();
    timeline.steps.forEach((step, stepIndex) => {
      step.actions.forEach(action => {
        if (action.type === 'CastSpell' && action.spellId) {
          const count = (spellCounts.get(action.spellId) || 0) + 1;
          spellCounts.set(action.spellId, count);
          if (count > 1) errors.push(`Spell ${action.spellId} appears multiple times (step ${stepIndex + 1})`);
        }
      });
    });

    return { valid: errors.length === 0, errors };
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
      classId: '',
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

