/**
 * Damage Summary Component
 * Affiche le résumé des dégâts par étape de la timeline dans le panneau gauche
 */

import { Component, inject, computed, signal, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationService } from '../services/simulation.service';
import { TimelineService } from '../services/timeline.service';
import { BuildService } from '../services/build.service';
import { DataCacheService } from '../services/data-cache.service';
import { Spell } from '../models/spell.model';

@Component({
  selector: 'app-damage-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="damage-summary">
      <div class="summary-title">
        <span>Résumé des Dégâts</span>
      </div>

      <!-- Total damage banner -->
      <div class="total-damage-banner">
        <div class="total-row">
          <span class="total-label">Dégâts totaux</span>
          <span class="total-value damage">{{ totalDamage() | number:'1.0-0' }}</span>
        </div>
        <div class="total-row" *ngIf="totalHeal() > 0">
          <span class="total-label">Soins totaux</span>
          <span class="total-value heal">{{ totalHeal() | number:'1.0-0' }}</span>
        </div>
        <div class="total-row" *ngIf="totalShield() > 0">
          <span class="total-label">Armure totale</span>
          <span class="total-value shield">{{ totalShield() | number:'1.0-0' }}</span>
        </div>
      </div>

      <!-- Step indicator -->
      <div class="step-progress" *ngIf="currentTimeline()">
        <span class="progress-label">Progression</span>
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="progressPercent()"></div>
        </div>
        <span class="progress-text">{{ currentStepIndex() }} / {{ totalSteps() }}</span>
      </div>

      <!-- Steps list with damage per action -->
      <div class="steps-list" #stepsList *ngIf="stepsSummary().length > 0">
        <div *ngFor="let step of stepsSummary(); let i = index"
             class="step-card"
             [class.current]="i === currentStepIndex() - 1">
          <div class="step-header">
            <span class="step-number">{{ i + 1 }}</span>
            <span class="step-total-damage" *ngIf="step.totalDamage > 0">
              {{ step.totalDamage | number:'1.0-0' }}
            </span>
          </div>
          <div class="step-actions">
            <div *ngFor="let action of step.actions" class="action-row" [class.mechanism-row]="action.isMechanism">
              <div class="action-info">
                <!-- Sort classique -->
                <ng-container *ngIf="action.actionType === 'CastSpell'">
                  <img *ngIf="action.iconId"
                       [src]="'assets/images/spells/' + action.iconId + '.png'"
                       [alt]="action.spellName"
                       class="action-icon spell-icon"
                       (error)="onImgError($event)" />
                  <span *ngIf="!action.iconId" class="action-icon-fallback">✨</span>
                </ng-container>
                <!-- Déplacement -->
                <ng-container *ngIf="action.actionType === 'Move'">
                  <img src="assets/images/characteristics/MP.png"
                       alt="PM"
                       class="action-icon mp-icon" />
                </ng-container>
                <!-- Explosion Rouage / Sinistro / autre mécanisme -->
                <ng-container *ngIf="action.actionType === 'TriggerExplosion'">
                  <img *ngIf="action.iconId"
                       [src]="'assets/images/spells/' + action.iconId + '.png'"
                       [alt]="action.spellName"
                       class="action-icon spell-icon mechanism-spell-icon"
                       (error)="onImgError($event)" />
                  <span *ngIf="!action.iconId" class="action-icon-fallback"></span>
                </ng-container>
                <!-- Autre type d'action -->
                <ng-container *ngIf="action.actionType !== 'CastSpell' && action.actionType !== 'Move' && action.actionType !== 'TriggerExplosion'">
                  <span class="action-icon-fallback">🔄</span>
                </ng-container>
                <span class="action-spell-name" [class]="action.actionType">
                  {{ action.spellName || action.actionType }}
                </span>
              </div>
              <div class="action-values">
                <span *ngIf="action.damage > 0" class="val damage">{{ action.damage | number:'1.0-0' }}</span>
                <span *ngIf="action.heal > 0" class="val heal">+{{ action.heal | number:'1.0-0' }}</span>
                <span *ngIf="action.shield > 0" class="val shield">🛡{{ action.shield | number:'1.0-0' }}</span>
                <span *ngIf="action.paRegenerated > 0" class="val pa-regen">
                  +{{ action.paRegenerated }}<img src="assets/images/characteristics/AP.png" alt="PA" class="val-icon" />
                </span>
                <span *ngIf="action.damage === 0 && action.heal === 0 && action.shield === 0 && action.paRegenerated === 0" class="val muted">—</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div class="empty-state" *ngIf="stepsSummary().length === 0">
        <span>Lancez la simulation pour voir les dégâts</span>
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

    .damage-summary {
      display: flex;
      flex-direction: column;
      gap: 12px;
      color: #e8ecf3;
    }

    .summary-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .title-icon {
      font-size: 18px;
    }

    /* ── Total banner ── */
    .total-damage-banner {
      background: linear-gradient(135deg, rgba(239, 71, 111, 0.15), rgba(255, 107, 107, 0.08));
      border: 1px solid rgba(239, 71, 111, 0.35);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .total-label {
      font-size: 12px;
      color: var(--muted);
      font-weight: 600;
    }

    .total-value {
      font-size: 20px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    .total-value.damage {
      color: #ff6b6b;
      text-shadow: 0 0 12px rgba(255, 107, 107, 0.4);
    }

    .total-value.heal {
      color: var(--good);
      font-size: 16px;
    }

    .total-value.shield {
      color: #a78bfa;
      font-size: 16px;
    }

    /* ── Progress bar ── */
    .step-progress {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .progress-label {
      font-size: 10px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .progress-bar {
      flex: 1;
      height: 4px;
      background: var(--panel-2);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), #5ad7f0);
      border-radius: 2px;
      transition: width 0.4s ease;
    }

    .progress-text {
      font-size: 11px;
      color: var(--accent);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* ── Steps list ── */
    .steps-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: calc(100vh - 380px);
      overflow-y: auto;
      padding-right: 2px;
    }

    .steps-list::-webkit-scrollbar {
      width: 4px;
    }

    .steps-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .steps-list::-webkit-scrollbar-thumb {
      background: var(--stroke);
      border-radius: 2px;
    }

    .step-card {
      background: var(--panel-2);
      border: 1px solid var(--stroke);
      border-radius: 8px;
      padding: 8px;
      transition: all 0.2s;
    }

    .step-card.current {
      border-color: var(--accent);
      background: rgba(76, 201, 240, 0.08);
      box-shadow: 0 0 8px rgba(76, 201, 240, 0.15);
    }

    .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .step-number {
      background: var(--accent);
      color: #0b1220;
      padding: 1px 7px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 800;
    }

    .step-total-damage {
      font-size: 12px;
      font-weight: 700;
      color: #ff6b6b;
      font-variant-numeric: tabular-nums;
    }

    .step-actions {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .action-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 6px;
      background: var(--panel);
      border-radius: 4px;
      font-size: 11px;
    }

    .action-info {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .action-icon {
      width: 22px;
      height: 22px;
      border-radius: 4px;
      object-fit: contain;
      flex-shrink: 0;
    }

    .action-icon.spell-icon {
      border: 1px solid var(--stroke);
      background: var(--panel-2);
    }

    .action-icon.mp-icon {
      width: 18px;
      height: 18px;
    }

    .action-icon.mechanism-icon {
      border: 1px solid rgba(255, 209, 102, 0.4);
      background: rgba(255, 209, 102, 0.1);
    }

    .action-icon-fallback {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }

    .action-spell-name {
      font-weight: 600;
      color: #e8ecf3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }

    .action-spell-name.CastSpell {
      color: #7aa2f7;
    }

    .action-spell-name.Move {
      color: var(--good);
    }

    .action-spell-name.TriggerExplosion {
      color: #ffd166;
    }

    .action-row.mechanism-row {
      background: rgba(255, 209, 102, 0.06);
      border-left: 2px solid rgba(255, 209, 102, 0.5);
    }

    .action-values {
      display: flex;
      gap: 6px;
      margin-left: 8px;
      flex-shrink: 0;
    }

    .val {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      font-size: 11px;
    }

    .val.damage {
      color: #ff6b6b;
    }

    .val.heal {
      color: var(--good);
    }

    .val.shield {
      color: #a78bfa;
    }

    .val.pa-regen {
      color: #e8ecf3;
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .val-icon {
      width: 12px;
      height: 12px;
      object-fit: contain;
      vertical-align: middle;
    }

    .val.muted {
      color: var(--muted);
      font-weight: 400;
    }

    /* ── Empty state ── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 16px;
      color: var(--muted);
      font-style: italic;
      font-size: 12px;
      text-align: center;
    }

    .empty-icon {
      font-size: 32px;
      opacity: 0.5;
    }
  `]
})
export class DamageSummaryComponent {
  private readonly simulationService = inject(SimulationService);
  private readonly timelineService = inject(TimelineService);
  private readonly buildService = inject(BuildService);
  private readonly dataCacheService = inject(DataCacheService);

  @ViewChild('stepsList') stepsListRef?: ElementRef<HTMLElement>;

  /** Cache local des sorts pour récupérer les iconId */
  private spellsCache = signal<Map<string, Spell>>(new Map());

  currentTimeline = computed(() => this.timelineService.currentTimeline());
  currentStepIndex = computed(() => this.timelineService.currentStepIndex());
  totalSteps = computed(() => {
    const tl = this.currentTimeline();
    return tl ? tl.steps.length : 0;
  });

  progressPercent = computed(() => {
    const total = this.totalSteps();
    if (total === 0) return 0;
    return (this.currentStepIndex() / total) * 100;
  });

  constructor() {
    // Charger les sorts quand le build change pour avoir les iconId
    effect(() => {
      const build = this.buildService.selectedBuildA();
      if (build?.classId) {
        this.loadSpells(build.classId);
      }
    });

    // Auto-scroll vers le bas quand de nouvelles étapes arrivent
    effect(() => {
      // Déclencher la réactivité sur les steps
      const steps = this.simulationService.cachedSteps();
      if (steps.length > 0) {
        // setTimeout pour attendre que le DOM se mette à jour
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });
  }

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

  private getSpellIconId(spellId: string): number | undefined {
    return this.spellsCache().get(spellId)?.iconId;
  }

  private scrollToBottom(): void {
    const el = this.stepsListRef?.nativeElement;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  /** Résumé des dégâts par étape, construit à partir du cache réactif */
  stepsSummary = computed(() => {
    const steps = this.simulationService.cachedSteps();
    // Déclencher la réactivité sur le cache de sorts
    const spellsCache = this.spellsCache();
    return steps.map(step => {
      const actions = step.actions.map(a => ({
        actionType: a.actionType,
        spellName: a.spellName || '',
        spellId: a.spellId || '',
        iconId: a.spellId ? this.getSpellIconId(a.spellId) : undefined,
        mechanismType: a.details?.mechanismType || null,
        isMechanism: a.actionType === 'TriggerExplosion',
        damage: a.damage || 0,
        heal: a.heal || 0,
        shield: a.shield || 0,
        paCost: a.paCost || 0,
        paRegenerated: a.details?.paRegenerated || 0,
        success: a.success
      }));
      const totalDamage = actions.reduce((sum, a) => sum + a.damage, 0);
      return { actions, totalDamage };
    });
  });

  totalDamage = computed(() => {
    return this.stepsSummary().reduce((sum, step) => sum + step.totalDamage, 0);
  });

  totalHeal = computed(() => {
    const steps = this.simulationService.cachedSteps();
    return steps.reduce((sum, step) =>
      sum + step.actions.reduce((s, a) => s + (a.heal || 0), 0), 0
    );
  });

  totalShield = computed(() => {
    const steps = this.simulationService.cachedSteps();
    return steps.reduce((sum, step) =>
      sum + step.actions.reduce((s, a) => s + (a.shield || 0), 0), 0
    );
  });
}



