/**
 * Timeline Summary Component
 * Affiche un résumé des actions et ressources de la timeline
 */

import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineService } from '../services/timeline.service';
import { BuildService } from '../services/build.service';
import { DataCacheService } from '../services/data-cache.service';
import { SimulationService } from '../services/simulation.service';
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
}

@Component({
  selector: 'app-timeline-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="timeline-summary" *ngIf="currentTimeline()">
      <div class="summary-header">
        <h3>Ressources</h3>
        <span class="current-step">Étape {{ currentStepIndex() }} / {{ totalSteps() }}</span>
      </div>

      <!-- Ressources -->
      <div class="resources-grid">
        <!-- PA -->
        <div class="resource-card ap">
          <div class="resource-header">
            <img src="assets/images/characteristics/AP.png" alt="PA" class="resource-icon-img" />
            <span class="resource-label">PA</span>
          </div>
          <div class="resource-stats">
            <div class="stat-item">
              <span class="stat-label">Utilisé</span>
              <span class="stat-value negative">-{{ resourceSummary().apUsed }}</span>
            </div>
            <div class="stat-item" *ngIf="resourceSummary().apRegenerated > 0">
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
            <img src="assets/images/characteristics/MP.png" alt="PM" class="resource-icon-img" />
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
            <img src="assets/images/characteristics/WP.png" alt="PW" class="resource-icon-img" />
            <span class="resource-label">PW</span>
          </div>
          <div class="resource-stats">
            <div class="stat-item">
              <span class="stat-label">Utilisé</span>
              <span class="stat-value negative">-{{ resourceSummary().wpUsed }}</span>
            </div>
            <div class="stat-item" *ngIf="resourceSummary().wpRegenerated > 0">
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

    <div class="no-timeline" *ngIf="!currentTimeline()">
      <span>Aucune timeline chargée</span>
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
      gap: 12px;
      color: #e8ecf3;
    }

    .summary-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--stroke);
    }

    .summary-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .current-step {
      font-size: 11px;
      color: var(--accent);
      font-weight: 600;
      background: rgba(76, 201, 240, 0.1);
      padding: 3px 10px;
      border-radius: 12px;
    }

    .resources-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .resource-card {
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      border-radius: 8px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .resource-card.ap { border-top: 2px solid #4cc9f0; }
    .resource-card.mp { border-top: 2px solid #7bd88f; }
    .resource-card.wp { border-top: 2px solid #a78bfa; }

    .resource-header {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .resource-icon-img {
      width: 18px;
      height: 18px;
      object-fit: contain;
    }

    .resource-label {
      font-size: 13px;
      font-weight: 700;
      color: #e8ecf3;
    }

    .resource-stats {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 6px;
      background: var(--panel);
      border-radius: 4px;
      font-size: 11px;
    }

    .stat-item.highlight {
      background: rgba(76, 201, 240, 0.1);
      border: 1px solid rgba(76, 201, 240, 0.3);
      font-weight: 700;
    }

    .stat-label { color: var(--muted); }

    .stat-value {
      color: #e8ecf3;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .stat-value.negative { color: var(--bad); }
    .stat-value.positive { color: var(--good); }

    .no-timeline {
      background: var(--panel);
      border: 1px solid var(--stroke);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      color: var(--muted);
      font-style: italic;
      font-size: 12px;
    }
  `]
})
export class TimelineSummaryComponent {
  timelineService = inject(TimelineService);
  buildService = inject(BuildService);
  dataCacheService = inject(DataCacheService);
  simulationService = inject(SimulationService);

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
      };
    }

    let apUsed = 0;
    let mpUsed = 0;
    let wpUsed = 0;
    let apRemaining = build.stats.ap;
    let mpRemaining = build.stats.mp;
    let wpRemaining = build.stats.wp;

    // Parcourir les étapes exécutées
    for (let i = 0; i < currentIndex && i < timeline.steps.length; i++) {
      const stepResult = this.simulationService.getStepResult(i);

      // ✅ Source de vérité prioritaire: résultats du moteur de simulation
      if (stepResult) {
        const successfulActions = stepResult.actions.filter((action: any) => action.success);

        apUsed += successfulActions.reduce((sum: number, action: any) => sum + (action.paCost || 0), 0);
        wpUsed += successfulActions.reduce((sum: number, action: any) => sum + (action.pwCost || 0), 0);
        mpUsed += successfulActions.reduce((sum: number, action: any) => sum + (action.mpCost || 0), 0);

        apRemaining = stepResult.contextAfter?.availablePa ?? apRemaining;
        wpRemaining = stepResult.contextAfter?.availablePw ?? wpRemaining;
        mpRemaining = stepResult.contextAfter?.availableMp ?? mpRemaining;
        continue;
      }

      // Fallback: approximation si le cache de simulation n'est pas disponible
      const step = timeline.steps[i];
      step.actions.forEach(action => {
        if (action.type === 'CastSpell') {
          // Récupérer les coûts du sort depuis le cache
          const costs = this.getSpellCosts(action.spellId || '');
          apUsed += costs.paCost;
          wpUsed += costs.pwCost;
        } else if (action.type === 'Move') {
          mpUsed += action.details?.['mpCost'] || 1;
        }
      });

      apRemaining = Math.max(0, build.stats.ap - apUsed);
      mpRemaining = Math.max(0, build.stats.mp - mpUsed);
      wpRemaining = Math.max(0, build.stats.wp - wpUsed);
    }

    const apRegenerated = Math.max(0, apUsed - (build.stats.ap - apRemaining));
    const wpRegenerated = Math.max(0, wpUsed - (build.stats.wp - wpRemaining));

    return {
      apUsed,
      mpUsed,
      wpUsed,
      apRegenerated,
      wpRegenerated,
      apRemaining: Math.max(0, apRemaining),
      mpRemaining: Math.max(0, mpRemaining),
      wpRemaining: Math.max(0, wpRemaining),
    };
  });
}

