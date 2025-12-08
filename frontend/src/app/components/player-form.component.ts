/**
 * Player Form Component
 * Modal for adding players to the board
 */

import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface PlayerForm {
  name: string;
  classId: string;
  positionX: number;
  positionY: number;
  facing: 'front' | 'side' | 'right';
}

@Component({
  selector: 'app-player-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen()" (click)="onClose()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>🦸 Ajouter un Joueur</h2>
          <button class="close" (click)="onClose()">✕</button>
        </div>

        <div class="modal-body">
          <form (ngSubmit)="onSubmit()">
            <div class="form-section">
              <div class="form-group">
                <label>Classe *</label>
                <select [(ngModel)]="form.classId" name="classId" required>
                  <option value="">-- Sélectionner une classe --</option>
                  <option value="xelor">Xélor</option>
                  <option value="sacrier">Sacrier</option>
                  <option value="osamodas">Osamodas</option>
                  <option value="ecaflip">Écaflip</option>
                  <option value="enutrof">Enutrof</option>
                  <option value="eniripsa">Eniripsa</option>
                  <option value="iop">Iop</option>
                  <option value="cra">Crâ</option>
                  <option value="sadida">Sadida</option>
                  <option value="sram">Sram</option>
                  <option value="pandawa">Pandawa</option>
                  <option value="rogue">Roublard</option>
                  <option value="zobal">Zobal</option>
                  <option value="steamer">Steameur</option>
                  <option value="eliotrope">Éliotrope</option>
                  <option value="huppermage">Huppermage</option>
                  <option value="ouginak">Ouginak</option>
                </select>
              </div>

              <div class="form-group">
                <label>Nom du joueur (optionnel)</label>
                <input
                  type="text"
                  [(ngModel)]="form.name"
                  name="name"
                  placeholder="Laissez vide pour utiliser le nom de la classe"
                />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Position X *</label>
                  <input
                    type="number"
                    [(ngModel)]="form.positionX"
                    name="positionX"
                    min="0"
                    max="12"
                    required
                  />
                </div>

                <div class="form-group">
                  <label>Position Y *</label>
                  <input
                    type="number"
                    [(ngModel)]="form.positionY"
                    name="positionY"
                    min="0"
                    max="12"
                    required
                  />
                </div>
              </div>

              <div class="form-group">
                <label>Direction *</label>
                <select [(ngModel)]="form.facing" name="facing" required>
                  <option value="front">⬇️ Avant</option>
                  <option value="back">⬆️ Arrière</option>
                  <option value="side">⬅️➡️ Côté</option>
                </select>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="onClose()">
                Annuler
              </button>
              <button type="submit" class="btn-primary" [disabled]="!form.classId">
                {{ editMode() ? 'Modifier' : 'Ajouter' }}
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
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .modal {
      background: #181b22;
      border: 1px solid #2a2f3a;
      border-radius: 12px;
      width: 500px;
      max-width: 90vw;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #2a2f3a;
      background: linear-gradient(135deg, rgba(76, 201, 240, 0.1), rgba(90, 215, 240, 0.05));
    }

    .modal-header h2 {
      margin: 0;
      font-size: 20px;
      color: #e8ecf3;
    }

    .close {
      background: transparent;
      border: 1px solid #2a2f3a;
      color: #8c9bb3;
      font-size: 20px;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .close:hover {
      background: #ef476f;
      color: white;
      border-color: #ef476f;
    }

    .modal-body {
      padding: 20px;
      overflow-y: auto;
      max-height: calc(90vh - 140px);
    }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .form-group label {
      font-size: 13px;
      font-weight: 600;
      color: #4cc9f0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .form-group input,
    .form-group select {
      background: #1d2230;
      border: 1px solid #2a2f3a;
      color: #e8ecf3;
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 14px;
      transition: all 0.2s;
    }

    .form-group input:focus,
    .form-group select:focus {
      outline: none;
      border-color: #4cc9f0;
      box-shadow: 0 0 0 3px rgba(76, 201, 240, 0.1);
    }

    .form-group select {
      cursor: pointer;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #2a2f3a;
    }

    .btn-primary,
    .btn-secondary {
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .btn-primary {
      background: #4cc9f0;
      color: #0b1220;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5ad5f0;
      box-shadow: 0 4px 12px rgba(76, 201, 240, 0.3);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #253044;
      color: #e8ecf3;
      border: 1px solid #2a2f3a;
    }

    .btn-secondary:hover {
      background: #2c3a5a;
      border-color: #4cc9f0;
    }
  `]
})
export class PlayerFormComponent {
  isOpen = signal(false);
  editMode = signal(false);
  editingId = signal<string | null>(null);

  form: PlayerForm = {
    name: '',
    classId: '',
    positionX: 6,
    positionY: 6,
    facing: 'front'
  };

  playerAdded = output<{ name: string; classId: string; position: { x: number; y: number }; facing: { direction: string } }>();
  playerEdited = output<{ id: string; name: string; classId: string; position: { x: number; y: number }; facing: { direction: string } }>();

  openNew(): void {
    this.editMode.set(false);
    this.editingId.set(null);
    this.resetForm();
    this.isOpen.set(true);
  }

  openEdit(player: { id: string; name: string; classId: string; position: { x: number; y: number }; facing: { direction: string } }): void {
    this.editMode.set(true);
    this.editingId.set(player.id);
    this.form = {
      name: player.name,
      classId: player.classId,
      positionX: player.position.x,
      positionY: player.position.y,
      facing: player.facing.direction as any
    };
    this.isOpen.set(true);
  }

  onClose(): void {
    this.isOpen.set(false);
    this.resetForm();
  }

  onSubmit(): void {
    if (!this.form.classId) {
      return;
    }

    console.log('[PlayerForm] onSubmit - classId:', this.form.classId);

    // Use class name if no custom name provided (only for new players)
    const name = this.editMode()
      ? this.form.name.trim()
      : (this.form.name.trim() || this.getClassName(this.form.classId));

    const data = {
      name,
      classId: this.form.classId,
      position: { x: this.form.positionX, y: this.form.positionY },
      facing: { direction: this.form.facing }
    };

    if (this.editMode() && this.editingId()) {
      console.log('[PlayerForm] Édition du joueur avec classId:', data.classId);
      this.playerEdited.emit({
        id: this.editingId()!,
        ...data
      });
    } else {
      console.log('[PlayerForm] Ajout du nouveau joueur avec classId:', data.classId);
      this.playerAdded.emit(data);
    }

    this.onClose();
  }

  private resetForm(): void {
    this.form = {
      name: '',
      classId: '',
      positionX: 6,
      positionY: 6,
      facing: 'front'
    };
  }

  private getClassName(classId: string): string {
    const classNames: { [key: string]: string } = {
      'xelor': 'Xélor',
      'sacrier': 'Sacrier',
      'osamodas': 'Osamodas',
      'ecaflip': 'Écaflip',
      'enutrof': 'Enutrof',
      'eniripsa': 'Eniripsa',
      'iop': 'Iop',
      'cra': 'Crâ',
      'sadida': 'Sadida',
      'sram': 'Sram',
      'pandawa': 'Pandawa',
      'rogue': 'Roublard',
      'zobal': 'Zobal',
      'steamer': 'Steameur',
      'eliotrope': 'Éliotrope',
      'huppermage': 'Huppermage',
      'ouginak': 'Ouginak'
    };
    return classNames[classId] || classId;
  }
}

