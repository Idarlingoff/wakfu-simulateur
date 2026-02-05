/**
 * Timeline Summary Component
 * Affiche un résumé des actions et ressources de la timeline
 */

import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineService } from '../services/timeline.service';
import { BuildService } from '../services/build.service';
import { DataCacheService } from '../services/data-cache.service';
import { Spell } from '../models/spell.model';

interface ResourceSummary {
  apUsed: number;
  mpUsed: number;
  wpUsed: number;
  apRegenerated: number;
  wpRegenerated: number;
  apRemaining: number;
  mpRemaining: number;
  wpRemaining: number;
  gearExplosions: Array<{ level: number; count: number }>;
}

interface ActionSummary {
  type: string;
  description: string;
  resources: string;
}

@Component({
  selector: 'app-timeline-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="timeline-summary" *ngIf="currentTimeline()">
      <div class="summary-header">
        <h3>📊 Résumé de la Timeline</h3>
        <span class="current-step">Étape {{ currentStepIndex() }} / {{ totalSteps() }}</span>
      </div>

      <!-- Actions passées -->
      <div class="summary-section" *ngIf="pastActions().length > 0">
        <h4>⏮️ Actions Passées ({{ pastActions().length }})</h4>
        <div class="actions-list">
          <div *ngFor="let action of pastActions(); let i = index" class="action-item">
            <span class="action-number">{{ i + 1 }}</span>
            <div class="action-details">
              <span class="action-type" [class]="action.type">{{ action.type }}</span>
              <span class="action-description">{{ action.description }}</span>
              <span class="action-resources" *ngIf="action.resources">{{ action.resources }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="no-actions" *ngIf="pastActions().length === 0">
        <span>Aucune action exécutée</span>
      </div>

      <!-- Ressources -->
      <div class="summary-section resources-section">
        <h4>⚡ Ressources</h4>

        <div class="resources-grid">
          <!-- PA -->
          <div class="resource-card ap">
            <div class="resource-header">
              <span class="resource-icon">🔵</span>
              <span class="resource-label">PA</span>
            </div>
            <div class="resource-stats">
              <div class="stat-item">
                <span class="stat-label">Utilisé</span>
                <span class="stat-value negative">-{{ resourceSummary().apUsed }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Régénéré</span>
                <span class="stat-value positive">+{{ resourceSummary().apRegenerated }}</span>
              </div>
              <div class="stat-item highlight">
                <span class="stat-label">Restant</span>
                <span class="stat-value">{{ resourceSummary().apRemaining }}</span>
              </div>
            </div>
          </div>

          <!-- PM -->
          <div class="resource-card mp">
            <div class="resource-header">
              <span class="resource-icon">🟢</span>
              <span class="resource-label">PM</span>
            </div>
            <div class="resource-stats">
              <div class="stat-item">
                <span class="stat-label">Utilisé</span>
                <span class="stat-value negative">-{{ resourceSummary().mpUsed }}</span>
              </div>
              <div class="stat-item highlight">
                <span class="stat-label">Restant</span>
                <span class="stat-value">{{ resourceSummary().mpRemaining }}</span>
              </div>
            </div>
          </div>

          <!-- PW -->
          <div class="resource-card wp">
            <div class="resource-header">
              <span class="resource-icon">🟣</span>
              <span class="resource-label">PW</span>
            </div>
            <div class="resource-stats">
              <div class="stat-item">
                <span class="stat-label">Utilisé</span>
                <span class="stat-value negative">-{{ resourceSummary().wpUsed }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Régénéré</span>
                <span class="stat-value positive">+{{ resourceSummary().wpRegenerated }}</span>
              </div>
              <div class="stat-item highlight">
                <span class="stat-label">Restant</span>
                <span class="stat-value">{{ resourceSummary().wpRemaining }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Explosions de Rouage -->
      <div class="summary-section" *ngIf="resourceSummary().gearExplosions.length > 0">
        <h4>💥 Explosions de Rouage</h4>
        <div class="explosions-list">
          <div *ngFor="let explosion of resourceSummary().gearExplosions" class="explosion-item">
            <span class="explosion-level">Niveau {{ explosion.level }}</span>
            <span class="explosion-count">{{ explosion.count }}x</span>
            <div class="explosion-bar">
              <div class="explosion-fill" [style.width.%]="(explosion.level / 10) * 100"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="no-timeline" *ngIf="!currentTimeline()">
      <span>📋 Aucune timeline chargée</span>
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

    .timeline-summary {
      background: var(--panel);
      border: 1px solid var(--stroke);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      color: #e8ecf3;
    }

    .summary-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--stroke);
    }

    .summary-header h3 {
      margin: 0;
      font-size: 16px;
      color: #e8ecf3;
    }

    .current-step {
      font-size: 12px;
      color: var(--accent);
      font-weight: 600;
      background: rgba(76, 201, 240, 0.1);
      padding: 4px 12px;
      border-radius: 12px;
    }

    .summary-section {
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      border-radius: 8px;
      padding: 12px;
    }

    .summary-section h4 {
      margin: 0 0 12px 0;
      font-size: 13px;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .actions-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
    }

    .action-item {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 8px;
      background: var(--panel);
      border-radius: 6px;
      border-left: 3px solid var(--accent);
    }

    .action-number {
      background: var(--accent);
      color: #0b1220;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      min-width: 24px;
      text-align: center;
    }

    .action-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .action-type {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      width: fit-content;
      background: #2b344a;
      color: #cfe3ff;
    }

    .action-type.CastSpell {
      background: #2a3a5a;
      color: #7aa2f7;
    }

    .action-type.Move {
      background: #2a4a3a;
      color: #7bd88f;
    }

    .action-description {
      font-size: 12px;
      color: #e8ecf3;
    }

    .action-resources {
      font-size: 10px;
      color: var(--muted);
    }

    .no-actions {
      text-align: center;
      color: var(--muted);
      font-style: italic;
      padding: 16px;
    }

    .resources-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
    }

    .resource-card {
      background: var(--panel);
      border: 1px solid var(--stroke);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .resource-card.ap {
      border-left: 3px solid #4cc9f0;
    }

    .resource-card.mp {
      border-left: 3px solid #7bd88f;
    }

    .resource-card.wp {
      border-left: 3px solid #a78bfa;
    }

    .resource-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .resource-icon {
      font-size: 20px;
    }

    .resource-label {
      font-size: 14px;
      font-weight: 700;
      color: #e8ecf3;
    }

    .resource-stats {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 8px;
      background: var(--panel-2);
      border-radius: 4px;
      font-size: 11px;
    }

    .stat-item.highlight {
      background: rgba(76, 201, 240, 0.1);
      border: 1px solid rgba(76, 201, 240, 0.3);
      font-weight: 700;
    }

    .stat-label {
      color: var(--muted);
    }

    .stat-value {
      color: #e8ecf3;
      font-weight: 600;
    }

    .stat-value.negative {
      color: var(--bad);
    }

    .stat-value.positive {
      color: var(--good);
    }

    .explosions-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .explosion-item {
      display: grid;
      grid-template-columns: auto auto 1fr;
      gap: 8px;
      align-items: center;
      padding: 8px;
      background: var(--panel);
      border-radius: 6px;
    }

    .explosion-level {
      font-size: 11px;
      font-weight: 600;
      color: var(--accent);
      min-width: 80px;
    }

    .explosion-count {
      font-size: 12px;
      font-weight: 700;
      color: #ff6b6b;
      background: rgba(255, 107, 107, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
    }

    .explosion-bar {
      height: 6px;
      background: var(--panel-2);
      border-radius: 3px;
      overflow: hidden;
    }

    .explosion-fill {
      height: 100%;
      background: linear-gradient(90deg, #ffd166, #ff6b6b);
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .no-timeline {
      background: var(--panel);
      border: 1px solid var(--stroke);
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      color: var(--muted);
      font-style: italic;
    }
  `]
})
export class TimelineSummaryComponent {
  timelineService = inject(TimelineService);
  buildService = inject(BuildService);
  dataCacheService = inject(DataCacheService);

  // Cache local des sorts pour récupérer les coûts
  private spellsCache = signal<Map<string, Spell>>(new Map());

  currentTimeline = computed(() => this.timelineService.currentTimeline());
  currentStepIndex = computed(() => this.timelineService.currentStepIndex());

  constructor() {
    // Charger les sorts quand la timeline ou le build change
    effect(() => {
      const timeline = this.currentTimeline();
      const build = this.buildService.selectedBuildA();
      if (timeline && build?.classId) {
        this.loadSpells(build.classId);
      }
    });
  }

  /**
   * Charge les sorts de la classe pour avoir accès aux coûts PA/PW
   */
  private async loadSpells(classId: string): Promise<void> {
    try {
      const spells = await this.dataCacheService.getSpells(classId);
      const cache = new Map<string, Spell>();
      spells.forEach(spell => cache.set(spell.id, spell));
      this.spellsCache.set(cache);
    } catch (error) {
      console.error('Erreur lors du chargement des sorts:', error);
    }
  }

  /**
   * Récupère les coûts d'un sort depuis le cache
   */
  private getSpellCosts(spellId: string): { paCost: number; pwCost: number } {
    const spell = this.spellsCache().get(spellId);
    return {
      paCost: spell?.paCost ?? 0,
      pwCost: spell?.pwCost ?? 0
    };
  }

  /**
   * Récupère le nom d'un sort depuis le cache
   */
  private getSpellName(spellId: string): string {
    const spell = this.spellsCache().get(spellId);
    return spell?.name ?? spellId;
  }

  totalSteps = computed(() => {
    const timeline = this.currentTimeline();
    return timeline ? timeline.steps.length : 0;
  });

  /**
   * Récupère les actions passées (jusqu'à l'étape courante)
   */
  pastActions = computed((): ActionSummary[] => {
    const timeline = this.currentTimeline();
    const currentIndex = this.currentStepIndex();
    // Déclencher la réactivité quand le cache de sorts change
    const spellsCache = this.spellsCache();

    if (!timeline || currentIndex === 0) return [];

    const actions: ActionSummary[] = [];

    // Récupérer toutes les étapes jusqu'à l'étape courante (exclue)
    for (let i = 0; i < currentIndex && i < timeline.steps.length; i++) {
      const step = timeline.steps[i];
      step.actions.forEach(action => {
        let description = '';
        let resources = '';

        switch (action.type) {
          case 'CastSpell': {
            const spellId = action.spellId || '';
            const spellName = this.getSpellName(spellId);
            const costs = this.getSpellCosts(spellId);
            description = `Sort: ${spellName}`;
            resources = `PA: ${costs.paCost}, PW: ${costs.pwCost}`;
            break;
          }
          case 'Move':
            description = `Déplacement vers (${action.targetPosition?.x}, ${action.targetPosition?.y})`;
            resources = `PM: ${action.details?.['mpCost'] || 1}`;
            break;
          case 'Transpose':
            description = 'Transposition';
            break;
          case 'ChangeFacing':
            description = `Direction: ${action.targetFacing?.direction}`;
            break;
          default:
            description = action.type;
        }

        actions.push({
          type: action.type,
          description,
          resources
        });
      });
    }

    return actions;
  });

  /**
   * Calcule le résumé des ressources utilisées et restantes
   */
  resourceSummary = computed((): ResourceSummary => {
    const timeline = this.currentTimeline();
    const currentIndex = this.currentStepIndex();
    const build = this.buildService.selectedBuildA();
    // Déclencher la réactivité quand le cache de sorts change
    const spellsCache = this.spellsCache();

    if (!timeline || !build) {
      return {
        apUsed: 0,
        mpUsed: 0,
        wpUsed: 0,
        apRegenerated: 0,
        wpRegenerated: 0,
        apRemaining: build?.stats.ap || 12,
        mpRemaining: build?.stats.mp || 3,
        wpRemaining: build?.stats.wp || 6,
        gearExplosions: []
      };
    }

    let apUsed = 0;
    let mpUsed = 0;
    let wpUsed = 0;
    let apRegenerated = 0;
    let wpRegenerated = 0;
    const gearExplosionsMap = new Map<number, number>();

    // Parcourir les étapes exécutées
    for (let i = 0; i < currentIndex && i < timeline.steps.length; i++) {
      const step = timeline.steps[i];
      step.actions.forEach(action => {
        if (action.type === 'CastSpell') {
          // Récupérer les coûts du sort depuis le cache
          const costs = this.getSpellCosts(action.spellId || '');
          apUsed += costs.paCost;
          wpUsed += costs.pwCost;

          // Détection des explosions de rouage
          if (action.details?.['gearExplosion']) {
            const level = action.details['gearLevel'] || 1;
            gearExplosionsMap.set(level, (gearExplosionsMap.get(level) || 0) + 1);
            // Les explosions de rouage régénèrent 1 PW par niveau
            wpRegenerated += level;
          }
        } else if (action.type === 'Move') {
          mpUsed += action.details?.['mpCost'] || 1;
        }
      });

      // Régénération en début de tour (tous les X étapes)
      // Pour simplifier, on régénère 1 AP tous les 2 tours
      if ((i + 1) % 2 === 0) {
        apRegenerated += 1;
      }
    }

    const gearExplosions = Array.from(gearExplosionsMap.entries())
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => a.level - b.level);

    return {
      apUsed,
      mpUsed,
      wpUsed,
      apRegenerated,
      wpRegenerated,
      apRemaining: Math.max(0, build.stats.ap - apUsed + apRegenerated),
      mpRemaining: Math.max(0, build.stats.mp - mpUsed),
      wpRemaining: Math.max(0, build.stats.wp - wpUsed + wpRegenerated),
      gearExplosions
    };
  });
}

