/**
 * Enemy Form Component
 * Modal for adding/editing enemies on the board
 */

import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface EnemyForm {
  name: string;
  facing: 'front' | 'back' | 'side';
}

@Component({
  selector: 'app-enemy-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen()" (click)="onClose()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>👿 {{ editMode() ? 'Modifier' : 'Ajouter' }} un Ennemi</h2>
          <button class="close" (click)="onClose()">✕</button>
        </div>

        <div class="modal-body">
          <form (ngSubmit)="onSubmit()">
            <div class="form-section">
              <div class="form-group">
                <label>Nom de l'ennemi *</label>
                <input
                  type="text"
                  [(ngModel)]="form.name"
                  name="name"
                  placeholder="ex: Boss Final"
                  required
                />
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
              <button type="submit" class="btn-primary" [disabled]="!form.name.trim()">
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
      background: linear-gradient(135deg, rgba(239, 71, 111, 0.1), rgba(239, 71, 111, 0.05));
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
      color: #ef476f;
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
      border-color: #ef476f;
      box-shadow: 0 0 0 3px rgba(239, 71, 111, 0.1);
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
      background: #ef476f;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #ff5a80;
      box-shadow: 0 4px 12px rgba(239, 71, 111, 0.3);
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
      border-color: #ef476f;
    }
  `]
})
export class EnemyFormComponent {
  isOpen = signal(false);
  editMode = signal(false);
  editingId = signal<string | null>(null);
  editingPosition = signal<{ x: number; y: number } | null>(null);

  form: EnemyForm = {
    name: '',
    facing: 'front'
  };

  enemyAdded = output<{ name: string; facing: { direction: string } }>();  enemyEdited = output<{ id: string; name: string; position: { x: number; y: number }; facing: { direction: string } }>();

  openNew(): void {
    this.editMode.set(false);
    this.editingId.set(null);
    this.editingPosition.set(null);
    this.resetForm();
    this.isOpen.set(true);
  }

  openEdit(enemy: { id: string; name: string; position: { x: number; y: number }; facing: { direction: string } }): void {
    this.editMode.set(true);
    this.editingId.set(enemy.id);
    this.form = {
      name: enemy.name,
      facing: enemy.facing.direction as any
    };
    this.isOpen.set(true);
  }

  onClose(): void {
    this.isOpen.set(false);
    this.editingPosition.set(null);
    this.resetForm();
  }

  onSubmit(): void {
    if (!this.form.name.trim()) {
      return;
    }

    const data = {
      name: this.form.name.trim(),
      facing: { direction: this.form.facing }
    };

    if (this.editMode() && this.editingId()) {
      this.enemyEdited.emit({
        id: this.editingId()!,
        position: this.editingPosition() || { x: 6, y: 6 },
        ...data
      });
    } else {
      this.enemyAdded.emit(data);
    }

    this.onClose();
  }

  private resetForm(): void {
    this.form = {
      name: '',
      facing: 'front'
    };
  }
}

