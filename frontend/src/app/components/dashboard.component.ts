/**
 * Dashboard Component - Main Application View
 * Demonstrates working services and data binding
 */

import {Component, inject, signal, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {BuildService} from '../services/build.service';
import {TimelineService} from '../services/timeline.service';
import {BoardService} from '../services/board.service';
import {BuildFormComponent} from './build-form.component';
import {TimelineFormComponent} from './timeline-form.component';
import {BoardComponent} from './board.component';
import {PlayerFormComponent} from './player-form.component';
import {EnemyFormComponent} from './enemy-form.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, BuildFormComponent, TimelineFormComponent, BoardComponent, PlayerFormComponent, EnemyFormComponent],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <header class="header">
        <h1>🎮 Wakfu Simulator - Dashboard</h1>
      </header>

      <div class="container">
        <!-- Left Panel: Builds -->
        <aside class="panel">
          <h2>📦 Builds ({{ buildService.allBuilds().length }})</h2>
          <button (click)="onCreateBuild()" class="btn-add">➕ Nouveau Build</button>
          <div class="builds-list">
            <div
              *ngFor="let build of buildService.allBuilds()"
              class="build-item"
              [class.active]="build.id === buildService.selectedBuildA()?.id"
              (click)="onSelectBuild(build)"
            >
              <div class="build-name">{{ build.name }}</div>
              <div class="build-meta">
                {{ build.classId }} • Lvl.{{ build.characterLevel }}
              </div>
              <div class="build-actions">
                <button (click)="onEditBuild($event, build)" class="btn-edit">✏️</button>
                <button (click)="onDeleteBuild($event, build)" class="btn-delete">🗑️</button>
              </div>
            </div>
          </div>

          <hr />

          <h2>📋 Timelines ({{ timelineService.allTimelines().length }})</h2>
          <button (click)="onCreateTimeline()" class="btn-add">➕ Nouvelle Timeline</button>
          <div class="timelines-list">
            <div
              *ngFor="let timeline of timelineService.allTimelines()"
              class="timeline-item"
              [class.active]="timelineService.currentTimelineId() === timeline.id"
              (click)="onSelectTimeline(timeline)"
            >
              <div class="timeline-info">
                <div class="timeline-name">
                  {{ timeline.name }}
                  <span class="active-badge" *ngIf="timelineService.currentTimelineId() === timeline.id">●</span>
                </div>
                <div class="timeline-meta">{{ timeline.steps.length }} étapes</div>
              </div>
              <div class="timeline-actions">
                <button (click)="onEditTimeline($event, timeline)" class="btn-edit">✏️</button>
                <button (click)="onDeleteTimeline($event, timeline)" class="btn-delete">🗑️</button>
              </div>
            </div>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="content">
          <!-- Builds Section -->
          <section class="section">
            <div class="section-header">
              <h2>📊 Selected Build</h2>
              <button (click)="toggleBuildSection()" class="btn-toggle-section" [class.collapsed]="!buildSectionExpanded()">
                {{ buildSectionExpanded() ? '▼' : '▶' }}
              </button>
            </div>
            <div class="section-content" [class.collapsed]="!buildSectionExpanded()">
              <div class="info-grid" *ngIf="buildService.selectedBuildA() as build">
              <div class="info-item">
                <label>Name:</label>
                <span>{{ build.name }}</span>
              </div>
              <div class="info-item">
                <label>Class:</label>
                <span>{{ build.classId }}</span>
              </div>
              <div class="info-item">
                <label>Level:</label>
                <span>{{ build.characterLevel }}</span>
              </div>
              <div class="info-item">
                <label>Primary Mastery:</label>
                <span>{{ build.stats.masteryPrimary }}</span>
              </div>
              <div class="info-item">
                <label>Secondary Mastery:</label>
                <span>{{ build.stats.masterySecondary }}</span>
              </div>
              <div class="info-item">
                <label>Back Mastery:</label>
                <span>{{ build.stats.backMastery }}</span>
              </div>
              <div class="info-item">
                <label>Damage Inflict:</label>
                <span>{{ build.stats.dommageInflict }}</span>
              </div>
              <div class="info-item">
                <label>Crit Rate:</label>
                <span>{{ build.stats.critRate }}%</span>
              </div>
              <div class="info-item">
                <label>Crit Mastery:</label>
                <span>{{ build.stats.critMastery }}</span>
              </div>
              <div class="info-item">
                <label>Resistance:</label>
                <span>{{ build.stats.resistance }}</span>
              </div>
              <div class="info-item">
                <label>AP:</label>
                <span>{{ build.stats.ap }}</span>
              </div>
              <div class="info-item">
                <label>MP:</label>
                <span>{{ build.stats.mp }}</span>
              </div>
              <div class="info-item">
                <label>WP:</label>
                <span>{{ build.stats.wp }}</span>
              </div>
              <div class="info-item">
                <label>Range:</label>
                <span>{{ build.stats.range }}</span>
              </div>
              <div class="info-item">
                <label>Spells:</label>
                <span>{{ countNonNull(build.spellBar.spells) }}/12</span>
              </div>
              <div class="info-item">
                <label>Passives:</label>
                <span>{{ countNonNull(build.passiveBar.passives) }}/6</span>
              </div>
              <div class="info-item">
                <label>Sublimations:</label>
                <span>{{ countNonNull(build.sublimationBar.sublimations) }}/12</span>
              </div>
              <div class="info-item">
                <label>Crit Rate:</label>
                <span>{{ build.stats.critRate }}%</span>
              </div>
            </div>
            <div class="no-data" *ngIf="!buildService.selectedBuildA()">
              No build selected
            </div>
            </div>
          </section>

          <!-- Timeline Section -->
          <!-- Now handled by BoardComponent above -->

          <!-- Board Component - Interactive Map -->
          <section class="section board-section">
            <app-board
              (editPlayer)="onEditPlayerFromBoard($event)"
              (editEnemy)="onEditEnemyFromBoard($event)"
            ></app-board>
          </section>
        </main>

        <!-- Right Panel: Actions -->
        <aside class="panel">
          <h2>⚙️ Actions</h2>
          <div class="actions">
            <button (click)="onValidateTimeline()" class="btn-primary">
              ✓ Validate Timeline
            </button>
            <button (click)="onAddStep()" class="btn-secondary">
              ➕ Add Step
            </button>
            <button (click)="onExportBuild()" class="btn-secondary">
              📤 Export Build
            </button>
            <button (click)="onAddPlayer()" class="btn-secondary">
              🦸 Add Player
            </button>
            <button (click)="onAddEnemy()" class="btn-secondary">
              👿 Add Enemy
            </button>
            <button (click)="onClearBoard()" class="btn-danger">
              🗑️ Clear Board
            </button>
          </div>

          <h2>📊 Stats</h2>
          <div class="stats">
            <div *ngIf="buildService.selectedBuildA() as build">
              <strong>Total Damage:</strong> {{ calculateTotalDamage(build) }}
            </div>
            <div>
              <strong>Timeline Valid:</strong>
              <span class="badge" [class.valid]="isTimelineValid()">
                {{ isTimelineValid() ? '✓ Yes' : '✗ No' }}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- Build Form Modal -->
    <app-build-form #buildForm></app-build-form>

    <!-- Timeline Form Modal -->
    <app-timeline-form #timelineForm></app-timeline-form>

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

    .dashboard {
      background: var(--bg);
      color: #e8ecf3;
      min-height: 100vh;
      font-family: Inter, Segoe UI, system-ui, -apple-system, Arial;
    }

    .header {
      background: var(--panel);
      border-bottom: 1px solid var(--stroke);
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header h1 {
      margin: 0;
      font-size: 24px;
    }

    button {
      background: var(--accent);
      color: #0b1220;
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
      background: #253044;
      color: #e8ecf3;
      border: 1px solid var(--stroke);
    }

    .btn-danger {
      background: var(--bad);
      color: white;
    }

    .container {
      display: grid;
      grid-template-columns: 300px 1fr 250px;
      gap: 12px;
      padding: 12px;
      min-height: calc(100vh - 72px);
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--stroke);
      border-radius: 8px;
      padding: 16px;
      overflow-y: auto;
      max-height: 90vh;
    }

    .panel h2 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .panel h3 {
      margin: 16px 0 8px 0;
      font-size: 12px;
      color: var(--muted);
    }

    .builds-list, .timelines-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .build-item {
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      border-radius: 6px;
      padding: 8px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .build-item:hover {
      border-color: var(--accent);
      background: #252f3d;
    }

    .build-item.active {
      border-color: var(--accent);
      background: #2c3a5a;
      box-shadow: 0 0 8px rgba(76, 201, 240, 0.3);
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
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
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

    .btn-add {
      width: 100%;
      background: #253044;
      border: 1px solid var(--stroke);
      color: #e8ecf3;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      margin-bottom: 8px;
      transition: all 0.2s;
    }

    .btn-add:hover {
      background: #4cc9f0;
      color: #0b1220;
      border-color: #4cc9f0;
    }

    .timeline-item {
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      border-radius: 6px;
      padding: 8px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .timeline-item.active {
      background: linear-gradient(135deg, rgba(76, 201, 240, 0.2), rgba(90, 215, 240, 0.15));
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(76, 201, 240, 0.3);
    }

    .timeline-item:hover {
      border-color: var(--accent);
      background: #252f3d;
    }

    .timeline-item.active:hover {
      box-shadow: 0 0 16px rgba(76, 201, 240, 0.5);
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
      color: var(--accent);
      font-size: 12px;
      animation: pulse-badge 1.5s ease-in-out infinite;
    }

    @keyframes pulse-badge {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .timeline-name, .timeline-meta {
      font-weight: 600;
      color: #e8ecf3;
      font-size: 13px;
    }

    .timeline-name {
      flex: 1;
    }

    .build-name {
      font-weight: 600;
      color: #e8ecf3;
      font-size: 13px;
    }

    hr {
      border: none;
      border-top: 1px solid var(--stroke);
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
      background: var(--panel);
      border: 1px solid var(--stroke);
      border-radius: 8px;
      padding: 16px;
    }

    .section h2 {
      margin: 0 0 12px 0;
      font-size: 16px;
      color: #e8ecf3;
    }

    .section h3 {
      margin: 12px 0 8px 0;
      font-size: 13px;
      color: var(--accent);
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
      border: 1px solid var(--stroke);
      color: var(--accent);
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
      background: rgba(76, 201, 240, 0.1);
      border-color: var(--accent);
    }

    .btn-toggle-section.collapsed {
      color: var(--muted);
      border-color: var(--stroke);
    }

    .btn-toggle-section.collapsed:hover {
      background: rgba(76, 201, 240, 0.05);
      color: var(--accent);
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
      background: var(--panel-2);
      padding: 12px;
      border-radius: 8px;
      gap: 8px;
      transition: all 0.3s ease;
      border: 1px solid rgba(76, 201, 240, 0.1);
    }

    .info-item:hover {
      border-color: rgba(76, 201, 240, 0.3);
      background: linear-gradient(135deg, rgba(76, 201, 240, 0.05), rgba(90, 215, 240, 0.02));
      box-shadow: 0 4px 12px rgba(76, 201, 240, 0.1);
    }

    .info-item label {
      display: inline-block;
      background: linear-gradient(135deg, var(--accent), #5ad5f0);
      color: #0b1220;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      box-shadow: 0 4px 12px rgba(76, 201, 240, 0.25);
      width: fit-content;
      transition: all 0.3s ease;
    }

    .info-item:hover label {
      box-shadow: 0 6px 16px rgba(76, 201, 240, 0.35);
      transform: translateY(-2px);
    }

    .build-meta, .timeline-meta {
      font-size: 11px;
      color: var(--muted);
      margin-top: 4px;
    }

    .info-item span {
      font-size: 15px;
      color: #e8ecf3;
      font-weight: 600;
      padding: 6px 8px;
      background: rgba(76, 201, 240, 0.08);
      border-radius: 6px;
      border-left: 3px solid var(--accent);
    }

    .no-data {
      color: var(--muted);
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

    .stats {
      background: var(--panel-2);
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
      background: var(--good);
      color: #0b1220;
    }

    @media (max-width: 1200px) {
      .container {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DashboardComponent {
  buildService = inject(BuildService);
  timelineService = inject(TimelineService);
  boardService = inject(BoardService);

  // Signal for build section collapse/expand state
  buildSectionExpanded = signal<boolean>(true);


  /**
   * Helper: Count non-null items in array
   */
  countNonNull(items: any[]): number {
    return items.filter(item => item !== null).length;
  }

  onSelectBuild(build: any): void {
    this.buildService.selectBuildA(build);
  }

  onSelectTimeline(timeline: any): void {
    this.timelineService.loadTimeline(timeline.id);
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

  onEnemyAdded(enemyData: { name: string; position: { x: number; y: number }; facing: { direction: string } }): void {
    const newEnemy = {
      id: `enemy_${Date.now()}`,
      type: 'enemy' as const,
      name: enemyData.name,
      position: enemyData.position,
      facing: { direction: enemyData.facing.direction as 'front' | 'side' | 'back' }
    };
    this.boardService.addEntity(newEnemy);
  }

  onEnemyEdited(data: { id: string; name: string; position: { x: number; y: number }; facing: { direction: string } }): void {
    this.boardService.updateEntity(data.id, {
      name: data.name,
      position: data.position,
      facing: { direction: data.facing.direction as 'front' | 'side' | 'back' }
    });
  }

  onAddPlayer(): void {
    this.playerForm.openNew();
  }

  onPlayerAdded(playerData: { name: string; classId: string; position: { x: number; y: number }; facing: { direction: string } }): void {
    const newPlayer = {
      id: `player_${Date.now()}`,
      type: 'player' as const,
      name: playerData.name,
      classId: playerData.classId,
      position: playerData.position,
      facing: { direction: playerData.facing.direction as 'front' | 'side' | 'back' }
    };
    this.boardService.addEntity(newPlayer);
  }

  onPlayerEdited(data: { id: string; name: string; classId: string; position: { x: number; y: number }; facing: { direction: string } }): void {
    this.boardService.updateEntity(data.id, {
      name: data.name,
      classId: data.classId,
      position: data.position,
      facing: { direction: data.facing.direction as 'front' | 'side' | 'back' }
    });
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

  onClearBoard(): void {
    this.boardService.clearBoard();
    this.timelineService.clearCurrentTimeline();
    alert('✓ Plateau et timeline complètement effacés !');
  }

  @ViewChild('buildForm') buildForm!: BuildFormComponent;
  @ViewChild('timelineForm') timelineForm!: TimelineFormComponent;
  @ViewChild('playerForm') playerForm!: PlayerFormComponent;
  @ViewChild('enemyForm') enemyForm!: EnemyFormComponent;

  onCreateBuild(): void {
    this.buildForm.openNew();
  }

  onEditBuild(event: any, build: any): void {
    event.stopPropagation();
    this.buildForm.openEdit(build);
  }

  onDeleteBuild(event: any, build: any): void {
    event.stopPropagation();
    if (confirm(`Supprimer le build "${build.name}"?`)) {
      this.buildService.deleteBuild(build.id);
      alert('Build supprimé!');
    }
  }

  // Timeline Methods
  onCreateTimeline(): void {
    this.timelineForm.openNew();
  }

  onEditTimeline(event: any, timeline: any): void {
    event.stopPropagation();
    this.timelineForm.openEdit(timeline);
  }

  onDeleteTimeline(event: any, timeline: any): void {
    event.stopPropagation();
    if (confirm(`Supprimer la timeline "${timeline.name}"?`)) {
      this.timelineService.deleteTimeline(timeline.id);
      alert('Timeline supprimée!');
    }
  }

  calculateTotalDamage(build: any): number {
    return build.stats.dommageInflict * (1 + build.stats.critRate / 100);
  }

  isTimelineValid(): boolean {
    const result = this.timelineService.validateTimeline();
    return result.valid;
  }

  toggleBuildSection(): void {
    this.buildSectionExpanded.update(expanded => !expanded);
  }
}

