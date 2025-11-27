/**
 * Board Component
 * Interactive combat map showing entities, mechanisms, and spell actions
 */

import { Component, inject, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineService } from '../services/timeline.service';
import { BuildService } from '../services/build.service';
import { BoardService } from '../services/board.service';
import { BoardEntity } from '../models/board.model';

interface BoardCell {
  x: number;
  y: number;
  hasEntity: boolean;
  hasMechanism: boolean;
  isAction: boolean; // Spell cast location
  actionType?: string;
}

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="board-container">
      <div class="board-header">
        <div class="header-left">
          <h2>🗺️ Carte de Combat</h2>
          <div class="timeline-indicator" *ngIf="currentTimeline()">
            <span class="timeline-badge">📋 {{ currentTimeline()!.name }}</span>
          </div>
        </div>
        <div class="board-controls">
          <button (click)="onPreviousStep()" [disabled]="currentStepIndex() === 0" class="btn-nav">
            ◀ Étape Précédente
          </button>
          <span class="step-indicator">
            Étape {{ currentStepIndex() + 1 }} / {{ totalSteps() }}
          </span>
          <button (click)="onNextStep()" [disabled]="currentStepIndex() >= totalSteps() - 1" class="btn-nav">
            Étape Suivante ▶
          </button>
          <button (click)="onReset()" class="btn-reset">🔄 Réinitialiser</button>
        </div>
      </div>

      <!-- Legend -->
      <div class="legend">
        <div class="legend-item">
          <span class="legend-color player"></span> Joueur Xélor
        </div>
        <div class="legend-item">
          <span class="legend-color enemy"></span> Ennemi
        </div>
        <div class="legend-item">
          <span class="legend-color mechanism"></span> Mécanisme
        </div>
        <div class="legend-item">
          <span class="legend-color action-spell"></span> Lancer de sort
        </div>
        <div class="legend-item">
          <span class="legend-color mechanism-explode"></span> Explosion Rouage
        </div>
      </div>

      <!-- Board Grid -->
      <div class="board-wrapper">
        <div *ngIf="currentTimeline(); else noTimeline">
          <div class="board">
            <!-- Grid cells -->
            <div
              *ngFor="let cell of boardCells()"
              class="cell"
              [ngStyle]="{ 'grid-column': cell.x + 1, 'grid-row': cell.y + 1 }"
              [class.has-entity]="cell.hasEntity"
              [class.has-mechanism]="cell.hasMechanism"
              [class.has-action]="cell.isAction"
              [title]="'(' + cell.x + ', ' + cell.y + ')'"
            >
            <!-- Coordinates -->
            <span class="coord" *ngIf="cell.x === 0 || cell.y === 0">
              {{ cell.x === 0 ? cell.y : cell.x }}
            </span>

            <!-- Entity -->
            <div
              *ngIf="getEntityAtPosition(cell.x, cell.y) as entity"
              class="entity"
              [class.player]="entity.type === 'player'"
              [class.enemy]="entity.type === 'enemy'"
              [title]="entity.name"
            >
              {{ entity.type === 'player' ? '🧙' : '👹' }}
              <span class="entity-label">{{ entity.name }}</span>
            </div>

            <!-- Mechanism -->
            <div
              *ngIf="getMechanismAtPosition(cell.x, cell.y) as mech"
              class="mechanism"
              [class]="mech.type"
              [title]="mech.type"
            >
              {{ getMechanismIcon(mech.type) }}
            </div>

            <!-- Spell Action Indicator -->
            <div
              *ngIf="getActionAtPosition(cell.x, cell.y) as action"
              class="action-indicator"
              [class]="action.type"
              [title]="action.type"
            >
              ✨
            </div>
          </div>
        </div>
        </div>
        <ng-template #noTimeline>
          <div class="no-timeline">
            <h3>⏱️ Aucune timeline chargée</h3>
            <p>Veuillez sélectionner ou créer une timeline pour voir la carte de combat.</p>
            <div class="no-timeline-steps">
              <ol>
                <li>Créez un build (📦 Builds)</li>
                <li>Créez une timeline (📋 Timelines)</li>
                <li>Cliquez sur une timeline pour la charger</li>
                <li>Naviguez les étapes avec ◀ ▶</li>
              </ol>
            </div>
          </div>
        </ng-template>
      </div>

      <!-- Timeline Actions Display -->
      <div class="timeline-display" *ngIf="currentStep()">
        <h3>📍 Actions à cette étape</h3>
        <div class="actions-list">
          <div *ngFor="let action of currentStep()?.actions || []" class="action-item">
            <span class="action-type" [class]="action.type">{{ action.type }}</span>
            <span *ngIf="action.spellId" class="spell-info">
              Sort: {{ getSpellName(action.spellId) }}
            </span>
            <span class="pos-info">
              Cible: ({{ action.targetPosition?.x }}, {{ action.targetPosition?.y }})
            </span>
            <span class="facing-info" *ngIf="action.targetFacing">
              Direction: {{ action.targetFacing.direction }}
            </span>
          </div>
        </div>
      </div>

      <!-- Entities Info -->
      <div class="entities-info">
        <h3>👥 Entités</h3>
        <div class="info-grid">
          <div class="entity-info" *ngFor="let entity of boardService.state().entities">
            <div class="entity-header">
              <div class="entity-type" [class]="entity.type">
                {{ entity.type === 'player' ? '🧙 Joueur' : '👹 Ennemi' }}
              </div>
              <div class="entity-actions">
                <button (click)="onEditEntity(entity)" class="btn-edit" title="Modifier">✏️</button>
                <button (click)="onDeleteEntity(entity)" class="btn-delete" title="Supprimer">🗑️</button>
              </div>
            </div>
            <div class="entity-details">
              <strong>{{ entity.name }}</strong>
              <span *ngIf="entity.classId" class="entity-class">{{ entity.classId }}</span>
              <span>Position: ({{ entity.position.x }}, {{ entity.position.y }})</span>
              <span>Direction: {{ entity.facing.direction }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Mechanisms Info -->
      <div class="mechanisms-info" *ngIf="boardService.mechanisms().length > 0">
        <h3>⚙️ Mécanismes</h3>
        <div class="mechanisms-list">
          <div class="mechanism-info" *ngFor="let mech of boardService.mechanisms()">
            <span class="mech-icon">{{ getMechanismIcon(mech.type) }}</span>
            <div class="mech-details">
              <strong>{{ mech.type }}</strong>
              <span>Position: ({{ mech.position.x }}, {{ mech.position.y }})</span>
              <span>Charges: {{ mech.charges || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :root {
      --bg: #0f1115;
      --panel: #181b22;
      --panel-2: #1d2230;
      --muted: #8c9bb3;
      --accent: #4cc9f0;
      --good: #7bd88f;
      --bad: #ef476f;
      --stroke: #2a2f3a;
    }

    .board-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
      background: var(--bg);
      border-radius: 12px;
      color: #e8ecf3;
    }

    .board-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .board-header h2 {
      margin: 0;
      font-size: 18px;
      color: #cfe3ff;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }

    .timeline-indicator {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .timeline-badge {
      background: linear-gradient(135deg, var(--accent), #5ad7f0);
      color: #0b1220;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 0 12px rgba(76, 201, 240, 0.4);
    }

    .board-controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .btn-nav, .btn-reset {
      background: #253044;
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }

    .btn-nav:hover:not(:disabled) {
      background: var(--accent);
      color: #0b1220;
      border-color: var(--accent);
    }

    .btn-nav:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-reset:hover {
      background: #4cc9f0;
      color: #0b1220;
    }

    .step-indicator {
      font-size: 12px;
      color: var(--muted);
      min-width: 80px;
      text-align: center;
    }

    /* Legend */
    .legend {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));  /* Larger min-width for text to fit */
      gap: 12px;
      padding: 12px;
      background: var(--panel);
      border-radius: 8px;
      border: 1px solid var(--stroke);
      font-size: 12px;
      position: sticky;
      top: 0;
      z-index: 10;
      width: 100%;  /* Take full width */
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 12px;
      white-space: nowrap;
    }

    .legend-color {
      width: 14px;
      height: 14px;
      min-width: 14px;
      min-height: 14px;
      flex-shrink: 0;
      flex-grow: 0;
      border-radius: 3px;
      border: 1px solid var(--stroke);
    }

    .legend-color.player {
      background: linear-gradient(135deg, var(--good), #5ad7f0);
    }

    .legend-color.enemy {
      background: var(--bad);
    }

    .legend-color.mechanism {
      background: #ffd166;
    }

    .legend-color.action-spell {
      background: #7aa2f7;
    }

    .legend-color.mechanism-explode {
      background: #ff6b6b;
    }

    /* Board Wrapper */
    .board-wrapper {
      display: flex;
      justify-content: center;
      padding: 16px;
      background: var(--panel);
      border-radius: 12px;
      border: 1px solid var(--stroke);
      overflow: auto;
      min-height: 350px;
    }

    .no-timeline {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      color: var(--muted);
      text-align: center;
    }

    .no-timeline h3 {
      margin: 0;
      color: #e8ecf3;
      font-size: 16px;
    }

    .no-timeline p {
      margin: 0;
      font-size: 13px;
      color: var(--muted);
    }

    .no-timeline-steps {
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      border-radius: 8px;
      padding: 16px;
      text-align: left;
      min-width: 300px;
    }

    .no-timeline-steps ol {
      margin: 0;
      padding-left: 20px;
    }

    .no-timeline-steps li {
      margin-bottom: 8px;
      color: #e8ecf3;
      font-size: 13px;
    }

    .board {
      display: grid;
      grid-template-columns: repeat(13, 40px);
      grid-template-rows: repeat(13, 40px);
      gap: 1px;
      background: #0f1415;
      padding: 8px;
      border-radius: 8px;
    }

    .cell {
      background: linear-gradient(135deg, #141a24, #0f151f);
      border: 1px solid var(--stroke);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      transition: all 0.2s;
      overflow: hidden;
    }

    .cell:hover {
      background: #1a2236;
      box-shadow: 0 0 8px rgba(76, 201, 240, 0.3);
    }

    .cell.has-entity {
      background: #1e2844;
    }

    .cell.has-action {
      background: #2a3a5a;
      box-shadow: inset 0 0 8px rgba(122, 162, 247, 0.3);
    }

    .cell.has-mechanism {
      background: #3a3a2a;
    }

    .coord {
      position: absolute;
      top: 10%;
      left: 10%;
      font-size: 0.5em;
      color: var(--muted);
      opacity: 0.5;
    }

    /* Entity */
    .entity {
      font-size: 1.2em;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2em;
      position: relative;
      z-index: 2;
    }

    .entity-label {
      font-size: 0.4em;
      color: #e8ecf3;
      background: rgba(0, 0, 0, 0.7);
      padding: 0.25em 0.3em;
      border-radius: 0.2em;
      white-space: nowrap;
    }

    .entity.player {
      filter: drop-shadow(0 0 4px var(--good));
    }

    .entity.enemy {
      filter: drop-shadow(0 0 4px var(--bad));
    }

    /* Mechanism */
    .legend-color.mechanism {
      background: #ffd166;
    }

    /* Après : ne s'applique qu'aux mécanismes dans le board */
    .board .mechanism {
      font-size: 1em;
      position: absolute;
      z-index: 1;
      animation: pulse 1.5s ease-in-out infinite;
    }

    .board .mechanism.gear {
      color: #ffd166;
      filter: drop-shadow(0 0 4px #ffd166);
    }

    .board .mechanism.dial {
      color: #a78bfa;
      filter: drop-shadow(0 0 4px #a78bfa);
    }

    .board .mechanism.sinistro {
      color: #ff6b6b;
      filter: drop-shadow(0 0 4px #ff6b6b);
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    /* Action Indicator */
    .action-indicator {
      font-size: 0.8em;
      position: absolute;
      z-index: 0;
      animation: sparkle 0.6s ease-out;
    }

    .action-indicator.CastSpell {
      color: #7aa2f7;
    }

    .action-indicator.Move {
      color: #90ee90;
    }

    .action-indicator.Transpose {
      color: #ff69b4;
    }

    @keyframes sparkle {
      0% { transform: scale(0); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    /* Timeline Display */
    .timeline-display {
      background: var(--panel);
      border: 1px solid var(--stroke);
      border-radius: 8px;
      padding: 12px;
    }

    .timeline-display h3 {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: var(--accent);
      text-transform: uppercase;
    }

    .actions-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .action-item {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      align-items: center;
      padding: 8px;
      background: var(--panel-2);
      border-radius: 6px;
      border-left: 3px solid transparent;
      font-size: 12px;
    }

    .action-type {
      background: #2b344a;
      color: #cfe3ff;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 500;
      min-width: 100px;
    }

    .action-type.CastSpell {
      background: #2a3a5a;
      color: #7aa2f7;
      border-left-color: #7aa2f7;
    }

    .spell-info, .pos-info, .facing-info {
      color: var(--muted);
    }

    /* Entities Info */
    .entities-info,
    .mechanisms-info {
      background: var(--panel);
      border: 1px solid var(--stroke);
      border-radius: 8px;
      padding: 12px;
    }

    .entities-info h3,
    .mechanisms-info h3 {
      margin: 0 0 12px 0;
      font-size: 13px;
      color: var(--accent);
      text-transform: uppercase;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .entity-info {
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      border-radius: 6px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .entity-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .entity-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .entity-info:hover .entity-actions {
      opacity: 1;
    }

    .btn-edit, .btn-delete {
      background: transparent;
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      border-radius: 4px;
      padding: 2px 6px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
    }

    .btn-edit:hover {
      background: #4cc9f0;
      color: #0b1220;
      border-color: #4cc9f0;
    }

    .btn-delete:hover {
      background: #ef476f;
      color: white;
      border-color: #ef476f;
    }

    .entity-type {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      white-space: nowrap;
    }

    .entity-type.player {
      background: var(--good);
      color: #0b1220;
    }

    .entity-type.enemy {
      background: var(--bad);
      color: white;
    }

    .entity-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
    }

    .entity-details strong {
      color: #e8ecf3;
    }

    .entity-details span {
      color: var(--muted);
    }

    .entity-class {
      display: inline-block;
      background: linear-gradient(135deg, var(--accent), #5ad5f0);
      color: #0b1220;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
      width: fit-content;
    }

    .mechanisms-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .mechanism-info {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 8px;
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      border-radius: 6px;
    }

    .mech-icon {
      font-size: 20px;
    }

    .mech-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
    }

    .mech-details strong {
      color: #e8ecf3;
    }

    .mech-details span {
      color: var(--muted);
    }

    @media (max-width: 1200px) {
      .board {
        grid-template-columns: repeat(13, 35px);
        grid-template-rows: repeat(13, 35px);
      }
    }
  `]
})
export class BoardComponent {
  timelineService = inject(TimelineService);
  buildService = inject(BuildService);
  boardService = inject(BoardService);

  editPlayer = output<BoardEntity>();
  editEnemy = output<BoardEntity>();
  deleteEntity = output<BoardEntity>();

  currentTimeline = computed(() => this.timelineService.currentTimeline());

  currentStepIndex = computed(() => this.timelineService.currentStepIndex());

  currentStep = computed(() => {
    const timeline = this.currentTimeline();
    if (!timeline) return null;
    const idx = this.currentStepIndex();
    return timeline.steps[idx] || null;
  });

  totalSteps = computed(() => this.currentTimeline()?.steps.length || 0);

  boardCells = computed(() => {
    const cells: BoardCell[] = [];
    for (let y = 0; y < 13; y++) {
      for (let x = 0; x < 13; x++) {
        cells.push({
          x,
          y,
          hasEntity: !!this.getEntityAtPosition(x, y),
          hasMechanism: !!this.getMechanismAtPosition(x, y),
          isAction: !!this.getActionAtPosition(x, y)
        });
      }
    }
    return cells;
  });

  /**
   * Get entity at position
   */
  getEntityAtPosition(x: number, y: number) {
    return this.boardService.state().entities.find(
      e => e.position.x === x && e.position.y === y
    );
  }

  /**
   * Get mechanism at position
   */
  getMechanismAtPosition(x: number, y: number) {
    return this.boardService.state().mechanisms.find(
      m => m.position.x === x && m.position.y === y
    );
  }

  /**
   * Get action at position
   */
  getActionAtPosition(x: number, y: number) {
    if (!this.currentStep()) return null;

    const actions = this.currentStep()?.actions || [];
    return actions.find(a =>
      a.targetPosition?.x === x && a.targetPosition?.y === y
    );
  }

  /**
   * Get mechanism icon
   */
  getMechanismIcon(type: string): string {
    switch(type) {
      case 'gear': return '⚙️';
      case 'dial': return '⏰';
      case 'sinistro': return '💀';
      default: return '⚡';
    }
  }

  /**
   * Get spell name by ID
   */
  getSpellName(spellId: string): string {
    const build = this.buildService.selectedBuildA();
    if (!build) return spellId;
    const spell = build.spellBar.spells.find(s => s?.id === spellId);
    return spell?.name || spellId;
  }

  /**
   * Navigation
   */
  onNextStep(): void {
    this.timelineService.nextStep();
  }

  onPreviousStep(): void {
    this.timelineService.previousStep();
  }

  onReset(): void {
    this.timelineService.resetTimeline();
  }

  /**
   * Entity management
   */
  onEditEntity(entity: any): void {
    if (entity.type === 'player') {
      this.editPlayer.emit(entity);
    } else {
      this.editEnemy.emit(entity);
    }
  }

  onDeleteEntity(entity: any): void {
    if (confirm(`Supprimer ${entity.type === 'player' ? 'le joueur' : "l'ennemi"} "${entity.name}" ?`)) {
      this.boardService.removeEntity(entity.id);
    }
  }
}

