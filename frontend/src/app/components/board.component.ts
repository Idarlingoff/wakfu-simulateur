/**
 * Board Component
 * Interactive combat map showing entities, mechanisms, and spell actions
 */

import { Component, inject, computed, output, effect, input } from '@angular/core';import { CommonModule } from '@angular/common';
import { TimelineService } from '../services/timeline.service';
import { BuildService } from '../services/build.service';
import { BoardService } from '../services/board.service';
import { SimulationService } from '../services/simulation.service';
import { ResourceRegenerationService } from '../services/processors/resource-regeneration.service';
import { BoardEntity, Mechanism } from '../models/board.model';
import { Position, TimelineAction } from '../models/timeline.model';
import { Build } from '../models/build.model';
import {getMechanismDisplayName, getMechanismImagePath, isSpellMechanism, getSpellMechanismType} from '../utils/mechanism-utils';

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
          <!-- Nouveau : Bouton pour lancer toute la simulation -->
          <button
            (click)="onRunFullSimulation()"
            [disabled]="isSimulating() || currentStepIndex() > 0 || !hasMinimumBoardSetup()"
            class="btn-run-full"
            title="Exécuter toute la timeline d'un coup">
            @if (isSimulating()) {
              <span>⏳ Simulation en cours...</span>
            } @else {
              <span>▶ Lancer Toute la Simulation</span>
            }
          </button>

          <div class="divider"></div>

          <!-- Contrôles step-by-step -->
          <button (click)="onPreviousStep()" [disabled]="currentStepIndex() === 0 || isSimulating()" class="btn-nav">
            ◀ Étape Précédente
          </button>
          <span class="step-indicator">
            {{ currentStepIndex() === 0 ? 'État initial' : 'Étape ' + currentStepIndex() }} / {{ totalSteps() - 1 }}
          </span>
          <button (click)="onNextStep()" [disabled]="currentStepIndex() >= totalSteps() - 1 || isSimulating() || !hasMinimumBoardSetup()" class="btn-nav">
            Étape Suivante ▶
          </button>

          <div class="divider"></div>

          <button (click)="onReset()" class="btn-reset" [disabled]="isSimulating()">🔄 Réinitialiser</button>
        </div>
      </div>

      <div class="board-setup-warning" *ngIf="currentTimeline() && !hasMinimumBoardSetup()">
        ⚠️ Placement requis: ajoutez au moins 1 allié et 1 ennemi avant de lancer la timeline.
      </div>

      <div class="placement-help" *ngIf="placementMode() !== 'none'">
        📍 {{ getPlacementHelpText() }}
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
              [class.pending-placement]="placementMode() !== 'none'"
              [class.has-entity]="cell.hasEntity"
              [class.has-mechanism]="cell.hasMechanism"
              [class.has-action]="cell.isAction"
              [title]="'(' + cell.x + ', ' + cell.y + ')'"
              (click)="onCellClick(cell)"
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

            <!-- Dial Hours (zones visuelles/de déplacement) -->
            <div
              *ngIf="getDialHourAtPosition(cell.x, cell.y) as dialHour"
              class="dial-hour"
              [class.current-hour]="isCurrentDialHour(dialHour.hour)"
              [title]="'Cadran - ' + dialHour.hour + 'h' + (isCurrentDialHour(dialHour.hour) ? ' (HEURE COURANTE)' : '')"
            >
              <img
                [src]="'http://localhost:8080/resources/dial/dial_hours-' + dialHour.hour + '.png'"
                [alt]="'Heure ' + dialHour.hour"
                class="dial-hour-image"
              />
              <span *ngIf="isCurrentDialHour(dialHour.hour)" class="current-hour-indicator">⏰</span>
            </div>

            <!-- Mechanism -->
            <div
              *ngIf="getMechanismAtPosition(cell.x, cell.y) as mech"
              class="mechanism"
              [ngClass]="[mech.type, (mech.type === 'cog' && (mech.charges || 0) > 0) ? 'has-charges' : '']"
              [title]="getMechanismTitle(mech.type) + (mech.charges ? ' (' + mech.charges + ' charges)' : '')"
            >
              <img
                [src]="getMechanismImage(mech.type, mech.charges)"
                [alt]="getMechanismTitle(mech.type)"
                class="mechanism-image"
              />
              <span *ngIf="mech.type === 'cog' && (mech.charges || 0) > 0" class="charge-badge">{{ mech.charges }}</span>
            </div>

            <!-- Spell Action Indicator -->
            <!-- N'affiche l'indicateur QUE si aucun mécanisme n'est présent -->
            <div
              *ngIf="!getMechanismAtPosition(cell.x, cell.y) && getActionAtPosition(cell.x, cell.y) as action"
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
            <div class="mech-icon">
              <img
                [src]="getMechanismImage(mech.type, mech.charges)"
                [alt]="getMechanismTitle(mech.type)"
                class="mech-icon-image"
              />
            </div>
            <div class="mech-details">
              <strong>{{ getMechanismTitle(mech.type) }}</strong>
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
      flex-wrap: wrap;
    }

    .btn-nav, .btn-reset, .btn-run-full {
      background: #253044;
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }

    .btn-run-full {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: #667eea;
      font-weight: 600;
      padding: 10px 16px;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .btn-run-full:hover:not(:disabled) {
      background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
    }

    .btn-run-full:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
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

    .btn-reset:hover:not(:disabled) {
      background: #4cc9f0;
      color: #0b1220;
    }

    .btn-reset:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .divider {
      width: 1px;
      height: 24px;
      background: var(--stroke);
      margin: 0 4px;
    }

    .step-indicator {
      font-size: 12px;
      color: var(--muted);
      min-width: 80px;
      text-align: center;
    }

    /* Legend */
    .board-setup-warning {
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(239, 71, 111, 0.15);
      border: 1px solid rgba(239, 71, 111, 0.5);
      color: #ffb4c4;
      font-size: 13px;
      font-weight: 600;
    }

    .placement-help {
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(76, 201, 240, 0.12);
      border: 1px solid rgba(76, 201, 240, 0.45);
      color: #bdefff;
      font-size: 13px;
      font-weight: 600;
    }

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

    .cell.pending-placement:hover {
      box-shadow: 0 0 12px rgba(123, 216, 143, 0.8);
      border-color: var(--good);
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

    /* Mécanismes dans le board */
    .board .mechanism {
      position: absolute;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      animation: pulse 1.5s ease-in-out infinite;
    }

    .board .mechanism-image {
      width: 80%;
      height: 80%;
      object-fit: contain;
      filter: drop-shadow(0 0 4px rgba(255, 209, 102, 0.6));
    }

    .board .mechanism.cog .mechanism-image {
      filter: drop-shadow(0 0 4px rgba(255, 209, 102, 0.8));
    }

    /* Rouage avec charges - teinte bleue via CSS (remplace rouage-bleu.png corrompu) */
    .board .mechanism.cog.has-charges .mechanism-image {
      filter: drop-shadow(0 0 8px rgba(76, 201, 240, 1))
              hue-rotate(180deg)
              saturate(1.5)
              brightness(1.1);
    }

    /* Badge affichant le nombre de charges */
    .board .mechanism .charge-badge {
      position: absolute;
      bottom: 2px;
      right: 2px;
      background: linear-gradient(135deg, #4cc9f0, #00b4d8);
      color: #0b1220;
      font-size: 10px;
      font-weight: bold;
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      z-index: 10;
    }

    /* Rouage (cog) - TOUJOURS au premier plan */
    .board .mechanism.cog {
      z-index: 3 !important; /* Au-dessus de tout */
    }

    /* Cadran central - reste au premier plan avec les autres mécanismes */
    .board .mechanism.dial .mechanism-image {
      filter: drop-shadow(0 0 6px rgba(167, 139, 250, 0.9));
    }

    /* Cadran central (sans heures) - z-index explicite */
    .board .mechanism.dial:not(.dial-hour) {
      z-index: 3 !important; /* Au-dessus de tout */
    }

    /* Heures du cadran - ZONES VISUELLES (pas des mécanismes) */
    /* Les heures sont des éléments séparés avec leur propre rendu */
    .board .dial-hour {
      position: absolute;
      z-index: 0 !important; /* Passe derrière tout le reste */
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      pointer-events: none; /* Les heures ne bloquent pas les clics */
    }

    .board .dial-hour-image {
      width: 60%;
      height: 60%;
      opacity: 0.5; /* Opacité réduite pour être plus discrètes */
      object-fit: contain;
      filter: drop-shadow(0 0 3px rgba(167, 139, 250, 0.5));
      animation: hourGlow 3s ease-in-out infinite; /* Animation plus lente et douce */
    }

    @keyframes hourGlow {
      0%, 100% {
        opacity: 0.4; /* Plus transparentes */
        filter: drop-shadow(0 0 2px rgba(167, 139, 250, 0.4));
      }
      50% {
        opacity: 0.6; /* Légère augmentation */
        filter: drop-shadow(0 0 4px rgba(167, 139, 250, 0.6));
      }
    }

    /* Heure courante du cadran - MISE EN SURBRILLANCE */
    .board .dial-hour.current-hour .dial-hour-image {
      opacity: 1 !important;
      width: 80%;
      height: 80%;
      filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.9)) drop-shadow(0 0 15px rgba(255, 215, 0, 0.6)) !important;
      animation: currentHourPulse 1s ease-in-out infinite !important;
    }

    .board .dial-hour.current-hour {
      z-index: 1 !important; /* Légèrement au-dessus des autres heures */
    }

    .board .current-hour-indicator {
      position: absolute;
      top: -5px;
      right: -5px;
      font-size: 12px;
      animation: currentHourBounce 0.5s ease-in-out infinite alternate;
    }

    @keyframes currentHourPulse {
      0%, 100% {
        opacity: 0.9;
        transform: scale(1);
        filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.9)) drop-shadow(0 0 15px rgba(255, 215, 0, 0.6));
      }
      50% {
        opacity: 1;
        transform: scale(1.1);
        filter: drop-shadow(0 0 12px rgba(255, 215, 0, 1)) drop-shadow(0 0 20px rgba(255, 215, 0, 0.8));
      }
    }

    @keyframes currentHourBounce {
      0% { transform: translateY(0); }
      100% { transform: translateY(-3px); }
    }

    /* Sinistro - TOUJOURS au premier plan */
    .board .mechanism.sinistro {
      z-index: 3 !important; /* Au-dessus de tout */
    }

    .board .mechanism.sinistro .mechanism-image {
      filter: drop-shadow(0 0 4px rgba(255, 107, 107, 0.8));
    }

    /* Régulateur - TOUJOURS au premier plan */
    .board .mechanism.regulateur {
      z-index: 3 !important; /* Au-dessus de tout */
    }

    .board .mechanism.regulateur .mechanism-image {
      filter: drop-shadow(0 0 4px rgba(76, 201, 240, 0.8));
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
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .mech-icon-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 0 2px rgba(255, 209, 102, 0.5));
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
  simulationService = inject(SimulationService);
  regenerationService = inject(ResourceRegenerationService);

  editPlayer = output<BoardEntity>();
  editEnemy = output<BoardEntity>();
  deleteEntity = output<BoardEntity>();
  boardCellClick = output<Position>();
  placementMode = input<'none' | 'player' | 'enemy' | 'player-edit' | 'enemy-edit' | 'cog'>('none');

  currentTimeline = computed(() => this.timelineService.currentTimeline());
  currentStepIndex = computed(() => this.timelineService.currentStepIndex());

  // 🆕 Signal pour indiquer si une simulation est en cours
  isSimulating = computed(() => this.simulationService.isRunning());
  hasMinimumBoardSetup = computed(() => this.boardService.hasMinimumSetup());

  private lastObservedTimelineId: string | null = null;

  constructor() {
    // Invalider l'état de simulation à chaque changement réel de timeline
    // pour éviter les validations effectuées avec un contexte en cache d'une autre timeline.
    effect(() => {
      const timelineId = this.timelineService.currentTimelineId();
      const timeline = this.currentTimeline();

      if (timelineId === this.lastObservedTimelineId) {
        return;
      }

      this.lastObservedTimelineId = timelineId;
      this.simulationService.clearSimulation();
      this.regenerationService.clearHistory();

      if (timeline) {
        console.log('🗑️ Timeline changée:', timeline.name, '- cache simulation/régénération réinitialisé');
      }
    });
  }

  currentStep = computed(() => {
    const timeline = this.currentTimeline();
    if (!timeline) return null;
    const idx = this.currentStepIndex();
    // idx = 0 → État initial (avant toute exécution)
    // idx = 1, 2, 3... → Affiche l'étape correspondante (idx)
    return idx > 0 && idx <= timeline.steps.length ? timeline.steps[idx - 1] || null : null;
  });

  totalSteps = computed(() => {
    const stepsCount = this.currentTimeline()?.steps.length || 0;
    return stepsCount + 1; // +1 pour l'état initial
  });

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
   * Get dial hour at position
   */
  getDialHourAtPosition(x: number, y: number) {
    return this.boardService.dialHours().find(
      h => h.position.x === x && h.position.y === y
    );
  }

  /**
   * Check if a dial hour is the current hour
   */
  isCurrentDialHour(hour: number): boolean {
    const currentHour = this.boardService.currentDialHour();
    return currentHour !== undefined && currentHour === hour;
  }

  /**
   * Get the current dial hour (for display purposes)
   */
  getCurrentDialHour(): number | undefined {
    return this.boardService.currentDialHour();
  }

  getPlacementHelpText(): string {
    const mode = this.placementMode();
    if (mode === 'player') return 'Cliquez sur une case de la carte pour placer le joueur.';
    if (mode === 'enemy') return "Cliquez sur une case de la carte pour placer l'ennemi.";
    if (mode === 'player-edit') return 'Validez votre modification puis cliquez sur une case pour déplacer le joueur.';
    if (mode === 'enemy-edit') return "Validez votre modification puis cliquez sur une case pour déplacer l'ennemi.";
    return 'Cliquez sur une case de la carte pour placer le rouage.';
  }

  /**
   * Get action at position
   * Exclude Move, Transpose, and mechanism spells as they have their own visual representation
   */
  getActionAtPosition(x: number, y: number) {
    if (!this.currentStep()) return null;

    const actions = this.currentStep()?.actions || [];
    return actions.find(a => {
      // Vérifier la position
      if (a.targetPosition?.x !== x || a.targetPosition?.y !== y) {
        return false;
      }

      // Exclure les déplacements et transpositions
      if (a.type === 'Move' || a.type === 'Transpose') {
        return false;
      }

      // Exclure les sorts qui créent des mécanismes (ils ont leur propre représentation visuelle)
      return !(a.type === 'CastSpell' && a.spellId && isSpellMechanism(a.spellId));
    });
  }

  /**
   * Get mechanism image path
   */
  getMechanismImage(type: string, charges?: number): string {
    return 'http://localhost:8080/' + getMechanismImagePath(type, charges);
  }

  /**
   * Get mechanism title (localized name)
   */
  getMechanismTitle(type: string): string {
    return getMechanismDisplayName(type);
  }

  /**
   * Get spell name by ID
   */
  getSpellName(spellId: string): string {
    const build = this.buildService.selectedBuildA();
    if (!build) return spellId;

    // SpellReference contient spellId, pas id ni name
    const spellRef = build.spellBar.spells.find(s => s?.spellId === spellId);

    // Retourne l'ID car SpellReference ne contient pas le nom
    return spellRef?.spellId || spellId;
  }

  /**
   * Navigation - Step by step
   * Exécute un seul step à la fois avec validation complète
   */
  async onNextStep(): Promise<void> {
    const timeline = this.currentTimeline();
    const build = this.buildService.selectedBuildA();
    const currentIndex = this.currentStepIndex();

    console.log('');
    console.log('🔵 [onNextStep] DÉBUT - Index actuel:', currentIndex);

    if (!timeline || !build) {
      console.warn('⚠️ Timeline ou Build manquant');
      return;
    }
    if (!this.boardService.hasMinimumSetup()) {
      alert('Placez au moins 1 allié et 1 ennemi sur le board avant de simuler.');
      return;
    }

    // Si c'est la première étape, sauvegarder l'état initial
    if (currentIndex === 0) {
      console.log('💾 Sauvegarde de l\'état initial du board');
      this.boardService.saveInitialState();
    }

    // Vérifier qu'il reste des steps à exécuter
    if (currentIndex >= timeline.steps.length) {
      console.warn('⚠️ Aucun step suivant disponible');
      return;
    }

    const realStepIndex = currentIndex;
    console.log(`\n🔹 [onNextStep] Exécution du step ${realStepIndex + 1}/${timeline.steps.length}...`);

    // ✅ Appeler executeStep pour valider et exécuter le step
    const success = await this.simulationService.executeStep(build, timeline, realStepIndex);

    if (!success) {
      console.error(`❌ Le step ${realStepIndex + 1} a échoué`);
      // Récupérer le message d'erreur depuis les résultats
      const stepResult = this.simulationService.getStepResult(realStepIndex);
      const failedAction = stepResult?.actions.find((a: any) => !a.success);
      const errorMessage = failedAction?.message || 'Action impossible à exécuter';

      alert(`⚠️ Erreur au step ${realStepIndex + 1}:\n${errorMessage}`);

      // ❌ NE PAS mettre à jour la map en cas d'échec
      console.log('🚫 Map non mise à jour (step échoué)');
      return;
    }

    console.log(`✅ Step ${realStepIndex + 1} exécuté avec succès`);

    // ✅ Le step a réussi : avancer l'index et mettre à jour le board
    this.timelineService.nextStep();

    // Appliquer les actions visuelles (mécanismes, etc.)
    const step = timeline.steps[realStepIndex];
    for (const action of step.actions) {
      await this.applyVisualAction(action, build, realStepIndex);
    }

    // Sauvegarder l'état après l'application
    this.boardService.pushState();

    // Si on vient d'exécuter le dernier step, afficher le récapitulatif de fin
    if (this.currentStepIndex() >= timeline.steps.length) {
      this.logFinalSimulationSummaryFromCache(timeline.steps.length);
    }

    const stepResult = this.simulationService.getStepResult(realStepIndex);
    if (stepResult) {
      const contextAfter = stepResult.contextAfter;
      if (contextAfter) {
        console.log('📈 Ressources restantes:', {
          PA: contextAfter.availablePa,
          WP: contextAfter.availablePw,
          MP: contextAfter.availableMp
        });
      }
    }

    console.log('🔵 [onNextStep] FIN');
    console.log('');
  }

  /**
   * Affiche un récapitulatif final basé sur le cache de simulation
   * Utilisé pour le mode étape par étape lorsqu'on atteint le dernier step
   */
  private logFinalSimulationSummaryFromCache(totalSteps: number): void {
    const stats = this.simulationService.getCacheStats();
    if (!stats) return;

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 SIMULATION ÉTAPE PAR ÉTAPE TERMINÉE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Résultats finaux:');
    console.log(`  ✅ Steps exécutés: ${stats.stepsExecuted}/${totalSteps}`);
    console.log(`  💥 Dégâts totaux: ${stats.totalDamage}`);
    if (stats.totalHeal > 0)   console.log(`  💚 Soins totaux: ${stats.totalHeal}`);
    if (stats.totalShield > 0) console.log(`  🛡️ Armure totale: ${stats.totalShield}`);
    console.log(`  ⚡ PA utilisés: ${stats.totalPaUsed}`);
    console.log(`  🔮 WP utilisés: ${stats.totalPwUsed}`);
    console.log(`  🏃 MP utilisés: ${stats.totalMpUsed}`);

    this.logRegenerationSummary(stats.totalPaUsed, stats.totalPwUsed);

    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  }

  private async applyVisualAction(action: TimelineAction, _build: Build, stepIndex: number): Promise<void> {
    if (action.type === 'CastSpell' && action.spellId) {
      // Vérifier si le sort crée un mécanisme
      console.log(`🔍 Analyse du sort: "${action.spellId}"`);
      const mechanismType = getSpellMechanismType(action.spellId);
      console.log(`🎯 Type de mécanisme détecté: ${mechanismType || 'aucun'}`);

      if (mechanismType && action.targetPosition) {
        // 🆕 Vérifier si un mécanisme de ce type existe déjà sur le plateau
        // La stratégie de classe (XelorSimulationStrategy) a déjà créé le mécanisme
        // lors de l'exécution de la simulation. On ne doit pas en créer un doublon.
        const existingMechanisms = this.boardService.getMechanismsByType(mechanismType);

        if (existingMechanisms.length > 0) {
          console.log(`ℹ️ Mécanisme ${mechanismType} déjà créé par la stratégie de classe - pas de doublon`);

          // 🆕 Pour les cadrans, vérifier aussi que les heures existent déjà
          if (mechanismType === 'dial') {
            const dialHours = this.boardService.dialHours();
            if (dialHours.length > 0) {
              console.log(`ℹ️ Heures du cadran déjà créées (${dialHours.length} heures) - pas de doublon`);
            }
          }
          return;
        }

        console.log(`✅ Création d'un mécanisme ${mechanismType} à la position (${action.targetPosition.x}, ${action.targetPosition.y})`);

        // Créer le mécanisme
        const mechanism: Mechanism = {
          id: `mechanism_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          type: mechanismType,
          position: action.targetPosition,
          charges: 0,
          turn: stepIndex + 1,
          spellId: action.spellId
        };

        // Ajouter le mécanisme au plateau
        this.boardService.addMechanism(mechanism);
        console.log('🎉 Mécanisme créé et ajouté au plateau:', mechanism);

        // Si c'est un cadran, créer les 12 heures autour
        if (mechanismType === 'dial') {
          const playerEntity = this.boardService.player();
          const playerPosition = playerEntity?.position || { x: 6, y: 6 };
          this.createDialHours(mechanism.id, action.targetPosition, playerPosition);
        }
      }
    }
  }

  /**
   * Crée les 12 heures autour d'un cadran
   */
  private createDialHours(dialId: string, centerPosition: Position, playerPosition: Position): void {
    console.log(`🕐 [DIAL_HOURS] Creating 12 hours around dial at (${centerPosition.x}, ${centerPosition.y})`);

    const dx = centerPosition.x - playerPosition.x;
    const dy = centerPosition.y - playerPosition.y;

    let rotation = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      rotation = dx > 0 ? 1 : 3;
    } else {
      rotation = dy > 0 ? 2 : 0;
    }

    const baseHourPositions = [
      { hour: 12, offsetX: 0, offsetY: -3 },
      { hour: 1, offsetX: +1, offsetY: -2 },
      { hour: 2, offsetX: +2, offsetY: -1 },
      { hour: 3, offsetX: +3, offsetY: 0 },
      { hour: 4, offsetX: +2, offsetY: +1 },
      { hour: 5, offsetX: +1, offsetY: +2 },
      { hour: 6, offsetX: 0, offsetY: +3 },
      { hour: 7, offsetX: -1, offsetY: +2 },
      { hour: 8, offsetX: -2, offsetY: +1 },
      { hour: 9, offsetX: -3, offsetY: 0 },
      { hour: 10, offsetX: -2, offsetY: -1 },
      { hour: 11, offsetX: -1, offsetY: -2 }
    ];

    baseHourPositions.forEach(({ hour, offsetX, offsetY }) => {
      let rotatedX = offsetX;
      let rotatedY = offsetY;

      // Rotation de 90 degrés (sens horaire) appliquée 'rotation' fois
      for (let i = 0; i < rotation; i++) {
        // Formule de rotation: (x, y) -> (-y, x)
        const newX = -rotatedY;
        const newY = rotatedX;
        rotatedX = newX;
        rotatedY = newY;
      }

      const hourPosition = {
        x: centerPosition.x + rotatedX,
        y: centerPosition.y + rotatedY
      };

      if (hourPosition.x >= 0 && hourPosition.x < 13 && hourPosition.y >= 0 && hourPosition.y < 13) {
        const dialHour = {
          id: `dial_hour_${hour}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          dialId: dialId,
          hour: hour,
          position: hourPosition
        };

        this.boardService.addDialHour(dialHour);
        console.log(`  ✅ Hour ${hour} created at (${hourPosition.x}, ${hourPosition.y})`);
      }
    });
  }

  onPreviousStep(): void {
    const currentIndex = this.currentStepIndex();

    if (currentIndex > 0) {
      // Revenir à l'étape précédente
      this.timelineService.previousStep();

      // Restaurer l'état du board à l'étape précédente
      const newIndex = this.currentStepIndex();
      this.boardService.restoreStateAtIndex(newIndex);

      // Tronquer le cache de simulation pour conserver uniquement les steps encore valides
      // et permettre une reprise correcte avec "Étape suivante"
      this.simulationService.trimSimulationCacheToStep(newIndex);

      console.log(`⏮️ Retour à l'étape ${newIndex} - Cache de simulation tronqué`);
    }
  }

  onReset(): void {
    // Réinitialiser la timeline à l'étape 0
    this.timelineService.resetTimeline();

    // Restaurer l'état initial du board
    this.boardService.restoreInitialState();

    // Nettoyer le cache de simulation
    this.simulationService.clearSimulation();

    // Nettoyer l'historique de régénération
    this.regenerationService.clearHistory();

    console.log('🔄 Timeline et Board réinitialisés');
  }

  /**
   * Lance toute la simulation d'un coup
   * Exécute tous les steps avec validation à chaque étape
   * Met à jour le board à chaque step réussi
   * S'arrête et retourne l'erreur si un step échoue
   */
  async onRunFullSimulation(): Promise<void> {
    const timeline = this.currentTimeline();
    const build = this.buildService.selectedBuildA();

    if (!timeline || !build) {
      console.warn('⚠️ Timeline ou Build manquant');
      return;
    }

    if (!this.boardService.hasMinimumSetup()) {
      alert('Placez au moins 1 allié et 1 ennemi sur le board avant de simuler.');
      return;
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 LANCEMENT SIMULATION COMPLÈTE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 Timeline:', timeline.name);
    console.log('🔢 Nombre de steps:', timeline.steps.length);

    // Sauvegarder l'état initial
    this.boardService.saveInitialState();
    console.log('💾 État initial sauvegardé');

    // Réinitialiser le service de simulation
    this.simulationService.clearSimulation();

    // Exécuter chaque step un par un
    for (let stepIndex = 0; stepIndex < timeline.steps.length; stepIndex++) {
      const step = timeline.steps[stepIndex];
      console.log('');
      console.log(`┌───────────────────────────────────────────────────────┐`);
      console.log(`│  🔹 STEP ${stepIndex + 1}/${timeline.steps.length}: ${step.description || step.id}`);
      console.log(`└───────────────────────────────────────────────────────┘`);

      // ✅ Exécuter le step avec validation complète
      const success = await this.simulationService.executeStep(build, timeline, stepIndex);

      if (!success) {
        const stepResult = this.simulationService.getStepResult(stepIndex);
        const failedAction = stepResult?.actions.find((a: any) => !a.success);
        const errorMessage = failedAction?.message || 'Action impossible à exécuter';

        console.error(`❌ Step ${stepIndex + 1} échoué`);
        console.log(`❌ Simulation arrêtée au step ${stepIndex + 1}`);

        alert(`⚠️ Simulation arrêtée au step ${stepIndex + 1}:\n${errorMessage}`);
        return;
      }

      console.log(`✅ Step ${stepIndex + 1} exécuté avec succès`);

      // Log du contexte après le step (ressources restantes)
      const stepResult = this.simulationService.getStepResult(stepIndex);
      if (stepResult) {
        const contextAfter = stepResult.contextAfter;
        if (contextAfter) {
          console.log('📈 Ressources restantes:', {
            PA: contextAfter.availablePa,
            WP: contextAfter.availablePw,
            MP: contextAfter.availableMp
          });
        }
      }

      // Avancer l'index de la timeline
      this.timelineService.nextStep();

      // Appliquer les actions visuelles au board (mécanismes, etc.)
      for (const action of step.actions) {
        await this.applyVisualAction(action, build, stepIndex);
      }

      // Sauvegarder l'état du board après ce step
      this.boardService.pushState();

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Récapitulatif final via le cache centralisé
    const stats = this.simulationService.getCacheStats();
    if (stats) {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('🎉 SIMULATION COMPLÈTE TERMINÉE AVEC SUCCÈS');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📊 Résultats finaux:');
      console.log(`  ✅ Steps exécutés: ${stats.stepsExecuted}/${timeline.steps.length}`);
      console.log(`  💥 Dégâts totaux: ${stats.totalDamage}`);
      if (stats.totalHeal > 0)   console.log(`  💚 Soins totaux: ${stats.totalHeal}`);
      if (stats.totalShield > 0) console.log(`  🛡️ Armure totale: ${stats.totalShield}`);
      console.log(`  ⚡ PA utilisés: ${stats.totalPaUsed}`);
      console.log(`  🔮 WP utilisés: ${stats.totalPwUsed}`);
      console.log(`  🏃 MP utilisés: ${stats.totalMpUsed}`);

      this.logRegenerationSummary(stats.totalPaUsed, stats.totalPwUsed);

      console.log('═══════════════════════════════════════════════════════');
      console.log('');
    }
  }

  /**
   * Affiche le résumé de régénération de ressources depuis le service centralisé
   */
  private logRegenerationSummary(totalPaUsed: number, totalWpUsed: number): void {
    const regenSummary = this.regenerationService.getRegenerationSummary();
    if (regenSummary.totalPaRegenerated <= 0 && regenSummary.totalPwRegenerated <= 0) return;

    console.log('');
    console.log('💫 RÉGÉNÉRATION TOTALE:');
    console.log(`  💫 ⚡ PA régénérés: +${regenSummary.totalPaRegenerated}`);
    console.log(`  💫 🔮 PW régénérés: +${regenSummary.totalPwRegenerated}`);
    console.log(`  📈 Bilan net PA: ${regenSummary.totalPaRegenerated - totalPaUsed}`);
    console.log(`  📈 Bilan net PW: ${regenSummary.totalPwRegenerated - totalWpUsed}`);

    if (regenSummary.bySource.size > 0) {
      console.log('');
      console.log('💫 Détail par source:');
      regenSummary.bySource.forEach((sourceStats, source) => {
        const parts: string[] = [];
        if (sourceStats.pa > 0) parts.push(`+${sourceStats.pa} PA`);
        if (sourceStats.pw > 0) parts.push(`+${sourceStats.pw} PW`);
        console.log(`  💫   • ${source}: ${parts.join(', ')}`);
      });
    }
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

  onCellClick(cell: BoardCell): void {
    this.boardCellClick.emit({ x: cell.x, y: cell.y });
  }
}
