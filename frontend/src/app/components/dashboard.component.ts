/**
 * Dashboard Component - Main Application View
 * Demonstrates working services and data binding
 */

import {Component, inject, signal, ViewChild, input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {BuildService} from '../services/build.service';
import {TimelineService} from '../services/timeline.service';
import {BoardService} from '../services/board.service';
import {TimelineRecorderComponent} from './timeline-recorder.component';
import {BoardComponent} from './board.component';
import {PlayerFormComponent} from './player-form.component';
import {EnemyFormComponent} from './enemy-form.component';
import { Timeline } from '../models/timeline.model';
import {SimulationService} from '../services/simulation.service';
import {DamageSummaryComponent} from './damage-summary.component';
import { IconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, TimelineRecorderComponent, BoardComponent, PlayerFormComponent, EnemyFormComponent, DamageSummaryComponent, IconComponent],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <header class="header">
        <div class="header-selectors">
          <!-- Build selector -->
          <div class="selector-group">
            <label class="selector-label">Build</label>
            <div class="selector-dropdown" (click)="toggleBuildDropdown()">
              <span class="selector-value">{{ buildService.selectedBuildA()?.name || 'Aucun build' }}</span>
              <span class="selector-arrow" [class.open]="showBuildDropdown()">▾</span>
            </div>
            <div class="dropdown-menu" *ngIf="showBuildDropdown()">
              <div class="dropdown-item"
                   *ngFor="let build of buildService.allBuilds()"
                   [class.active]="build.id === buildService.selectedBuildA()?.id"
                   (click)="onSelectBuild(build); closeBuildDropdown()">
                <span class="dropdown-item-name">{{ build.name }}</span>
                <span class="dropdown-item-meta">{{ build.classId }} • Lvl.{{ build.characterLevel }}</span>
                <div class="dropdown-item-actions" (click)="$event.stopPropagation()">
                  <button (click)="onOpenBuildStats($event, build)" class="btn-mini" title="Stats">📊</button>
                  <button (click)="onEditBuild($event, build)" class="btn-mini" title="Modifier">✏️</button>
                  <button (click)="onDeleteBuild($event, build)" class="btn-mini btn-mini-danger" title="Supprimer">🗑️</button>
                </div>
              </div>
              <button class="dropdown-add" (click)="onCreateBuild(); closeBuildDropdown()">➕ Nouveau Build</button>
            </div>
          </div>

          <!-- Timeline selector (Timeline mode uniquement) -->
          @if (mode() === 'timeline') {
          <div class="selector-group">
            <label class="selector-label">Timeline</label>
            <div class="selector-dropdown" (click)="toggleTimelineDropdown()">
              <span class="selector-value">{{ getSelectedTimelineName() }}</span>
              <span class="selector-arrow" [class.open]="showTimelineDropdown()">▾</span>
            </div>
            <div class="dropdown-menu" *ngIf="showTimelineDropdown()">
              <div class="dropdown-item"
                   *ngFor="let timeline of timelineService.allTimelines()"
                   [class.active]="timelineService.currentTimelineId() === timeline.id"
                   (click)="onSelectTimeline(timeline); closeTimelineDropdown()">
                <span class="dropdown-item-name">{{ timeline.name }}</span>
                <span class="dropdown-item-meta">{{ timeline.steps.length }} étapes</span>
                <div class="dropdown-item-actions" (click)="$event.stopPropagation()">
                  <button (click)="onEditTimeline($event, timeline)" class="btn-mini" title="Modifier">✏️</button>
                  <button (click)="onDeleteTimeline($event, timeline)" class="btn-mini btn-mini-danger" title="Supprimer">🗑️</button>
                </div>
              </div>
              <button class="dropdown-add" (click)="onCreateTimeline(); closeTimelineDropdown()">➕ Nouvelle Timeline</button>
            </div>
          </div>
          }
        </div>
        <div class="header-tools">
          <button class="tool-btn" (click)="onAddPlayer()" title="Ajouter un allié" aria-label="Ajouter un allié"><ui-icon name="user-plus"></ui-icon></button>
          <button class="tool-btn" (click)="onAddEnemy()" title="Ajouter un ennemi" aria-label="Ajouter un ennemi"><ui-icon name="target"></ui-icon></button>
          <button class="tool-btn" (click)="onAddCog()" title="Ajouter un rouage" aria-label="Ajouter un rouage"><ui-icon name="cog"></ui-icon></button>
          <button class="tool-btn" (click)="onExportBuild()" title="Exporter le build" aria-label="Exporter le build"><ui-icon name="download"></ui-icon></button>
          @if (mode() === 'timeline') {
            <button class="tool-btn" (click)="onValidateTimeline()" title="Valider la timeline" aria-label="Valider la timeline"><ui-icon name="check"></ui-icon></button>
            <button class="tool-btn" (click)="onSaveBoardSetup()" [disabled]="!timelineService.currentTimeline()" title="Sauver la map dans la timeline" aria-label="Sauver la map dans la timeline"><ui-icon name="save"></ui-icon></button>
          }
          <button class="tool-btn danger" (click)="onClearBoard()" title="Effacer la map" aria-label="Effacer la map"><ui-icon name="trash"></ui-icon></button>
        </div>
        <app-damage-summary [compact]="true" class="header-damage"></app-damage-summary>
      </header>

      <!-- Backdrop to close dropdowns -->
      <div class="dropdown-backdrop" *ngIf="showBuildDropdown() || showTimelineDropdown()" (click)="closeAllDropdowns()"></div>

      <div class="container">
        <!-- Main Content -->
        <main class="content">
          <!-- Board Component - Interactive Map -->
          <section class="section board-section">
            <app-board
              [mode]="mode()"
              (editPlayer)="onEditPlayerFromBoard($event)"
              (editEnemy)="onEditEnemyFromBoard($event)"
              [placementMode]="placementMode()"
              (boardCellClick)="onBoardCellClick($event)"
            ></app-board>
            @if (mode() === 'freeplay') {
              <app-timeline-recorder></app-timeline-recorder>
            }
          </section>
        </main>
      </div>
        <div class="build-stats-modal" *ngIf="statsBuildModal() as build" (click)="closeBuildStats()">
          <div class="build-stats-content" (click)="$event.stopPropagation()">
            <h2>{{ build.name }} — Stats</h2>
            <div class="info-grid">
              <div class="info-item"><label>Classe</label><span>{{ build.classId }}</span></div>
              <div class="info-item"><label>Niveau</label><span>{{ build.characterLevel }}</span></div>
              <div class="info-item"><label>PA / PM / PW</label><span>{{ build.stats.ap }} / {{ build.stats.mp }} / {{ build.stats.wp }}</span></div>
              <div class="info-item"><label>Portée</label><span>{{ build.stats.range }}</span></div>
              <div class="info-item"><label>Maîtrise Feu</label><span>{{ build.stats.masteryFire }}</span></div>
              <div class="info-item"><label>Maîtrise Eau</label><span>{{ build.stats.masteryWater }}</span></div>
              <div class="info-item"><label>Maîtrise Terre</label><span>{{ build.stats.masteryEarth }}</span></div>
              <div class="info-item"><label>Maîtrise Air</label><span>{{ build.stats.masteryAir }}</span></div>
              <div class="info-item"><label>Critique</label><span>{{ build.stats.critRate }}%</span></div>
              <div class="info-item"><label>Maîtrise crit.</label><span>{{ build.stats.critMastery }}</span></div>
            </div>
          </div>
        </div>
      </div>

    <!-- Player Form Modal -->
    <app-player-form
      #playerForm
      (playerAdded)="onPlayerAdded($event)"
      (playerEdited)="onPlayerEdited($event)">
    </app-player-form>

    <!-- Enemy Form Modal -->
    <app-enemy-form
      #enemyForm
      (enemyAdded)="onEnemyAdded($event)"
      (enemyEdited)="onEnemyEdited($event)">
    </app-enemy-form>
  `,
  styles: [`
    /* Design tokens are provided globally via --app-* variables */

    .dashboard {
      background: var(--app-bg);
      color: var(--app-text);
      min-height: 100vh;
      font-family: Inter, Segoe UI, system-ui, -apple-system, Arial;
    }

    .header {
      background: var(--app-surface);
      border-bottom: 1px solid var(--app-border);
      padding: 12px 20px;
      display: flex;
      justify-content: flex-start;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .header-damage { margin-left: auto; }

    .header h1 {
      margin: 0;
      font-size: 20px;
      white-space: nowrap;
    }

    /* ── Header selectors ── */
    .header-selectors {
      display: flex;
      gap: 12px;
      align-items: center;
      flex: 1;
      justify-content: center;
    }

    .selector-group {
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .selector-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--app-accent);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .selector-dropdown {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--app-surface-2);
      border: 1px solid var(--app-border);
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      min-width: 140px;
      max-width: 220px;
      transition: all 0.2s;
    }

    .selector-dropdown:hover {
      border-color: var(--app-accent);
      background: var(--app-surface-2);
    }

    .selector-value {
      flex: 1;
      font-size: 12px;
      font-weight: 600;
      color: var(--app-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .selector-arrow {
      font-size: 10px;
      color: var(--app-text-muted);
      transition: transform 0.2s;
    }

    .selector-arrow.open {
      transform: rotate(180deg);
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 8px;
      padding: 4px;
      z-index: 1000;
      max-height: 300px;
      overflow-y: auto;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      min-width: 240px;
    }

    .dropdown-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
      position: relative;
    }

    .dropdown-item:hover {
      background: var(--app-surface-2);
    }

    .dropdown-item.active {
      background: color-mix(in srgb, var(--app-accent) 15%, transparent);
      border-left: 3px solid var(--app-accent);
    }

    .dropdown-item-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--app-text);
    }

    .dropdown-item-meta {
      font-size: 10px;
      color: var(--app-text-muted);
    }

    .dropdown-item-actions {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      gap: 2px;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .dropdown-item:hover .dropdown-item-actions {
      opacity: 1;
    }

    .btn-mini {
      background: transparent;
      border: 1px solid var(--app-border);
      color: var(--app-text);
      border-radius: 4px;
      padding: 2px 6px;
      cursor: pointer;
      font-size: 10px;
      transition: all 0.15s;
    }

    .btn-mini:hover {
      background: var(--app-accent);
      color: var(--app-accent-contrast);
      border-color: var(--app-accent);
    }

    .btn-mini-danger:hover {
      background: var(--app-danger);
      border-color: var(--app-danger);
      color: white;
    }

    .dropdown-add {
      width: 100%;
      background: transparent;
      border: 1px dashed var(--app-border);
      color: var(--app-accent);
      border-radius: 6px;
      padding: 8px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      margin-top: 4px;
      transition: all 0.15s;
    }

    .dropdown-add:hover {
      background: color-mix(in srgb, var(--app-accent) 10%, transparent);
      border-color: var(--app-accent);
    }

    .dropdown-backdrop {
      position: fixed;
      inset: 0;
      z-index: 999;
    }

    button {
      background: var(--app-accent);
      color: var(--app-accent-contrast);
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      cursor: pointer;
      font-weight: 500;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    button:hover:not(:disabled) {
      opacity: 0.9;
    }

    .btn-secondary {
      background: var(--app-surface-2);
      color: var(--app-text);
      border: 1px solid var(--app-border);
    }

    .btn-danger {
      background: var(--app-danger);
      color: white;
    }

    .container {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 12px;
      min-height: calc(100vh - 72px);
    }

    .panel {
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 8px;
      padding: 16px;
      overflow-y: auto;
      max-height: 90vh;
    }

    .panel h2 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: var(--app-accent);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .panel h3 {
      margin: 16px 0 8px 0;
      font-size: 12px;
      color: var(--app-text-muted);
    }

    .builds-list, .timelines-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .build-item {
      background: var(--app-surface-2);
      border: 1px solid var(--app-border);
      border-radius: 6px;
      padding: 8px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .build-item:hover {
      border-color: var(--app-accent);
      background: var(--app-surface-2);
    }

    .build-item.active {
      border-color: var(--app-accent);
      background: #2c3a5a;
      box-shadow: 0 0 8px color-mix(in srgb, var(--app-accent) 30%, transparent);
    }

    .build-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .build-item:hover .build-actions {
      opacity: 1;
    }

    .btn-edit, .btn-delete {
      background: transparent;
      border: 1px solid var(--app-border);
      color: var(--app-text);
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
    }

    .btn-edit:hover {
      background: var(--app-accent);
      color: var(--app-accent-contrast);
      border-color: var(--app-accent);
    }

    .btn-delete:hover {
      background: var(--app-danger);
      color: white;
      border-color: var(--app-danger);
    }

    .btn-add {
      width: 100%;
      background: var(--app-surface-2);
      border: 1px solid var(--app-border);
      color: var(--app-text);
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      margin-bottom: 8px;
      transition: all 0.2s;
    }

    .btn-add:hover {
      background: var(--app-accent);
      color: var(--app-accent-contrast);
      border-color: var(--app-accent);
    }

    .timeline-item {
      background: var(--app-surface-2);
      border: 1px solid var(--app-border);
      border-radius: 6px;
      padding: 8px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .timeline-item.active {
      background: linear-gradient(135deg, color-mix(in srgb, var(--app-accent) 20%, transparent), rgba(90, 215, 240, 0.15));
      border-color: var(--app-accent);
      box-shadow: 0 0 12px color-mix(in srgb, var(--app-accent) 30%, transparent);
    }

    .timeline-item:hover {
      border-color: var(--app-accent);
      background: var(--app-surface-2);
    }

    .timeline-item.active:hover {
      box-shadow: 0 0 16px color-mix(in srgb, var(--app-accent) 50%, transparent);
    }

    .timeline-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .timeline-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .timeline-item:hover .timeline-actions {
      opacity: 1;
    }

    .active-badge {
      display: inline-block;
      margin-left: 8px;
      color: var(--app-accent);
      font-size: 12px;
      animation: pulse-badge 1.5s ease-in-out infinite;
    }

    @keyframes pulse-badge {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .timeline-name, .timeline-meta {
      font-weight: 600;
      color: var(--app-text);
      font-size: 13px;
    }

    .timeline-name {
      flex: 1;
    }

    .build-name {
      font-weight: 600;
      color: var(--app-text);
      font-size: 13px;
    }

    hr {
      border: none;
      border-top: 1px solid var(--app-border);
      margin: 12px 0;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
      max-height: 90vh;
    }

    .section {
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 8px;
      padding: 16px;
    }

    .section h2 {
      margin: 0 0 12px 0;
      font-size: 16px;
      color: var(--app-text);
    }

    .section h3 {
      margin: 12px 0 8px 0;
      font-size: 13px;
      color: var(--app-accent);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .section-header h2 {
      margin: 0;
      flex: 1;
    }

    .btn-toggle-section {
      background: transparent;
      border: 1px solid var(--app-border);
      color: var(--app-accent);
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.3s ease;
      min-width: 40px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-toggle-section:hover {
      background: color-mix(in srgb, var(--app-accent) 10%, transparent);
      border-color: var(--app-accent);
    }

    .btn-toggle-section.collapsed {
      color: var(--app-text-muted);
      border-color: var(--app-border);
    }

    .btn-toggle-section.collapsed:hover {
      background: color-mix(in srgb, var(--app-accent) 5%, transparent);
      color: var(--app-accent);
    }

    .section-content {
      overflow: hidden;
      transition: all 0.3s ease;
      max-height: 1000px;
      opacity: 1;
    }

    .section-content.collapsed {
      max-height: 0;
      opacity: 0;
      padding: 0;
      margin: 0;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      background: var(--app-surface-2);
      padding: 12px;
      border-radius: 8px;
      gap: 8px;
      transition: all 0.3s ease;
      border: 1px solid color-mix(in srgb, var(--app-accent) 10%, transparent);
    }

    .info-item:hover {
      border-color: color-mix(in srgb, var(--app-accent) 30%, transparent);
      background: linear-gradient(135deg, color-mix(in srgb, var(--app-accent) 5%, transparent), rgba(90, 215, 240, 0.02));
      box-shadow: 0 4px 12px color-mix(in srgb, var(--app-accent) 10%, transparent);
    }

    .info-item label {
      display: inline-block;
      background: linear-gradient(135deg, var(--app-accent), #5ad5f0);
      color: var(--app-accent-contrast);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      box-shadow: 0 4px 12px color-mix(in srgb, var(--app-accent) 25%, transparent);
      width: fit-content;
      transition: all 0.3s ease;
    }

    .stat-icon {
      width: 14px;
      height: 14px;
      vertical-align: middle;
      margin-right: 3px;
      object-fit: contain;
    }

    .info-item:hover label {
      box-shadow: 0 6px 16px color-mix(in srgb, var(--app-accent) 35%, transparent);
      transform: translateY(-2px);
    }

    .build-meta, .timeline-meta {
      font-size: 11px;
      color: var(--app-text-muted);
      margin-top: 4px;
    }

    .info-item span {
      font-size: 15px;
      color: var(--app-text);
      font-weight: 600;
      padding: 6px 8px;
      background: color-mix(in srgb, var(--app-accent) 8%, transparent);
      border-radius: 6px;
      border-left: 3px solid var(--app-accent);
    }

    .no-data {
      color: var(--app-text-muted);
      font-style: italic;
      text-align: center;
      padding: 20px;
    }

    /* Entity type styles moved to BoardComponent */

    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .actions button {
      width: 100%;
      justify-content: flex-start;
      padding: 10px;
      font-size: 12px;
    }

    .placement-hint {
      margin-top: 12px;
      background: rgba(123, 216, 143, 0.12);
      border: 1px solid rgba(123, 216, 143, 0.5);
      border-radius: 6px;
      padding: 10px;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn-cancel-placement {
      background: transparent;
      border: 1px solid var(--app-border);
      color: var(--app-text);
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 11px;
    }

    .stats {
      background: var(--app-surface-2);
      padding: 12px;
      border-radius: 6px;
      font-size: 12px;
    }

    .stats > div {
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .badge {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
    }

    .badge.valid {
      background: var(--app-success);
      color: var(--app-accent-contrast);
    }

    @media (max-width: 1200px) {
      .container {
        grid-template-columns: 1fr;
      }
    }

    .build-stats-modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      padding: 24px;
    }

    .build-stats-content {
      width: min(900px, 95vw);
      max-height: 80vh;
      overflow: auto;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 12px;
      padding: 16px;
    }

    .header-tools { display: flex; align-items: center; gap: 4px; }
    .tool-btn { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 8px; background: transparent; border: 1px solid var(--app-border); color: var(--app-text); cursor: pointer; }
    .tool-btn:hover { border-color: var(--app-border-strong); background: var(--app-surface-2); }
    .tool-btn:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; }
    .tool-btn.danger:hover { border-color: var(--app-danger); color: var(--app-danger); }
    .tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  `]
})
export class DashboardComponent {
  readonly mode = input<'timeline' | 'freeplay'>('timeline');

  buildService = inject(BuildService);
  timelineService = inject(TimelineService);
  boardService = inject(BoardService);
  simulationService = inject(SimulationService);
  private readonly router = inject(Router);

  showBuildDropdown = signal<boolean>(false);
  showTimelineDropdown = signal<boolean>(false);
  statsBuildModal = signal<any | null>(null);
  placementMode = signal<'none' | 'player' | 'enemy' | 'player-edit' | 'enemy-edit' | 'cog'>('none');

  toggleBuildDropdown(): void {
    this.showBuildDropdown.update(v => !v);
    this.showTimelineDropdown.set(false);
  }

  closeBuildDropdown(): void {
    this.showBuildDropdown.set(false);
  }

  toggleTimelineDropdown(): void {
    this.showTimelineDropdown.update(v => !v);
    this.showBuildDropdown.set(false);
  }

  closeTimelineDropdown(): void {
    this.showTimelineDropdown.set(false);
  }

  getSelectedTimelineName(): string {
    const currentId = this.timelineService.currentTimelineId();
    if (!currentId) return 'Aucune timeline';
    const tl = this.timelineService.allTimelines().find(t => t.id === currentId);
    return tl?.name || 'Aucune timeline';
  }

  closeAllDropdowns(): void {
    this.showBuildDropdown.set(false);
    this.showTimelineDropdown.set(false);
  }

  countNonNull(items: any[]): number {
    return items.filter(item => item !== null).length;
  }

  onSelectBuild(build: any): void {
    this.buildService.selectBuildA(build);
  }

  onOpenBuildStats(event: Event, build: any): void {
    event.stopPropagation();
    this.statsBuildModal.set(build);
  }

  closeBuildStats(): void {
    this.statsBuildModal.set(null);
  }

  onSelectTimeline(timeline: Timeline): void {
    this.timelineService.loadTimeline(timeline.id);
    this.boardService.applyTimelineSetup(timeline.boardSetup);

    if (!timeline.boardSetup || timeline.boardSetup.entities.length === 0) {
      alert("Cette timeline n'a pas de setup sauvegardé. Placez au moins 1 allié et 1 ennemi sur le board.");
    }
  }

  async onSaveBoardSetup(): Promise<void> {
    const timeline = this.timelineService.currentTimeline();
    if (!timeline) {
      return;
    }

    const updated = await this.timelineService.updateTimeline(timeline.id, {
      boardSetup: this.boardService.exportCurrentSetup()
    });

    if (updated) {
      alert('✓ Setup du board sauvegardé dans la timeline !');
    } else {
      alert('Erreur lors de la sauvegarde du setup du board');
    }
  }

  onValidateTimeline(): void {
    const result = this.timelineService.validateTimeline();
    alert(result.valid ? '✓ Timeline is valid!' : '✗ Errors:\n' + result.errors.join('\n'));
  }

  onAddStep(): void {
    alert('Add step functionality - to be implemented');
  }

  onExportBuild(): void {
    const build = this.buildService.selectedBuildA();
    if (build) {
      const json = this.buildService.exportBuild(build.id);
      console.log(json);
      alert('Build exported! (Check console)');
    }
  }

  onAddEnemy(): void {
    this.enemyForm.openNew();
  }

  onEnemyAdded(enemyData: { name: string; facing: { direction: string } }): void {
    this.pendingEnemyData = enemyData;
    this.placementMode.set('enemy');
  }

  onEnemyEdited(data: { id: string; name: string; facing: { direction: string } }): void {
    this.pendingEnemyEditData = data;
    this.placementMode.set('enemy-edit');
  }

  onAddPlayer(): void {
    this.playerForm.openNew();
  }

  onPlayerAdded(playerData: { name: string; classId: string; facing: { direction: string } }): void {
    this.pendingPlayerData = playerData;
    this.placementMode.set('player');
  }

  onPlayerEdited(data: { id: string; name: string; classId: string; facing: { direction: string } }): void {
    this.pendingPlayerEditData = data;
    this.placementMode.set('player-edit');
  }

  onEditPlayerFromBoard(entity: any): void {
    this.playerForm.openEdit({
      id: entity.id,
      name: entity.name,
      classId: entity.classId,
      position: entity.position,
      facing: entity.facing
    });
  }

  onEditEnemyFromBoard(entity: any): void {
    this.enemyForm.openEdit({
      id: entity.id,
      name: entity.name,
      position: entity.position,
      facing: entity.facing
    });
  }

  pendingPlayerData: { name: string; classId: string; facing: { direction: string } } | null = null;
  pendingEnemyData: { name: string; facing: { direction: string } } | null = null;
  pendingPlayerEditData: { id: string; name: string; classId: string; facing: { direction: string } } | null = null;
  pendingEnemyEditData: { id: string; name: string; facing: { direction: string } } | null = null;

  onAddCog(): void {
    this.placementMode.set('cog');
  }

  onBoardCellClick(position: { x: number; y: number }): void {
    if (this.placementMode() === 'player' && this.pendingPlayerData) {
      const newPlayer = {
        id: `player_${Date.now()}`,
        type: 'player' as const,
        name: this.pendingPlayerData.name,
        classId: this.pendingPlayerData.classId,
        position,
        facing: { direction: this.pendingPlayerData.facing.direction as 'front' | 'side' | 'back' }
      };
      this.boardService.addEntity(newPlayer);
      this.simulationService.clearSimulation();
      this.pendingPlayerData = null;
      this.placementMode.set('none');
      return;
    }

    if (this.placementMode() === 'enemy' && this.pendingEnemyData) {
      const newEnemy = {
        id: `enemy_${Date.now()}`,
        type: 'enemy' as const,
        name: this.pendingEnemyData.name,
        position,
        facing: { direction: this.pendingEnemyData.facing.direction as 'front' | 'side' | 'back' }
      };
      this.boardService.addEntity(newEnemy);
      this.simulationService.clearSimulation();
      this.pendingEnemyData = null;
      this.placementMode.set('none');
      return;
    }

    if (this.placementMode() === 'player-edit' && this.pendingPlayerEditData) {
      this.boardService.updateEntity(this.pendingPlayerEditData.id, {
        name: this.pendingPlayerEditData.name,
        classId: this.pendingPlayerEditData.classId,
        position,
        facing: { direction: this.pendingPlayerEditData.facing.direction as 'front' | 'side' | 'back' }
      });
      this.pendingPlayerEditData = null;
      this.simulationService.clearSimulation();
      this.placementMode.set('none');
      return;
    }

    if (this.placementMode() === 'enemy-edit' && this.pendingEnemyEditData) {
      this.boardService.updateEntity(this.pendingEnemyEditData.id, {
        name: this.pendingEnemyEditData.name,
        position,
        facing: { direction: this.pendingEnemyEditData.facing.direction as 'front' | 'side' | 'back' }
      });
      this.pendingEnemyEditData = null;
      this.simulationService.clearSimulation();
      this.placementMode.set('none');
      return;
    }

    if (this.placementMode() === 'cog') {
      this.boardService.addMechanism({
        id: `mechanism_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type: 'cog',
        position,
        charges: 0
      });
      this.simulationService.clearSimulation();
      this.placementMode.set('none');
    }
  }

  placementInstruction(): string {
    const mode = this.placementMode();
    if (mode === 'player') return 'Cliquez sur une case de la map pour placer le joueur.';
    if (mode === 'enemy') return "Cliquez sur une case de la map pour placer l'ennemi.";
    if (mode === 'player-edit') return 'Cliquez sur une case de la map pour déplacer le joueur modifié.';
    if (mode === 'enemy-edit') return "Cliquez sur une case de la map pour déplacer l'ennemi modifié.";
    return 'Cliquez sur une case de la map pour placer le rouage.';
  }

  cancelPlacement(): void {
    this.placementMode.set('none');
    this.pendingEnemyData = null;
    this.pendingPlayerData = null;
    this.pendingEnemyEditData = null;
    this.pendingPlayerEditData = null;
  }

  onClearBoard(): void {
    this.boardService.clearBoard();
    this.timelineService.clearCurrentTimeline();
    this.simulationService.clearSimulation();
    this.cancelPlacement();
    alert('✓ Plateau et timeline complètement effacés !');
  }

  @ViewChild('playerForm') playerForm!: PlayerFormComponent;
  @ViewChild('enemyForm') enemyForm!: EnemyFormComponent;

  onCreateBuild(): void {
    this.router.navigate(['/builds/nouveau']);
  }

  onEditBuild(event: any, build: any): void {
    event?.stopPropagation?.();
    this.router.navigate(['/builds', build.id, 'edition']);
  }

  onDeleteBuild(event: any, build: any): void {
    event.stopPropagation();
    if (confirm(`Supprimer le build "${build.name}"?`)) {
      this.buildService.deleteBuild(build.id);
      alert('Build supprimé!');
    }
  }

  onCreateTimeline(): void {
    this.router.navigate(['/freeplay']);
  }

  onEditTimeline(event: any, timeline: any): void {
    event?.stopPropagation?.();
    const name = window.prompt('Nouveau nom de la timeline :', timeline.name);
    if (name && name.trim()) {
      this.timelineService.updateTimeline(timeline.id, { name: name.trim() });
    }
  }

  async onDeleteTimeline(event: any, timeline: any): Promise<void> {
    event.stopPropagation();
    if (confirm(`Supprimer la timeline "${timeline.name}"?`)) {
      const deleted = await this.timelineService.deleteTimeline(timeline.id);
      if (deleted) {
        alert('Timeline supprimée!');
      } else {
        alert('Erreur lors de la suppression de la timeline');
      }
    }
  }

  calculateTotalDamage(build: any): number {
    return build.stats.dommageInflict * (1 + build.stats.critRate / 100);
  }

  isTimelineValid(): boolean {
    const result = this.timelineService.validateTimeline();
    return result.valid;
  }
}
