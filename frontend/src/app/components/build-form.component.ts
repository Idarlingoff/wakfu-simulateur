/**
 * Build Form Component
 * Form for creating and editing builds
 */

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BuildService } from '../services/build.service';
import { Build, BuildStats, SpellReference, PassiveReference, Sublimation } from '../models/build.model';
import { SpellSelectorComponent } from './spell-selector.component';
import { PassiveSelectorComponent } from './passive-selector.component';
import { SublimationSelectorComponent } from './sublimation-selector.component';
import { removeInnateSpellsFromSelection } from '../utils/innate-spells.utils';

interface FormBuild {
  name: string;
  classId: string;
  characterLevel: number;
  description: string;
  stats: BuildStats;
  spells: (SpellReference | null)[];
  passives: (PassiveReference | null)[];
  sublimations: (Sublimation | null)[];
}

@Component({
  selector: 'app-build-form',
  standalone: true,
  imports: [CommonModule, FormsModule, SpellSelectorComponent, PassiveSelectorComponent, SublimationSelectorComponent],
  template: `
    <div class="modal-overlay" *ngIf="isOpen()" (click)="onClose()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ editingBuildId() ? 'Modifier Build' : 'Créer Build' }}</h2>
          <button class="close" (click)="onClose()">✕</button>
        </div>

        <div class="modal-body">
          <form (ngSubmit)="onSubmit()">
            <!-- Basic Info -->
            <div class="form-section">
              <h3>Informations de base</h3>

              <div class="form-group">
                <label>Nom du build *</label>
                <input
                  type="text"
                  [(ngModel)]="form.name"
                  name="name"
                  placeholder="ex: Xélor - Rouage Cycle"
                  required
                />
              </div>

              <div class="form-group">
                <label>Classe *</label>
                <select [(ngModel)]="form.classId" name="classId" required>
                  <option value="">-- Sélectionner --</option>
                  <option value="XEL">Xélor</option>
                  <option value="sacrier">Sacrier</option>
                  <option value="osamodas">Osamodas</option>
                  <option value="ecaflip">Écaflip</option>
                  <option value="enutrof">Enutrof</option>
                </select>
              </div>

              <div class="form-group">
                <label>Niveau du personnage *</label>
                <select [(ngModel)]="form.characterLevel" name="level" required>
                  <option value="">-- Sélectionner --</option>
                  <option *ngFor="let level of availableLevels" [value]="level">{{ level }}</option>
                </select>
              </div>

              <div class="form-group">
                <label>Description</label>
                <textarea
                  [(ngModel)]="form.description"
                  name="description"
                  placeholder="Description du build..."
                  rows="3"
                ></textarea>
              </div>
            </div>

            <!-- Sorts -->
            <div class="form-section">
              <app-spell-selector
                [classId]="form.classId"
                [selectedSpells]="form.spells"
                (spellsChange)="onSpellsChange($event)"
              ></app-spell-selector>
            </div>

            <!-- Passifs -->
            <div class="form-section">
              <app-passive-selector
                [classId]="form.classId"
                [characterLevel]="form.characterLevel"
                [selectedPassives]="form.passives"
                (passivesChange)="onPassivesChange($event)"
              ></app-passive-selector>
            </div>

            <!-- Sublimations -->
            <div class="form-section">
              <app-sublimation-selector
                [selectedSublimations]="form.sublimations"
                (sublimationsChange)="onSublimationsChange($event)"
              ></app-sublimation-selector>
            </div>

            <!-- Stats -->
            <div class="form-section">
              <h3>Statistiques</h3>

              <div class="stats-grid">
                <div class="form-group">
                  <label>Maîtrise Principale</label>
                  <input
                    type="number"
                    [(ngModel)]="form.stats.masteryPrimary"
                    name="masteryPrimary"
                    min="0"
                  />
                </div>

                <div class="form-group">
                  <label>Maîtrise Secondaire</label>
                  <input
                    type="number"
                    [(ngModel)]="form.stats.masterySecondary"
                    name="masterySecondary"
                    min="0"
                  />
                </div>

                <div class="form-group">
                  <label>Maîtrise Dos</label>
                  <input
                    type="number"
                    [(ngModel)]="form.stats.backMastery"
                    name="backMastery"
                    min="0"
                  />
                </div>

                <div class="form-group">
                  <label>Dégâts Infligés</label>
                  <input
                    type="number"
                    [(ngModel)]="form.stats.dommageInflict"
                    name="dommageInflict"
                    min="0"
                  />
                </div>

                <div class="form-group">
                  <label>Taux de Critique (%)</label>
                  <input
                    type="number"
                    [(ngModel)]="form.stats.critRate"
                    name="critRate"
                    min="0"
                    max="100"
                  />
                </div>

                <div class="form-group">
                  <label>Maîtrise Critique</label>
                  <input
                    type="number"
                    [(ngModel)]="form.stats.critMastery"
                    name="critMastery"
                    min="0"
                  />
                </div>

                <div class="form-group">
                  <label>Résistance</label>
                  <input
                    type="number"
                    [(ngModel)]="form.stats.resistance"
                    name="resistance"
                    min="0"
                  />
                </div>

                <div class="form-group">
                  <label>AP (Action Points)</label>
                  <input
                    type="number"
                    [(ngModel)]="form.stats.ap"
                    name="ap"
                    min="0"
                  />
                </div>

                <div class="form-group">
                  <label>MP (Movement Points)</label>
                  <input
                    type="number"
                    [(ngModel)]="form.stats.mp"
                    name="mp"
                    min="0"
                  />
                </div>

                <div class="form-group">
                  <label>WP (Power Points)</label>
                  <input
                    type="number"
                    [(ngModel)]="form.stats.wp"
                    name="wp"
                    min="0"
                  />
                </div>

                <div class="form-group">
                  <label>Portée</label>
                  <input
                    type="number"
                    [(ngModel)]="form.stats.range"
                    name="range"
                    min="0"
                  />
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="onClose()">Annuler</button>
              <button type="submit" class="btn-primary">
                {{ editingBuildId() ? 'Modifier' : 'Créer' }}
              </button>
              <button
                type="button"
                class="btn-danger"
                *ngIf="editingBuildId()"
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
      max-width: 600px;
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

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
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
export class BuildFormComponent {
  buildService = inject(BuildService);

  isOpen = signal(false);
  editingBuildId = signal<string | null>(null);

  // Niveaux disponibles pour la création de build
  readonly availableLevels = [20, 35, 50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 245];

  form: FormBuild = {
    name: '',
    classId: '',
    characterLevel: 185,
    description: '',
    stats: {
      level: 185,
      masteryPrimary: 0,
      masterySecondary: 0,
      backMastery: 0,
      dommageInflict: 0,
      critRate: 0,
      critMastery: 0,
      resistance: 0,
      ap: 12,
      mp: 3,
      wp: 0,
      range: 3
    },
    spells: new Array(12).fill(null),
    passives: new Array(6).fill(null),
    sublimations: new Array(12).fill(null)
  };

  /**
   * Open form for creating new build
   */
  openNew(): void {
    this.editingBuildId.set(null);
    this.form = {
      name: '',
      classId: '',
      characterLevel: 185,
      description: '',
      stats: {
        level: 185,
        masteryPrimary: 0,
        masterySecondary: 0,
        backMastery: 0,
        dommageInflict: 0,
        critRate: 0,
        critMastery: 0,
        resistance: 0,
        ap: 12,
        mp: 3,
        wp: 0,
        range: 3
      },
      spells: new Array(12).fill(null),
      passives: new Array(6).fill(null),
      sublimations: new Array(12).fill(null)
    };
    this.isOpen.set(true);
  }

  /**
   * Open form for editing existing build
   */
  openEdit(build: Build): void {
    this.editingBuildId.set(build.id);
    this.form = {
      name: build.name,
      classId: build.classId,
      characterLevel: build.characterLevel,
      description: build.description || '',
      stats: { ...build.stats },
      spells: removeInnateSpellsFromSelection(build.classId, [...build.spellBar.spells]),
      passives: [...build.passiveBar.passives],
      sublimations: [...build.sublimationBar.sublimations]
    };
    this.isOpen.set(true);
  }

  /**
   * Handle spells change
   */
  onSpellsChange(spells: (SpellReference | null)[]): void {
    this.form.spells = spells;
  }

  /**
   * Handle passives change
   */
  onPassivesChange(passives: (PassiveReference | null)[]): void {
    this.form.passives = passives;
  }

  /**
   * Handle sublimations change
   */
  onSublimationsChange(sublimations: (Sublimation | null)[]): void {
    this.form.sublimations = sublimations;
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (!this.form.name || !this.form.classId) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }

    console.log('[BuildForm] onSubmit - classId:', this.form.classId);

    if (this.editingBuildId()) {
      // Update existing build
      const sanitizedSpells = removeInnateSpellsFromSelection(this.form.classId, this.form.spells);
      const updates: Partial<Build> = {
        name: this.form.name,
        classId: this.form.classId,
        characterLevel: this.form.characterLevel,
        description: this.form.description,
        spellBar: { spells: sanitizedSpells },
        passiveBar: { passives: this.form.passives },
        sublimationBar: { sublimations: this.form.sublimations },
        stats: this.form.stats
      };
      console.log('[BuildForm] Mise à jour du build avec classId:', updates.classId);
      this.buildService.updateBuild(this.editingBuildId()!, updates);
      alert('Build modifié avec succès!');
    } else {
      // Create new build
      const sanitizedSpells = removeInnateSpellsFromSelection(this.form.classId, this.form.spells);
      const newBuild: Build = {
        id: `build_${Date.now()}`,
        name: this.form.name,
        classId: this.form.classId,
        characterLevel: this.form.characterLevel,
        description: this.form.description,
        spellBar: { spells: sanitizedSpells },
        passiveBar: { passives: this.form.passives },
        sublimationBar: { sublimations: this.form.sublimations },
        stats: this.form.stats,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      console.log('[BuildForm] Création du nouveau build avec classId:', newBuild.classId);
      this.buildService.createBuild(newBuild);
      alert('Build créé avec succès!');
    }

    this.onClose();
  }

  /**
   * Delete current build
   */
  onDelete(): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce build?')) {
      this.buildService.deleteBuild(this.editingBuildId()!);
      alert('Build supprimé!');
      this.onClose();
    }
  }

  /**
   * Close form
   */
  onClose(): void {
    this.isOpen.set(false);
    this.editingBuildId.set(null);
  }
}
