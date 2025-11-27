/**
 * Timeline Service - IMPLEMENTATION
 * Gère l'état des timelines et combos
 */

import { Injectable, signal, computed } from '@angular/core';
import { Timeline, TimelineStep, ComboPreset } from '../models/timeline.model';

@Injectable({
  providedIn: 'root'
})
export class TimelineService {
  // State Signals
  private timelines = signal<Timeline[]>([]);
  private comboPresets = signal<ComboPreset[]>([]);
  public currentTimelineId = signal<string | null>(null);  // ← Now PUBLIC
  public currentStepIndex = signal<number>(0);  // ← Now PUBLIC

  // Computed
  public allTimelines = computed(() => this.timelines());
  public allPresets = computed(() => this.comboPresets());

  public currentTimeline = computed(() => {
    const id = this.currentTimelineId();
    return id ? this.timelines().find(t => t.id === id) || null : null;
  });

  public currentStep = computed(() => {
    const timeline = this.currentTimeline();
    const index = this.currentStepIndex();
    return timeline && index < timeline.steps.length ? timeline.steps[index] : null;
  });

  constructor() {
    this.initializeMockData();
  }

  /**
   * Initialize with mock data
   */
  private initializeMockData(): void {
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

    this.timelines.set([mockTimeline]);
    this.currentTimelineId.set('timeline_1');
  }

  // ============ Timeline CRUD ============

  public createTimeline(timeline: Timeline): Timeline {
    const newTimeline: Timeline = {
      ...timeline,
      id: timeline.id || `timeline_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.timelines.update(tls => [...tls, newTimeline]);
    return newTimeline;
  }

  public updateTimeline(timelineId: string, updates: Partial<Timeline>): void {
    this.timelines.update(tls =>
      tls.map(t =>
        t.id === timelineId ? { ...t, ...updates, updatedAt: new Date() } : t
      )
    );
  }

  public deleteTimeline(timelineId: string): void {
    this.timelines.update(tls => tls.filter(t => t.id !== timelineId));
    if (this.currentTimelineId() === timelineId) {
      this.currentTimelineId.set(null);
      this.currentStepIndex.set(0);
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

  public addStep(step: TimelineStep): void {
    this.currentTimelineId.update(id => {
      if (!id) return id;
      this.updateTimeline(id, {
        steps: [...(this.currentTimeline()?.steps || []), step]
      });
      return id;
    });
  }

  public updateStep(stepIndex: number, updates: Partial<TimelineStep>): void {
    const timeline = this.currentTimeline();
    if (!timeline) return;

    const newSteps = [...timeline.steps];
    if (stepIndex >= 0 && stepIndex < newSteps.length) {
      newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates };
      this.updateTimeline(timeline.id, { steps: newSteps });
    }
  }

  public removeStep(stepIndex: number): void {
    const timeline = this.currentTimeline();
    if (!timeline) return;

    const newSteps = timeline.steps.filter((_, i) => i !== stepIndex);
    this.updateTimeline(timeline.id, { steps: newSteps });

    // Adjust current step if needed
    if (this.currentStepIndex() >= newSteps.length) {
      this.currentStepIndex.set(Math.max(0, newSteps.length - 1));
    }
  }

  public reorderStep(fromIndex: number, toIndex: number): void {
    const timeline = this.currentTimeline();
    if (!timeline) return;

    const newSteps = [...timeline.steps];
    const [removed] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, removed);
    this.updateTimeline(timeline.id, { steps: newSteps });
  }

  // ============ Navigation ============

  public nextStep(): void {
    const timeline = this.currentTimeline();
    if (timeline && this.currentStepIndex() < timeline.steps.length - 1) {
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

  public clearSteps(): void {
    const timeline = this.currentTimeline();
    if (timeline) {
      this.updateTimeline(timeline.id, { steps: [] });
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

  public importTimeline(jsonString: string): Timeline {
    try {
      const timeline = JSON.parse(jsonString) as Timeline;
      return this.createTimeline(timeline);
    } catch (e) {
      throw new Error('Invalid JSON format');
    }
  }
}

