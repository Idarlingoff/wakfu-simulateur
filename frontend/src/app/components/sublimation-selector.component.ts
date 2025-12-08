/**
 * Sublimation Selector Component
 * Permet de sélectionner des sublimations pour un build
 */

import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sublimation } from '../models/build.model';

@Component({
  selector: 'app-sublimation-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sublimation-selector">
      <div class="selector-header">
        <h4>Sublimations ({{ countSelected() }}/12)</h4>
        <button type="button" class="btn-open" (click)="openModal()">
          ✨ Gérer les sublimations
        </button>
      </div>

      <!-- Modal -->
      @if (modalOpen()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Sélection des Sublimations</h3>
              <button (click)="closeModal()">✕</button>
            </div>

            <div class="modal-body">
              <!-- Sublimations classiques -->
              <div class="sublimation-section">
                <h4>Sublimations Classiques ({{ countByRarity('classic') }}/10)</h4>
                <div class="sublimation-slots classic">
                  @for (subli of getClassicSlots(); track $index; let i = $index) {
                    <div class="sublimation-slot" [class.filled]="subli !== null">
                      @if (subli) {
                        <div class="sublimation-card classic" (click)="removeSublimation(i)">
                          <span class="sublimation-icon">💎</span>
                          <span class="sublimation-name">{{ subli.name }}</span>
                          <button class="remove-btn" title="Retirer">✕</button>
                        </div>
                      } @else {
                        <div class="empty-slot" (click)="selectSlot(i, 'classic')">
                          <span>+</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Sublimation épique -->
              <div class="sublimation-section">
                <h4>Sublimation Épique ({{ countByRarity('epic') }}/1)</h4>
                <div class="sublimation-slots">
                  <div class="sublimation-slot epic" [class.filled]="getEpicSlot() !== null">
                    @if (getEpicSlot(); as subli) {
                      <div class="sublimation-card epic" (click)="removeSublimation(10)">
                        <span class="sublimation-icon">💠</span>
                        <span class="sublimation-name">{{ subli.name }}</span>
                        <button class="remove-btn" title="Retirer">✕</button>
                      </div>
                    } @else {
                      <div class="empty-slot" (click)="selectSlot(10, 'epic')">
                        <span>+</span>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Sublimation relique -->
              <div class="sublimation-section">
                <h4>Sublimation Relique ({{ countByRarity('relic') }}/1)</h4>
                <div class="sublimation-slots">
                  <div class="sublimation-slot relic" [class.filled]="getRelicSlot() !== null">
                    @if (getRelicSlot(); as subli) {
                      <div class="sublimation-card relic" (click)="removeSublimation(11)">
                        <span class="sublimation-icon">🔶</span>
                        <span class="sublimation-name">{{ subli.name }}</span>
                        <button class="remove-btn" title="Retirer">✕</button>
                      </div>
                    } @else {
                      <div class="empty-slot" (click)="selectSlot(11, 'relic')">
                        <span>+</span>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Liste des sublimations disponibles -->
              <div class="available-section">
                <h4>Sublimations disponibles</h4>

                <div class="filter-tabs">
                  <button
                    [class.active]="filterRarity() === 'all'"
                    (click)="setFilterRarity('all')"
                  >Toutes</button>
                  <button
                    [class.active]="filterRarity() === 'classic'"
                    (click)="setFilterRarity('classic')"
                  >Classiques</button>
                  <button
                    [class.active]="filterRarity() === 'epic'"
                    (click)="setFilterRarity('epic')"
                  >Épiques</button>
                  <button
                    [class.active]="filterRarity() === 'relic'"
                    (click)="setFilterRarity('relic')"
                  >Reliques</button>
                </div>

                <div class="search-box">
                  <input
                    type="text"
                    [(ngModel)]="searchQuery"
                    placeholder="Rechercher une sublimation..."
                    (input)="filterSublimations()"
                  />
                </div>

                @if (loading()) {
                  <div class="loading">Chargement des sublimations...</div>
                } @else if (filteredSublimations().length === 0) {
                  <div class="no-results">Aucune sublimation trouvée</div>
                } @else {
                  <div class="sublimation-list">
                    @for (subli of filteredSublimations(); track subli.id) {
                      <div
                        class="sublimation-item"
                        [class.selected]="isSelected(subli.id)"
                        [class]="subli.rarity"
                        (click)="selectSublimation(subli)"
                      >
                        <div class="sublimation-icon-large">
                          {{ getRarityIcon(subli.rarity) }}
                        </div>
                        <div class="sublimation-info">
                          <div class="sublimation-title">{{ subli.name }}</div>
                          <div class="sublimation-rarity">{{ getRarityLabel(subli.rarity) }}</div>
                          @if (subli.description) {
                            <div class="sublimation-desc">{{ subli.description }}</div>
                          }
                          @if (Object.keys(subli.stats).length > 0) {
                            <div class="sublimation-stats">
                              @for (stat of Object.keys(subli.stats); track stat) {
                                <span class="stat">{{ stat }}: +{{ subli.stats[stat] }}</span>
                              }
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeModal()">Fermer</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .sublimation-selector {
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
      background: linear-gradient(135deg, #f093fb, #f5576c);
      color: white;
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

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal {
      background: var(--panel);
      border: 1px solid var(--stroke);
      border-radius: 16px;
      width: 90%;
      max-width: 600px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--stroke);
    }

    .modal-header h3 {
      margin: 0;
      color: #cfe3ff;
    }

    .modal-header button {
      background: transparent;
      border: none;
      color: #e8ecf3;
      font-size: 20px;
      cursor: pointer;
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .sublimation-section {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--stroke);
    }

    .sublimation-section h4 {
      margin-bottom: 12px;
    }

    .sublimation-slots {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
      gap: 12px;
    }

    .sublimation-slot {
      border: 1px solid var(--stroke);
      border-radius: 8px;
      overflow: hidden;
      aspect-ratio: 1;
    }

    .sublimation-slot.epic {
      border-color: #a78bfa;
    }

    .sublimation-slot.relic {
      border-color: #f59e0b;
    }

    .sublimation-card {
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

    .sublimation-card:hover {
      background: var(--panel);
    }

    .sublimation-card.epic {
      background: linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(139, 92, 246, 0.1));
    }

    .sublimation-card.relic {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1));
    }

    .sublimation-icon {
      font-size: 24px;
    }

    .sublimation-name {
      font-size: 9px;
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

    .sublimation-card:hover .remove-btn {
      opacity: 1;
    }

    .empty-slot {
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

    .available-section {
      border-top: 2px solid var(--stroke);
      padding-top: 16px;
    }

    .filter-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .filter-tabs button {
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }

    .filter-tabs button:hover {
      background: var(--panel);
    }

    .filter-tabs button.active {
      background: var(--accent);
      color: #0b1220;
      border-color: var(--accent);
    }

    .search-box {
      margin-bottom: 16px;
    }

    .search-box input {
      width: 100%;
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 14px;
    }

    .loading, .no-results {
      text-align: center;
      color: var(--muted);
      padding: 32px;
    }

    .sublimation-list {
      display: grid;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }

    .sublimation-item {
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .sublimation-item:hover {
      background: var(--panel);
      border-color: var(--accent);
    }

    .sublimation-item.epic {
      border-color: #a78bfa;
    }

    .sublimation-item.relic {
      border-color: #f59e0b;
    }

    .sublimation-item.selected {
      opacity: 0.5;
    }

    .sublimation-icon-large {
      font-size: 32px;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--panel);
      border-radius: 8px;
    }

    .sublimation-info {
      flex: 1;
    }

    .sublimation-title {
      font-size: 14px;
      color: #e8ecf3;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .sublimation-rarity {
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .sublimation-desc {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.4;
      margin-bottom: 6px;
    }

    .sublimation-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .stat {
      background: var(--panel);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      color: var(--accent);
    }

    .modal-footer {
      padding: 16px;
      border-top: 1px solid var(--stroke);
      display: flex;
      justify-content: flex-end;
    }

    .btn-secondary {
      background: #253044;
      color: #e8ecf3;
      border: 1px solid var(--stroke);
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    .btn-secondary:hover {
      background: #2d3a4f;
    }
  `]
})
export class SublimationSelectorComponent {
  @Input() selectedSublimations: (Sublimation | null)[] = new Array(12).fill(null);
  @Output() sublimationsChange = new EventEmitter<(Sublimation | null)[]>();

  modalOpen = signal(false);
  currentSlotIndex = signal(-1);
  currentRarityFilter = signal<'classic' | 'epic' | 'relic' | null>(null);
  loading = signal(false);
  allSublimations = signal<Sublimation[]>([]);
  filteredSublimations = signal<Sublimation[]>([]);
  filterRarity = signal<'all' | 'classic' | 'epic' | 'relic'>('all');
  searchQuery = '';

  // Expose Object.keys for template
  Object = Object;

  openModal(): void {
    this.modalOpen.set(true);
    if (this.allSublimations().length === 0) {
      this.loadSublimations();
    } else {
      this.filterSublimations();
    }
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.searchQuery = '';
    this.currentSlotIndex.set(-1);
    this.currentRarityFilter.set(null);
  }

  async loadSublimations(): Promise<void> {
    this.loading.set(true);
    try {
      // Mock data
      const mockSublimations: Sublimation[] = [
        { id: 'subli_1', name: 'Bravoure', rarity: 'classic', stats: { ap: 1 }, description: '+1 PA' },
        { id: 'subli_2', name: 'Vivacité', rarity: 'classic', stats: { mp: 1 }, description: '+1 PM' },
        { id: 'subli_3', name: 'Puissance', rarity: 'classic', stats: { mastery: 40 }, description: '+40 Maîtrise' },
        { id: 'subli_4', name: 'Résistance', rarity: 'classic', stats: { resistance: 40 }, description: '+40 Résistance' },
        { id: 'subli_5', name: 'Critique', rarity: 'classic', stats: { critRate: 5 }, description: '+5% Critique' },
        { id: 'subli_6', name: 'Rage', rarity: 'epic', stats: { mastery: 80, critMastery: 40 }, description: '+80 Maîtrise, +40 Maîtrise Crit' },
        { id: 'subli_7', name: 'Sagesse Ancestrale', rarity: 'relic', stats: { ap: 1, wp: 2 }, description: '+1 PA, +2 PW' },
      ];

      this.allSublimations.set(mockSublimations);
      this.filterSublimations();
    } catch (error) {
      console.error('Erreur chargement sublimations:', error);
    } finally {
      this.loading.set(false);
    }
  }

  setFilterRarity(rarity: 'all' | 'classic' | 'epic' | 'relic'): void {
    this.filterRarity.set(rarity);
    this.filterSublimations();
  }

  filterSublimations(): void {
    const query = this.searchQuery.toLowerCase();
    const rarityFilter = this.filterRarity();

    let filtered = this.allSublimations();

    if (rarityFilter !== 'all') {
      filtered = filtered.filter(s => s.rarity === rarityFilter);
    }

    if (query) {
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query)
      );
    }

    this.filteredSublimations.set(filtered);
  }

  selectSlot(index: number, rarity: 'classic' | 'epic' | 'relic'): void {
    this.currentSlotIndex.set(index);
    this.currentRarityFilter.set(rarity);
    this.setFilterRarity(rarity);
  }

  selectSublimation(sublimation: Sublimation): void {
    const currentIndex = this.currentSlotIndex();
    const rarityFilter = this.currentRarityFilter();

    let targetIndex = currentIndex;

    // Si pas d'index spécifique, trouver le premier slot vide de la bonne rareté
    if (targetIndex === -1) {
      if (sublimation.rarity === 'classic') {
        targetIndex = this.findFirstEmptyClassicSlot();
      } else if (sublimation.rarity === 'epic') {
        targetIndex = 10;
        if (this.selectedSublimations[10] !== null) {
          alert('L\'emplacement épique est déjà rempli');
          return;
        }
      } else if (sublimation.rarity === 'relic') {
        targetIndex = 11;
        if (this.selectedSublimations[11] !== null) {
          alert('L\'emplacement relique est déjà rempli');
          return;
        }
      }
    }

    if (targetIndex === -1) {
      alert('Tous les emplacements classiques sont remplis');
      return;
    }

    // Vérifier la cohérence rareté/slot
    if (rarityFilter && sublimation.rarity !== rarityFilter) {
      alert(`Cette sublimation est ${this.getRarityLabel(sublimation.rarity)}, veuillez sélectionner un emplacement ${this.getRarityLabel(rarityFilter)}`);
      return;
    }

    const newSublimations = [...this.selectedSublimations];
    newSublimations[targetIndex] = sublimation;
    this.sublimationsChange.emit(newSublimations);
    this.currentSlotIndex.set(-1);
    this.currentRarityFilter.set(null);
  }

  removeSublimation(index: number): void {
    const newSublimations = [...this.selectedSublimations];
    newSublimations[index] = null;
    this.sublimationsChange.emit(newSublimations);
  }

  findFirstEmptyClassicSlot(): number {
    for (let i = 0; i < 10; i++) {
      if (this.selectedSublimations[i] === null) {
        return i;
      }
    }
    return -1;
  }

  isSelected(subliId: string): boolean {
    return this.selectedSublimations.some(s => s?.id === subliId);
  }

  getClassicSlots(): (Sublimation | null)[] {
    return this.selectedSublimations.slice(0, 10);
  }

  getEpicSlot(): Sublimation | null {
    return this.selectedSublimations[10];
  }

  getRelicSlot(): Sublimation | null {
    return this.selectedSublimations[11];
  }

  countByRarity(rarity: 'classic' | 'epic' | 'relic'): number {
    if (rarity === 'classic') {
      return this.getClassicSlots().filter(s => s !== null).length;
    } else if (rarity === 'epic') {
      return this.getEpicSlot() ? 1 : 0;
    } else {
      return this.getRelicSlot() ? 1 : 0;
    }
  }

  countSelected(): number {
    return this.selectedSublimations.filter(s => s !== null).length;
  }

  getRarityIcon(rarity: string): string {
    switch (rarity) {
      case 'classic': return '💎';
      case 'epic': return '💠';
      case 'relic': return '🔶';
      default: return '✨';
    }
  }

  getRarityLabel(rarity: string): string {
    switch (rarity) {
      case 'classic': return 'Classique';
      case 'epic': return 'Épique';
      case 'relic': return 'Relique';
      default: return rarity;
    }
  }
}

