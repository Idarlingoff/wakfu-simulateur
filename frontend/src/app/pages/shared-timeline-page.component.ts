import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SharedTimeline } from '../models/shared-timeline.model';
import { TimelineAction } from '../models/timeline.model';
import { PublicTimelineRepository } from '../services/storage/public-timeline.repository';
import { TimelineService } from '../services/timeline.service';
import { WakfuApiService } from '../services/wakfu-api.service';

@Component({
  selector: 'app-shared-timeline-page',
  standalone: true,
  template: `
    <section class="shared">
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      } @else if (timeline(); as t) {
        <h1>{{ t.name }}</h1>
        <p class="author">Partagé par {{ t.authorUsername }}</p>

        <ol class="actions">
          @for (line of actionLines(); track $index) {
            <li>{{ line }}</li>
          }
        </ol>

        <div class="replay">
          <button type="button" (click)="openInEditor()" [disabled]="opening()">
            {{ opening() ? 'Ouverture…' : 'Ouvrir dans l’éditeur pour rejouer' }}
          </button>
          <p class="hint">
            La timeline est copiée dans tes timelines : tu la rejoues dans l’onglet
            Timelines avec le build de ton choix. Le partage ne contient que la séquence,
            pas le build de son auteur.
          </p>
        </div>
      } @else {
        <p class="info">Chargement…</p>
      }
    </section>
  `,
  styles: [`
    .shared { max-width: 640px; margin: 32px auto; padding: 0 16px; }
    h1 { font-size: 20px; }
    .author { font-size: 13px; opacity: 0.7; margin-bottom: 16px; }
    .actions { padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
    .actions li { line-height: 1.5; }
    .replay { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--app-border); }
    button { padding: 9px 12px; background: var(--app-accent); border: 0; border-radius: 6px;
      color: #fff; cursor: pointer; }
    button[disabled] { opacity: 0.6; cursor: default; }
    .hint { font-size: 13px; opacity: 0.7; margin-top: 12px; }
    .error { color: #e5484d; font-size: 14px; }
    .info { opacity: 0.8; }
  `],
})
export class SharedTimelinePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicRepo = inject(PublicTimelineRepository);
  private readonly timelineService = inject(TimelineService);
  private readonly api = inject(WakfuApiService);

  readonly timeline = signal<SharedTimeline | null>(null);
  readonly error = signal<string | null>(null);
  readonly opening = signal(false);
  private readonly spellNames = signal<Map<string, string>>(new Map());

  /** Chaque action, aplatie et rendue lisible (nom du sort, mouvement, cible). */
  readonly actionLines = computed(() => {
    const t = this.timeline();
    if (!t) {
      return [];
    }
    const names = this.spellNames();
    const lines: string[] = [];
    for (const step of t.steps) {
      for (const action of step.actions) {
        lines.push(this.describe(action, names));
      }
    }
    return lines;
  });

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    await this.load();
    await this.loadSpellNames();
  }

  async load(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    const found = await firstValueFrom(this.publicRepo.getByShareToken(token));
    if (!found) {
      this.error.set('Cette timeline n existe plus ou n est plus partagee.');
      this.timeline.set(null);
      return;
    }
    this.error.set(null);
    this.timeline.set(found);
  }

  async loadSpellNames(): Promise<void> {
    const spells = await firstValueFrom(this.api.getAllSpells());
    this.spellNames.set(new Map(spells.map(s => [s.id, s.name])));
  }

  private describe(action: TimelineAction, names: Map<string, string>): string {
    const p = action.targetPosition;
    const at = p ? ` → (${p.x}, ${p.y})` : '';
    switch (action.type) {
      case 'CastSpell': {
        const name = (action.spellId && names.get(action.spellId)) || action.spellId || 'Sort';
        return `Sort ${name}${at}`;
      }
      case 'Move': return `Déplacement${at}`;
      case 'Transpose': return `Transposition${at}`;
      case 'ChangeFacing': return 'Changement d’orientation';
      case 'TriggerMechanism': return `Déclenche un mécanisme${at}`;
      default: return `Action${at}`;
    }
  }

  /**
   * Copie la timeline dans les timelines du lecteur (local si invite, compte si connecte),
   * puis ouvre l'onglet Timelines dessus. Le choix du build et le rejeu s'y font.
   */
  async openInEditor(): Promise<void> {
    const t = this.timeline();
    if (!t) {
      return;
    }
    this.opening.set(true);
    const copy: Record<string, unknown> = {
      ...t,
      id: crypto.randomUUID(),
      name: `${t.name} (partagée)`,
      visibility: 'private',
      shareToken: undefined,
    };
    delete copy['authorUsername'];

    const created = await this.timelineService.createTimeline(copy as unknown as SharedTimeline);
    this.opening.set(false);
    if (created) {
      this.timelineService.loadTimeline(created.id);
      this.router.navigate(['/timelines']).catch(() => undefined);
    }
  }
}
