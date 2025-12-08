/**
 * Spell Modal Component
 * Displays available spells for selection and drag-drop to spell bar
 */

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Spell } from '../../models/spell.model';

@Component({
  selector: 'app-spell-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onClose()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Sélectionner les sorts</h2>
          <button class="close" (click)="onClose()">✕</button>
        </div>

        <div class="modal-body">
          <input
            type="text"
            placeholder="Rechercher un sort..."
            [(ngModel)]="searchQuery"
            class="search-input"
          />

          <div class="spell-grid">
            <div
              class="spell-card"
              *ngFor="let spell of filteredSpells()"
              draggable="true"
              (dragstart)="onDragStart($event, spell)"
              [class.selected]="isSelected(spell.id)"
            >
              <div class="spell-icon">{{ spell.name.charAt(0) }}</div>
              <div class="spell-info">
                <b>{{ spell.name }}</b>
                <span class="spell-meta">
                  ⚡ {{ spell.paCost || 0 }} PA • 💠 {{ spell.pwCost || 0 }} PW • 🎯 Range: {{ spell.poMax }} • 📊 Total: {{ (spell.paCost || 0) + (spell.pwCost || 0) }}
                </span>
                <span class="spell-desc">{{ spell.description }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="ghost" (click)="onClose()">Fermer</button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './spell-modal.component.css'
})
export class SpellModalComponent {
  searchQuery = signal('');

  // Mock data - à remplacer par un service
  availableSpells: Spell[] = [
    {
      id: 'vol_du_temps',
      name: 'Vol du temps',
      classId: 'XEL',
      spellType: 'damage',
      element: 'fire',
      paCost: 2,
      pwCost: 0,
      poMin: 1,
      poMax: 3,
      poModifiable: true,
      lineOfSight: true,
      cooldown: 0,
      usePerTurn: 0,
      usePerTarget: 0,
      direction: 'any',
      ratioEvalMode: 'standard',
      variants: [],
      breakpoints: [],
      description: 'Inflige des dégâts, pose Cadran'
    },
    {
      id: 'rouage',
      name: 'Rouage',
      classId: 'XEL',
      spellType: 'mechanism',
      element: 'time',
      paCost: 2,
      pwCost: 1,
      poMin: 0,
      poMax: 2,
      poModifiable: true,
      lineOfSight: false,
      cooldown: 0,
      usePerTurn: 0,
      usePerTarget: 0,
      direction: 'any',
      ratioEvalMode: 'standard',
      variants: [],
      breakpoints: [],
      description: 'Pose un rouage sur la carte'
    },
    {
      id: 'distorsion',
      name: 'Distorsion',
      classId: 'XEL',
      spellType: 'utility',
      element: 'time',
      paCost: 2,
      pwCost: 1,
      poMin: 0,
      poMax: 1,
      poModifiable: false,
      lineOfSight: false,
      cooldown: 0,
      usePerTurn: 0,
      usePerTarget: 0,
      direction: 'any',
      ratioEvalMode: 'standard',
      variants: [],
      breakpoints: [],
      description: 'Transpose et augmente les dégâts'
    }
  ];

  selectedSpellIds = signal<string[]>([]);

  filteredSpells = () => {
    const query = this.searchQuery().toLowerCase();
    return this.availableSpells.filter(spell =>
      spell.name.toLowerCase().includes(query) ||
      (spell.description?.toLowerCase().includes(query) ?? false)
    );
  };

  isSelected(spellId: string): boolean {
    return this.selectedSpellIds().includes(spellId);
  }

  onDragStart(event: DragEvent, spell: Spell): void {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/json', JSON.stringify(spell));
    }
  }

  onClose(): void {
    // TODO: Emit close event or use dialog ref
  }
}

