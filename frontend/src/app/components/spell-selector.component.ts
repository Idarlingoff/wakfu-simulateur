/**
 * Spell Selector Component
 * Permet de sélectionner des sorts pour un build
 */

import { Component, Input, Output, EventEmitter, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpellWithLevel, Spell } from '../models/spell.model';
import { SpellReference } from '../models/build.model';
import { DataCacheService } from '../services/data-cache.service';

@Component({
  selector: 'app-spell-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="spell-selector">
      <div class="selector-header">
        <h4>Sorts ({{ countSelected() }}/12)</h4>
        <button type="button" class="btn-open" (click)="openModal()">
          ⚔️ Gérer les sorts
        </button>
      </div>

      <!-- Modal de sélection de sorts -->
      @if (pickerOpen()) {
        <div class="picker-overlay" (click)="closePicker()">
          <div class="picker-modal" (click)="$event.stopPropagation()">
            <div class="picker-header">
              <h3>Choisir les sorts</h3>
              <button (click)="closePicker()">✕</button>
            </div>

            <div class="picker-body">
              <!-- Slots de sorts -->
              <div class="spell-slots-section">
                <h4>Barre de sorts ({{ countSelected() }}/12)</h4>
                <div class="spell-bar">
                  @for (spell of selectedSpells; track $index; let i = $index) {
                    <div class="spell-slot" [class.filled]="spell !== null">
                      @if (spell) {
                        <div class="spell-card" (click)="removeSpell(i)">
                          <span class="spell-icon">✨</span>
                          <span class="spell-name">{{ getSpellName(spell.spellId) }}</span>
                          <button class="remove-btn" title="Retirer">✕</button>
                        </div>
                      } @else {
                        <div class="empty-slot" (click)="openSpellPicker(i)">
                          <span>+</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Recherche -->
              <div class="picker-search">
                <input
                  type="text"
                  [(ngModel)]="searchQuery"
                  placeholder="Rechercher un sort..."
                  (input)="filterSpells()"
                />
              </div>

              <!-- Liste des sorts -->
              <div class="spell-list-section">
                @if (loading()) {
                  <div class="loading">Chargement des sorts...</div>
                } @else if (filteredSpells().length === 0) {
                  <div class="no-results">Aucun sort trouvé</div>
                } @else {
                  <div class="spell-grid">
                    @for (spell of filteredSpells(); track spell.id) {
                      <div class="spell-item" (click)="selectSpell(spell)">
                        <div class="spell-icon-large">✨</div>
                        <div class="spell-info">
                          <div class="spell-title">{{ spell.name }}</div>
                          <div class="spell-meta">
                            <span class="cost-pa">⚡ {{ spell.paCost || 0 }} PA</span>
                            <span class="cost-pw">💠 {{ spell.pwCost || 0 }} PW</span>
                            <span class="cost-total">📊 {{ (spell.paCost || 0) + (spell.pwCost || 0) }}</span>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .spell-selector {
      margin-bottom: 16px;
    }

    .selector-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    h4 {
      font-size: 14px;
      color: var(--accent);
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .btn-open {
      background: var(--accent);
      color: #0b1220;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-open:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .spell-slots-section {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 2px solid var(--stroke);
    }

    .spell-slots-section h4 {
      margin-bottom: 12px;
    }

    .picker-search {
      margin-bottom: 16px;
    }

    .picker-search input {
      width: 100%;
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 14px;
    }

    .spell-list-section {
      border-top: 2px solid var(--stroke);
      padding-top: 16px;
    }

    .spell-bar {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }

    .spell-slot {
      aspect-ratio: 1;
      border: 1px solid var(--stroke);
      border-radius: 8px;
      overflow: hidden;
    }

    .spell-card {
      width: 100%;
      height: 100%;
      background: var(--panel-2);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      cursor: pointer;
      position: relative;
      transition: all 0.2s;
    }

    .spell-card:hover {
      background: var(--panel);
      border-color: var(--accent);
    }

    .spell-icon {
      font-size: 24px;
    }

    .spell-name {
      font-size: 10px;
      color: #e8ecf3;
      text-align: center;
      padding: 0 4px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .remove-btn {
      position: absolute;
      top: 2px;
      right: 2px;
      background: var(--bad);
      color: white;
      border: none;
      border-radius: 4px;
      width: 20px;
      height: 20px;
      font-size: 12px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .spell-card:hover .remove-btn {
      opacity: 1;
    }

    .empty-slot {
      width: 100%;
      height: 100%;
      background: var(--panel-2);
      border: 2px dashed var(--stroke);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 24px;
      color: var(--muted);
    }

    .empty-slot:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--panel);
    }

    .picker-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .picker-modal {
      background: var(--panel);
      border: 1px solid var(--stroke);
      border-radius: 16px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .picker-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--stroke);
    }

    .picker-header h3 {
      margin: 0;
      color: #cfe3ff;
    }

    .picker-header button {
      background: transparent;
      border: none;
      color: #e8ecf3;
      font-size: 20px;
      cursor: pointer;
    }

    .picker-search {
      padding: 16px;
      border-bottom: 1px solid var(--stroke);
    }

    .picker-search input {
      width: 100%;
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 14px;
    }

    .picker-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .loading, .no-results {
      text-align: center;
      color: var(--muted);
      padding: 32px;
    }

    .spell-grid {
      display: grid;
      gap: 8px;
    }

    .spell-item {
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .spell-item:hover {
      background: var(--panel);
      border-color: var(--accent);
    }

    .spell-icon-large {
      font-size: 32px;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--panel);
      border-radius: 8px;
    }

    .spell-info {
      flex: 1;
    }

    .spell-title {
      font-size: 14px;
      color: #e8ecf3;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .spell-meta {
      display: flex;
      gap: 8px;
      font-size: 11px;
      color: var(--muted);
      flex-wrap: wrap;
    }

    .spell-meta .cost-pa {
      color: #4cc9f0;
      font-weight: 600;
    }

    .spell-meta .cost-pw {
      color: #b983ff;
      font-weight: 600;
    }

    .spell-meta .cost-total {
      color: var(--accent);
      font-weight: 700;
      background: rgba(76, 201, 240, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
    }
  `]
})
export class SpellSelectorComponent {
  @Input() classId: string = '';
  @Input() selectedSpells: (SpellReference | null)[] = new Array(12).fill(null);
  @Output() spellsChange = new EventEmitter<(SpellReference | null)[]>();

  private dataCache = inject(DataCacheService);

  pickerOpen = signal(false);
  currentSlotIndex = signal(-1);
  loading = signal(false);
  allSpells = signal<SpellWithLevel[]>([]);
  filteredSpells = signal<SpellWithLevel[]>([]);
  searchQuery = '';

  constructor() {
    // Recharger les sorts quand la classe change
    effect(() => {
      const classId = this.classId;
      if (classId && this.pickerOpen()) {
        this.loadSpells();
      }
    });
  }

  openModal(): void {
    this.pickerOpen.set(true);
    this.loadSpells();
  }

  async openSpellPicker(slotIndex: number): Promise<void> {
    this.currentSlotIndex.set(slotIndex);
  }

  closePicker(): void {
    this.pickerOpen.set(false);
    this.searchQuery = '';
  }

  async loadSpells(): Promise<void> {
    this.loading.set(true);
    try {
      // Charger les sorts depuis le cache
      const spells = await this.dataCache.getSpells(this.classId || undefined);

      // Convertir en SpellWithLevel (level par défaut à 1)
      const spellsWithLevel: SpellWithLevel[] = spells.map(spell => ({
        ...spell,
        level: 1
      }));

      this.allSpells.set(spellsWithLevel);
      this.filterSpells();
    } catch (error) {
      console.error('Erreur chargement sorts:', error);
      // En cas d'erreur, utiliser des données par défaut vides
      this.allSpells.set([]);
      this.filteredSpells.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  filterSpells(): void {
    const query = this.searchQuery.toLowerCase();
    const filtered = this.allSpells().filter(spell =>
      spell.name.toLowerCase().includes(query) ||
      spell.id.toLowerCase().includes(query)
    );
    this.filteredSpells.set(filtered);
  }

  selectSpell(spell: SpellWithLevel): void {
    const index = this.currentSlotIndex();
    let targetIndex = index >= 0 ? index : this.findFirstEmptySlot();

    if (targetIndex === -1) {
      alert('Tous les emplacements sont remplis');
      return;
    }

    if (targetIndex >= 0 && targetIndex < this.selectedSpells.length) {
      const newSpells = [...this.selectedSpells];
      newSpells[targetIndex] = {
        spellId: spell.id,
        level: spell.level,
        icon: spell.icon
      };
      this.spellsChange.emit(newSpells);
      this.currentSlotIndex.set(-1);
    }
  }

  findFirstEmptySlot(): number {
    return this.selectedSpells.indexOf(null);
  }

  countSelected(): number {
    return this.selectedSpells.filter(s => s !== null).length;
  }

  removeSpell(index: number): void {
    const newSpells = [...this.selectedSpells];
    newSpells[index] = null;
    this.spellsChange.emit(newSpells);
  }

  getSpellName(spellId: string): string {
    const spell = this.allSpells().find(s => s.id === spellId);
    return spell?.name || spellId;
  }
}

