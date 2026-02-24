/**
 * Timeline Form Component
 * Form for creating and editing timelines with spell sequences
 */

import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimelineService } from '../services/timeline.service';
import { BuildService } from '../services/build.service';
import { BoardService } from '../services/board.service';
import { DataCacheService } from '../services/data-cache.service';
import { Timeline, TimelineStep } from '../models/timeline.model';
import { Spell } from '../models/spell.model';
import {buildSpellReferencesWithInnates, canonicalizeInnateSpellId} from '../utils/innate-spells.utils';

interface FormStep {
  id: string;
  actionType: 'CastSpell' | 'Move' | 'Transpose' | 'ChangeFacing';
  spellId: string;
  entityId?: string; // ID de l'entité à déplacer (optionnel, par défaut = joueur)
  targetX: number;
  targetY: number;
  facing: 'front' | 'side' | 'back';
  description: string;
}

@Component({
  selector: 'app-timeline-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen()" (click)="onClose()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ editingTimelineId() ? 'Modifier Timeline' : 'Créer Timeline' }}</h2>
          <button class="close" (click)="onClose()">✕</button>
        </div>

        <div class="modal-body">
          <form (ngSubmit)="onSubmit()">
            <!-- Basic Info -->
            <div class="form-section">
              <h3>Informations de base</h3>

              <div class="form-group">
                <label>Nom de la timeline *</label>
                <input
                  type="text"
                  [(ngModel)]="form.name"
                  name="name"
                  placeholder="ex: Combo Xélor - Rouage Cycle"
                  required
                />
              </div>

              <div class="form-group">
                <label>Build associé *</label>
                <select [ngModel]="selectedBuildId()" (ngModelChange)="selectedBuildId.set($event)" name="buildId" required>
                  <option value="">-- Sélectionner --</option>
                  <option *ngFor="let build of buildService.allBuilds()" [value]="build.id">
                    {{ build.name }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label>Description</label>
                <textarea
                  [(ngModel)]="form.description"
                  name="description"
                  placeholder="Description de la timeline..."
                  rows="2"
                ></textarea>
              </div>
            </div>

            <!-- Steps/Spells Sequence -->
            <div class="form-section">
              <h3>Séquence de sorts</h3>

              <div class="steps-list">
                <div *ngFor="let step of steps; let i = index" class="step-card">
                  <div class="step-header">
                    <span class="step-number">Étape {{ i + 1 }}</span>
                    <div class="step-actions">
                      <button
                        type="button"
                        (click)="onMoveStepUp(i)"
                        class="btn-move"
                        [disabled]="i === 0"
                        title="Monter l'étape">
                        ▲
                      </button>
                      <button
                        type="button"
                        (click)="onMoveStepDown(i)"
                        class="btn-move"
                        [disabled]="i === steps.length - 1"
                        title="Descendre l'étape">
                        ▼
                      </button>
                      <button
                        type="button"
                        (click)="onRemoveStep(i)"
                        class="btn-remove"
                        title="Supprimer l'étape">
                        ✕
                      </button>
                    </div>
                  </div>

                  <div class="step-form">
                    <div class="form-row">
                      <div class="form-group">
                        <label>Type d'action</label>
                        <select [(ngModel)]="step.actionType" [name]="'actionType_' + i">
                          <option value="CastSpell">Lancer sort</option>
                          <option value="Move">Déplacement</option>
                          <option value="Transpose">Transposition</option>
                          <option value="ChangeFacing">Changer direction</option>
                        </select>
                      </div>

                      <div class="form-group" *ngIf="step.actionType === 'Move' || step.actionType === 'Transpose'">
                        <label>Entité à déplacer</label>
                        <select [(ngModel)]="step.entityId" [name]="'entity_' + i">
                          <option value="">🧙 Joueur (par défaut)</option>
                          <option *ngFor="let entity of getEntities()" [value]="entity.id">
                            {{ entity.type === 'player' ? '🧙' : '👹' }} {{ entity.name }}
                          </option>
                        </select>
                      </div>

                      <div class="form-group" *ngIf="step.actionType === 'CastSpell'">
                        <label>Sort *</label>
                        <select [(ngModel)]="step.spellId" [name]="'spell_' + i" required>
                          <option value="">-- Sélectionner --</option>
                          <option *ngFor="let spell of getSpells()" [value]="spell.id">
                            {{ spell.name }}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div class="form-row">
                      <div class="form-group">
                        <label>Position cible - X</label>
                        <input
                          type="number"
                          [(ngModel)]="step.targetX"
                          [name]="'x_' + i"
                          min="0"
                          max="12"
                        />
                      </div>

                      <div class="form-group">
                        <label>Position cible - Y</label>
                        <input
                          type="number"
                          [(ngModel)]="step.targetY"
                          [name]="'y_' + i"
                          min="0"
                          max="12"
                        />
                      </div>

                      <div class="form-group">
                        <label>Direction</label>
                        <select [(ngModel)]="step.facing" [name]="'facing_' + i">
                          <option value="front">Face</option>
                          <option value="side">Côté</option>
                          <option value="back">Dos</option>
                        </select>
                      </div>
                    </div>

                    <div class="form-group">
                      <label>Description (optionnel)</label>
                      <input
                        type="text"
                        [(ngModel)]="step.description"
                        [name]="'desc_' + i"
                        placeholder="Notes sur cette action..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button type="button" (click)="onAddStep()" class="btn-add-step">
                ➕ Ajouter une étape
              </button>
            </div>

            <!-- Actions -->
            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="onClose()">Annuler</button>
              <button type="submit" class="btn-primary">
                {{ editingTimelineId() ? 'Modifier' : 'Créer' }}
              </button>
              <button
                type="button"
                class="btn-danger"
                *ngIf="editingTimelineId()"
                (click)="onDelete()"
              >
                Supprimer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: var(--panel);
      border: 1px solid var(--stroke);
      border-radius: 16px;
      width: 90%;
      max-width: 700px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--stroke);
    }

    .modal-header h2 {
      margin: 0;
      color: #cfe3ff;
      font-size: 18px;
    }

    .close {
      background: transparent;
      border: none;
      color: #e8ecf3;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .form-section {
      margin-bottom: 24px;
    }

    .form-section h3 {
      font-size: 14px;
      color: var(--accent);
      margin: 0 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .form-group {
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
    }

    .form-group label {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 6px;
      font-weight: 500;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      border-radius: 8px;
      padding: 8px 10px;
      font-family: inherit;
      font-size: 14px;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 8px rgba(76, 201, 240, 0.2);
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }

    .steps-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 400px;
      overflow-y: auto;
      margin-bottom: 12px;
    }

    .step-card {
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      border-radius: 12px;
      padding: 12px;
    }

    .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--stroke);
    }

    .step-number {
      font-weight: 600;
      color: var(--accent);
      font-size: 13px;
    }

    .step-actions {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .btn-move {
      background: transparent;
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s ease;
    }

    .btn-move:hover:not(:disabled) {
      background: var(--accent);
      color: #0b1220;
      border-color: var(--accent);
    }

    .btn-move:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .btn-remove {
      background: transparent;
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 14px;
    }

    .btn-remove:hover {
      background: var(--bad);
      color: white;
      border-color: var(--bad);
    }

    .step-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .btn-add-step {
      background: #253044;
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-add-step:hover {
      background: var(--accent);
      color: #0b1220;
      border-color: var(--accent);
    }

    .form-actions {
      display: flex;
      gap: 8px;
      padding-top: 16px;
      border-top: 1px solid var(--stroke);
      margin-top: 24px;
    }

    .btn-primary,
    .btn-secondary,
    .btn-danger {
      padding: 10px 16px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-primary {
      background: linear-gradient(135deg, #7aa2f7, #5ad7f0);
      color: #0b1220;
      flex: 1;
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    .btn-secondary {
      background: #253044;
      color: #e8ecf3;
      border: 1px solid var(--stroke);
    }

    .btn-secondary:hover {
      background: #2d3a4f;
    }

    .btn-danger {
      background: var(--bad);
      color: white;
    }

    .btn-danger:hover {
      opacity: 0.9;
    }
  `]
})
export class TimelineFormComponent {
  timelineService = inject(TimelineService);
  buildService = inject(BuildService);
  boardService = inject(BoardService);
  dataCacheService = inject(DataCacheService);

  isOpen = signal(false);
  editingTimelineId = signal<string | null>(null);
  enrichedSpells = signal<Spell[]>([]);
  selectedBuildId = signal<string>('');

  form = {
    name: '',
    description: ''
  };

  steps: FormStep[] = [];

  constructor() {
    // Charger les sorts enrichis quand le buildId change
    effect(() => {
      const buildId = this.selectedBuildId();
      if (buildId) {
        this.loadEnrichedSpells(buildId);
      } else {
        this.enrichedSpells.set([]);
      }
    });
  }

  /**
   * Open form for creating new timeline
   */
  openNew(): void {
    this.editingTimelineId.set(null);
    this.form = {
      name: '',
      description: ''
    };
    this.selectedBuildId.set('');
    this.steps = [];
    this.isOpen.set(true);
  }

  /**
   * Open form for editing existing timeline
   */
  openEdit(timeline: Timeline): void {
    this.editingTimelineId.set(timeline.id);
    this.form = {
      name: timeline.name,
      description: ''
    };
    this.selectedBuildId.set(timeline.buildId);

    // Convert timeline steps to form steps
    this.steps = timeline.steps.map((step) => {
      const action = step.actions[0]; // Get first action
      return {
        id: step.id,
        actionType: (action?.type || 'CastSpell') as any,
        spellId: canonicalizeInnateSpellId(action?.spellId || ''),
        entityId: action?.entityId || '', // Extraire l'entityId
        targetX: action?.targetPosition?.x || 0,
        targetY: action?.targetPosition?.y || 0,
        facing: action?.targetFacing?.direction || 'front',
        description: step.description || ''
      };
    });

    this.isOpen.set(true);
  }

  /**
   * Add new step to timeline
   */
  onAddStep(): void {
    this.steps.push({
      id: `action_${Date.now()}`,
      actionType: 'CastSpell',
      spellId: '',
      entityId: '', // Par défaut vide = joueur
      targetX: 6,
      targetY: 10,
      facing: 'front',
      description: ''
    });
  }

  /**
   * Remove step from timeline
   */
  onRemoveStep(index: number): void {
    this.steps.splice(index, 1);
  }

  /**
   * Move step up (swap with previous step)
   */
  onMoveStepUp(index: number): void {
    if (index <= 0) return;
    // Créer un nouveau tableau avec des copies des objets pour forcer la détection de changement
    const newSteps = this.steps.map(step => ({ ...step }));
    // Swap les éléments
    const temp = newSteps[index];
    newSteps[index] = newSteps[index - 1];
    newSteps[index - 1] = temp;
    this.steps = newSteps;
  }

  /**
   * Move step down (swap with next step)
   */
  onMoveStepDown(index: number): void {
    if (index >= this.steps.length - 1) return;
    // Créer un nouveau tableau avec des copies des objets pour forcer la détection de changement
    const newSteps = this.steps.map(step => ({ ...step }));
    // Swap les éléments
    const temp = newSteps[index];
    newSteps[index] = newSteps[index + 1];
    newSteps[index + 1] = temp;
    this.steps = newSteps;
  }

  /**
   * Load enriched spells with full data from cache
   */
  private async loadEnrichedSpells(buildId: string): Promise<void> {
    console.log('Loading enriched spells for buildId:', buildId);
    const build = this.buildService.getBuildById(buildId);
    if (!build) {
      console.warn('Build not found:', buildId);
      this.enrichedSpells.set([]);
      return;
    }

    console.log('Build found:', build.name, '- Spell bar:', build.spellBar);
    const spellReferences = buildSpellReferencesWithInnates(build);
    console.log('Spell references found:', spellReferences.length);

    const enrichedSpellsPromises = spellReferences.map(async (ref) => {
      if (ref) {
        console.log('Fetching spell:', ref.spellId);
        return await this.dataCacheService.getSpellById(ref.spellId);
      }
      return undefined;
    });

    const spells = await Promise.all(enrichedSpellsPromises);
    const filteredSpells = spells.filter((s): s is Spell => s !== undefined);
    console.log('Enriched spells loaded:', filteredSpells.length, filteredSpells.map(s => s.name));
    this.enrichedSpells.set(filteredSpells);
  }

  /**
   * Get available spells from selected build
   */
  getSpells() {
    const spells = this.enrichedSpells();
    console.log('getSpells() called, returning:', spells.length, 'spells');
    return spells;
  }

  /**
   * Get all entities from board (players and enemies)
   */
  getEntities() {
    return this.boardService.state().entities;
  }

  /**
   * Handle form submission
   */
  async onSubmit(): Promise<void> {
    const buildId = this.selectedBuildId();
    if (!this.form.name || !buildId || this.steps.length === 0) {
      alert('Veuillez remplir les champs obligatoires et ajouter au moins une étape');
      return;
    }

    const timelineSteps: TimelineStep[] = this.steps.map((step, idx) => ({
      id: step.id,
      actions: [{
        id: `action_${idx}`,
        type: step.actionType,
        order: idx + 1,
        spellId: step.spellId ? canonicalizeInnateSpellId(step.spellId) : undefined,
        entityId: step.entityId || undefined, // Ajouter l'entité à déplacer
        targetPosition: { x: step.targetX, y: step.targetY },
        targetFacing: { direction: step.facing }
      }],
      description: step.description
    }));

    if (this.editingTimelineId()) {
      // Mode édition : mettre à jour uniquement les champs modifiés
      const updated = await this.timelineService.updateTimeline(this.editingTimelineId()!, {
        name: this.form.name,
        buildId: buildId,
        steps: timelineSteps
      });
      if (updated) {
        console.log('Timeline updated:', this.editingTimelineId());
        alert('Timeline modifiée avec succès!');
      } else {
        alert('Erreur lors de la modification de la timeline');
        return;
      }
    } else {
      // Mode création : créer une nouvelle timeline
      const timeline: Timeline = {
        id: `timeline_${Date.now()}`,
        name: this.form.name,
        buildId: buildId,
        steps: timelineSteps,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const created = await this.timelineService.createTimeline(timeline);
      if (created) {
        this.timelineService.loadTimeline(created.id);
        this.boardService.applyTimelineSetup(created.boardSetup);
        console.log('Timeline created and loaded:', created.id);
        alert('Timeline créée avec succès!');
      } else {
        alert('Erreur lors de la création de la timeline');
        return;
      }
    }

    this.onClose();
  }

  /**
   * Delete current timeline
   */
  async onDelete(): Promise<void> {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette timeline?')) {
      const deleted = await this.timelineService.deleteTimeline(this.editingTimelineId()!);
      if (deleted) {
        alert('Timeline supprimée!');
        this.onClose();
      } else {
        alert('Erreur lors de la suppression de la timeline');
      }
    }
  }

  /**
   * Close form
   */
  onClose(): void {
    this.isOpen.set(false);
    this.editingTimelineId.set(null);
  }
}
