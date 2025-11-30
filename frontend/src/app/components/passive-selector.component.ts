/**
 * Passive Selector Component
 * Permet de sélectionner des passifs pour un build
 */

import { Component, Input, Output, EventEmitter, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Passive } from '../models/passive.model';
import { PassiveReference } from '../models/build.model';
import { DataCacheService } from '../services/data-cache.service';

@Component({
  selector: 'app-passive-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="passive-selector">
      <div class="selector-header">
        <h4>Passifs ({{ countSelected() }}/6)</h4>
        <button type="button" class="btn-open" (click)="openModal()">
          📋 Gérer les passifs
        </button>
      </div>

      <!-- Modal -->
      @if (modalOpen()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Sélection des Passifs</h3>
              <button (click)="closeModal()">✕</button>
            </div>

            <div class="modal-body">
              <!-- Slots de passifs -->
              <div class="passive-slots">
                @for (passive of selectedPassives; track $index; let i = $index) {
                  <div class="passive-slot" [class.filled]="passive !== null">
                    <div class="slot-level">Niveau {{ getLevelForSlot(i) }}</div>
                    @if (passive) {
                      <div class="passive-card" (click)="removePassive(i)">
                        <span class="passive-icon">🔮</span>
                        <span class="passive-name">{{ getPassiveName(passive.passiveId) }}</span>
                        <button class="remove-btn" title="Retirer">✕</button>
                      </div>
                    } @else {
                      <div class="empty-slot" (click)="selectSlot(i)">
                        <span>+</span>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Liste des passifs disponibles -->
              <div class="available-section">
                <h4>Passifs disponibles</h4>
                <div class="search-box">
                  <input
                    type="text"
                    [(ngModel)]="searchQuery"
                    placeholder="Rechercher un passif..."
                    (input)="filterPassives()"
                  />
                </div>

                @if (loading()) {
                  <div class="loading">Chargement des passifs...</div>
                } @else if (filteredPassives().length === 0) {
                  <div class="no-results">Aucun passif trouvé</div>
                } @else {
                  <div class="passive-list">
                    @for (passive of filteredPassives(); track passive.id) {
                      <div
                        class="passive-item"
                        [class.selected]="isSelected(passive.id)"
                        (click)="selectPassive(passive)"
                      >
                        <div class="passive-icon-large">🔮</div>
                        <div class="passive-info">
                          <div class="passive-title">{{ passive.name }}</div>
                          <div class="passive-meta">
                            <span>Niveau min: {{ passive.unlockedAtLevel || 20 }}</span>
                          </div>
                          @if (passive.description) {
                            <div class="passive-desc">{{ passive.description }}</div>
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
    .passive-selector {
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

    .passive-slots {
      display: grid;
      grid-template-columns: repeat(3, minmax(85px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .passive-slot {
      border: 1px solid var(--stroke);
      border-radius: 8px;
      overflow: hidden;
    }

    .slot-level {
      background: var(--panel-2);
      padding: 4px 8px;
      font-size: 11px;
      color: var(--muted);
      text-align: center;
      border-bottom: 1px solid var(--stroke);
    }

    .passive-card {
      height: 100px;
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

    .passive-card:hover {
      background: var(--panel);
    }

    .passive-icon {
      font-size: 28px;
    }

    .passive-name {
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

    .passive-card:hover .remove-btn {
      opacity: 1;
    }

    .empty-slot {
      height: 100px;
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

    .available-section h4 {
      margin-bottom: 12px;
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

    .passive-list {
      display: grid;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }

    .passive-item {
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

    .passive-item:hover {
      background: var(--panel);
      border-color: var(--accent);
    }

    .passive-item.selected {
      background: var(--accent);
      border-color: var(--accent);
      color: #0b1220;
    }

    .passive-icon-large {
      font-size: 32px;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--panel);
      border-radius: 8px;
    }

    .passive-info {
      flex: 1;
    }

    .passive-title {
      font-size: 14px;
      color: #e8ecf3;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .passive-item.selected .passive-title {
      color: #0b1220;
    }

    .passive-meta {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 4px;
    }

    .passive-item.selected .passive-meta {
      color: #0b1220;
      opacity: 0.8;
    }

    .passive-desc {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.4;
    }

    .passive-item.selected .passive-desc {
      color: #0b1220;
      opacity: 0.8;
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
export class PassiveSelectorComponent {
  @Input() classId: string = '';
  @Input() selectedPassives: (PassiveReference | null)[] = new Array(6).fill(null);
  @Output() passivesChange = new EventEmitter<(PassiveReference | null)[]>();

  private dataCache = inject(DataCacheService);

  modalOpen = signal(false);
  currentSlotIndex = signal(-1);
  loading = signal(false);
  allPassives = signal<Passive[]>([]);
  filteredPassives = signal<Passive[]>([]);
  searchQuery = '';

  // Niveaux de déverrouillage des passifs
  private readonly PASSIVE_LEVELS = [20, 35, 50, 100, 150, 200];

  constructor() {
    // Recharger les passifs quand la classe change
    effect(() => {
      const classId = this.classId;
      if (classId && this.modalOpen()) {
        this.loadPassives();
      }
    });
  }

  openModal(): void {
    this.modalOpen.set(true);
    this.loadPassives();
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.searchQuery = '';
    this.currentSlotIndex.set(-1);
  }

  async loadPassives(): Promise<void> {
    this.loading.set(true);
    try {
      // Charger les passifs depuis le cache
      const passives = await this.dataCache.getPassives(this.classId || undefined);

      this.allPassives.set(passives);
      this.filterPassives();
    } catch (error) {
      console.error('Erreur chargement passifs:', error);
      // En cas d'erreur, utiliser des données par défaut vides
      this.allPassives.set([]);
      this.filteredPassives.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  filterPassives(): void {
    const query = this.searchQuery.toLowerCase();
    const filtered = this.allPassives().filter(passive =>
      passive.name.toLowerCase().includes(query) ||
      passive.id.toLowerCase().includes(query)
    );
    this.filteredPassives.set(filtered);
  }

  selectSlot(index: number): void {
    this.currentSlotIndex.set(index);
  }

  selectPassive(passive: Passive): void {
    const currentIndex = this.currentSlotIndex();
    let targetIndex = currentIndex >= 0 ? currentIndex : this.findFirstEmptySlot();

    if (targetIndex === -1) {
      alert('Tous les emplacements sont remplis');
      return;
    }

    const newPassives = [...this.selectedPassives];
    newPassives[targetIndex] = {
      passiveId: passive.id,
      unlockedAtLevel: passive.unlockedAtLevel || 20,
      icon: ''
    };
    this.passivesChange.emit(newPassives);
    this.currentSlotIndex.set(-1);
  }

  removePassive(index: number): void {
    const newPassives = [...this.selectedPassives];
    newPassives[index] = null;
    this.passivesChange.emit(newPassives);
  }

  findFirstEmptySlot(): number {
    return this.selectedPassives.indexOf(null);
  }

  isSelected(passiveId: string): boolean {
    return this.selectedPassives.some(p => p?.passiveId === passiveId);
  }

  getPassiveName(passiveId: string): string {
    const passive = this.allPassives().find(p => p.id === passiveId);
    return passive?.name || passiveId;
  }

  getLevelForSlot(index: number): number {
    return this.PASSIVE_LEVELS[index] || 20;
  }

  countSelected(): number {
    return this.selectedPassives.filter(p => p !== null).length;
  }
}

