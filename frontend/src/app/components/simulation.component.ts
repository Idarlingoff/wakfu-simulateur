/**
 * Simulation Component
 * Interface pour lancer et visualiser les simulations
 */

import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BuildService } from '../services/build.service';
import { TimelineService } from '../services/timeline.service';
import { SimulationService } from '../services/simulation.service';
import { WakfuApiService } from '../services/wakfu-api.service';
import { Build } from '../models/build.model';
import { Timeline } from '../models/timeline.model';

@Component({
  selector: 'app-simulation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="simulation-container">
      <h2>Simulation de Combat</h2>

      <!-- Build Selection -->
      <div class="section">
        <h3>1. Sélectionner un Build</h3>
        <select [(ngModel)]="selectedBuildId" (change)="onBuildChange()">
          <option value="">-- Choisir un build --</option>
          @for (build of builds(); track build.id) {
            <option [value]="build.id">{{ build.name }} ({{ build.classId }})</option>
          }
        </select>
      </div>

      <!-- Timeline Selection -->
      <div class="section">
        <h3>2. Sélectionner une Timeline</h3>
        <select [(ngModel)]="selectedTimelineId" [disabled]="!selectedBuildId">
          <option value="">-- Choisir une timeline --</option>
          @for (timeline of timelines(); track timeline.id) {
            <option [value]="timeline.id">{{ timeline.name }}</option>
          }
        </select>
      </div>

      <!-- Context Configuration -->
      <div class="section">
        <h3>3. Configurer le Contexte</h3>
        <div class="context-form">
          <label>
            PA disponibles:
            <input type="number" [(ngModel)]="contextPa" min="0" max="20" />
          </label>
          <label>
            PW disponibles:
            <input type="number" [(ngModel)]="contextPw" min="0" max="10" />
          </label>
          <label>
            PM disponibles:
            <input type="number" [(ngModel)]="contextMp" min="0" max="10" />
          </label>
        </div>
      </div>

      <!-- Run Simulation Button -->
      <div class="section">
        <button
          (click)="runSimulation()"
          [disabled]="!canRunSimulation() || simulationService.isRunning()"
          class="run-button">
          @if (simulationService.isRunning()) {
            <span>⏳ Simulation en cours...</span>
          } @else {
            <span>▶️ Lancer la Simulation</span>
          }
        </button>
      </div>

      <!-- Error Display -->
      @if (simulationService.error()) {
        <div class="error-message">
          ❌ Erreur: {{ simulationService.error() }}
        </div>
      }

      <!-- Results Display -->
      @if (simulationService.simulation(); as result) {
        <div class="results-container">
          <h3>📊 Résultats de la Simulation</h3>

          <!-- Statistics -->
          <div class="stats">
            <div class="stat-card">
              <div class="stat-label">Actions Total</div>
              <div class="stat-value">{{ stats()?.totalActions }}</div>
            </div>
            <div class="stat-card success">
              <div class="stat-label">Réussies</div>
              <div class="stat-value">{{ stats()?.successfulActions }}</div>
            </div>
            <div class="stat-card failed">
              <div class="stat-label">Échouées</div>
              <div class="stat-value">{{ stats()?.failedActions }}</div>
            </div>
          </div>

          <!-- Resources -->
          <div class="resources">
            <div class="resource-bar">
              <span>PA: {{ result.finalContext.availablePa }} / {{ result.initialContext.availablePa }}</span>
              <div class="bar">
                <div class="bar-fill" [style.width.%]="(result.finalContext.availablePa / result.initialContext.availablePa) * 100"></div>
              </div>
            </div>
            <div class="resource-bar">
              <span>PW: {{ result.finalContext.availablePw }} / {{ result.initialContext.availablePw }}</span>
              <div class="bar">
                <div class="bar-fill pw" [style.width.%]="(result.finalContext.availablePw / result.initialContext.availablePw) * 100"></div>
              </div>
            </div>
            <div class="resource-bar">
              <span>PM: {{ result.finalContext.availableMp }} / {{ result.initialContext.availableMp }}</span>
              <div class="bar">
                <div class="bar-fill mp" [style.width.%]="(result.finalContext.availableMp / result.initialContext.availableMp) * 100"></div>
              </div>
            </div>
          </div>

          <!-- Actions List -->
          <div class="actions-list">
            <h4>Détail des Actions</h4>
            @for (step of result.steps; track step.stepId) {
              <div class="step-group">
                <h5>Step {{ step.stepNumber }}</h5>
                @for (action of step.actions; track $index) {
                  <div class="action-item" [class.success]="action.success" [class.failed]="!action.success">
                    <div class="action-header">
                      <span class="action-status">{{ action.success ? '✅' : '❌' }}</span>
                      <span class="action-name">{{ action.spellName || action.actionType }}</span>
                      <span class="action-cost">
                        @if (action.paCost > 0) { <span class="cost pa">{{ action.paCost }} PA</span> }
                        @if (action.pwCost > 0) { <span class="cost pw">{{ action.pwCost }} PW</span> }
                        @if (action.mpCost > 0) { <span class="cost mp">{{ action.mpCost }} PM</span> }
                      </span>
                    </div>
                    <div class="action-message">{{ action.message }}</div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .simulation-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    h2 {
      color: #2c3e50;
      margin-bottom: 30px;
    }

    .section {
      margin-bottom: 25px;
      padding: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    h3 {
      color: #34495e;
      margin-bottom: 15px;
      font-size: 1.2em;
    }

    select, input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .context-form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .context-form label {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .run-button {
      width: 100%;
      padding: 15px;
      background: #3498db;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.3s;
    }

    .run-button:hover:not(:disabled) {
      background: #2980b9;
    }

    .run-button:disabled {
      background: #bdc3c7;
      cursor: not-allowed;
    }

    .error-message {
      padding: 15px;
      background: #e74c3c;
      color: white;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .results-container {
      margin-top: 30px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }

    .stat-card {
      padding: 15px;
      background: #ecf0f1;
      border-radius: 8px;
      text-align: center;
    }

    .stat-card.success {
      background: #d5f4e6;
    }

    .stat-card.failed {
      background: #fadbd8;
    }

    .stat-label {
      font-size: 12px;
      color: #7f8c8d;
      margin-bottom: 5px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #2c3e50;
    }

    .resources {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .resource-bar {
      margin-bottom: 15px;
    }

    .resource-bar span {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }

    .bar {
      height: 20px;
      background: #ecf0f1;
      border-radius: 10px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      background: #3498db;
      transition: width 0.3s;
    }

    .bar-fill.pw {
      background: #9b59b6;
    }

    .bar-fill.mp {
      background: #2ecc71;
    }

    .actions-list {
      background: white;
      padding: 20px;
      border-radius: 8px;
    }

    .step-group {
      margin-bottom: 20px;
    }

    .step-group h5 {
      color: #2c3e50;
      margin-bottom: 10px;
      padding: 8px 12px;
      background: #ecf0f1;
      border-radius: 4px;
      font-size: 14px;
      font-weight: bold;
    }

    .action-item {
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 8px;
      border-left: 4px solid transparent;
    }

    .action-item.success {
      background: #d5f4e6;
      border-left-color: #27ae60;
    }

    .action-item.failed {
      background: #fadbd8;
      border-left-color: #e74c3c;
    }

    .action-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 5px;
    }

    .action-name {
      font-weight: bold;
      flex: 1;
    }

    .action-cost {
      display: flex;
      gap: 8px;
    }

    .cost {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }

    .cost.pa {
      background: #3498db;
      color: white;
    }

    .cost.pw {
      background: #9b59b6;
      color: white;
    }

    .cost.mp {
      background: #2ecc71;
      color: white;
    }

    .action-message {
      font-size: 14px;
      color: #7f8c8d;
      margin-left: 30px;
    }
  `]
})
export class SimulationComponent implements OnInit {
  builds = signal<Build[]>([]);
  timelines = signal<Timeline[]>([]);

  selectedBuildId = '';
  selectedTimelineId = '';
  contextPa = 12;
  contextPw = 6;
  contextMp = 3;

  stats = computed(() => this.simulationService.getSimulationStats());

  constructor(
    private readonly buildService: BuildService,
    private readonly timelineService: TimelineService,
    public simulationService: SimulationService,
    private readonly api: WakfuApiService
  ) {}

  ngOnInit() {
    this.loadBuilds();
  }

  async loadBuilds() {
    // Load from local service first
    this.builds.set(this.buildService.allBuilds());

    // Try to sync with backend
    try {
      const backendBuilds = await firstValueFrom(this.api.getAllBuilds());
      if (backendBuilds) {
        this.builds.set(backendBuilds);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Could not load builds from backend, using local data:', errorMessage);
    }
  }

  async onBuildChange() {
    if (!this.selectedBuildId) {
      this.timelines.set([]);
      return;
    }

    // Load timelines for selected build from local service
    const allTimelines = this.timelineService.allTimelines();
    const filtered = allTimelines.filter(t => t.buildId === this.selectedBuildId);
    this.timelines.set(filtered);

    // Try to sync with backend
    try {
      const backendTimelines = await firstValueFrom(this.api.getAllTimelines(this.selectedBuildId));
      if (backendTimelines) {
        this.timelines.set(backendTimelines);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Could not load timelines from backend, using local data:', errorMessage);
    }

    // Set context from build
    const build = this.builds().find(b => b.id === this.selectedBuildId);
    if (build) {
      this.contextPa = build.stats.ap;
      this.contextPw = build.stats.wp;
      this.contextMp = build.stats.mp;
    }
  }

  canRunSimulation(): boolean {
    return !!(this.selectedBuildId && this.selectedTimelineId);
  }

  async runSimulation() {
    if (!this.canRunSimulation()) return;

    await this.simulationService.runSimulation(
      this.selectedBuildId,
      this.selectedTimelineId
    );
  }
}

