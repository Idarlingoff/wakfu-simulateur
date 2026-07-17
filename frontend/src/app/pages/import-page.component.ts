import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Build } from '../models/build.model';
import { Timeline } from '../models/timeline.model';
import { LocalDataImportService } from '../services/storage/local-data-import.service';

@Component({
  selector: 'app-import-page',
  standalone: true,
  template: `
    <section class="import-page">
      <h1>Importer tes données locales</h1>
      <p class="info">
        Ces builds et timelines sont stockés dans ce navigateur. Coche ce que tu veux
        copier dans ton compte. <strong>Rien ne sera supprimé localement.</strong>
      </p>

      @if (builds().length || timelines().length) {
        <h2>Builds</h2>
        <ul>
          @for (b of builds(); track b.id) {
            <li>
              <label>
                <input type="checkbox" [checked]="selectedBuildIds().has(b.id)" (change)="toggleBuild(b.id)" />
                {{ b.name }}
              </label>
            </li>
          }
        </ul>

        <h2>Timelines</h2>
        <ul>
          @for (t of timelines(); track t.id) {
            <li>
              <label>
                <input type="checkbox" [checked]="selectedTimelineIds().has(t.id)" (change)="toggleTimeline(t.id)" />
                {{ t.name }}
              </label>
            </li>
          }
        </ul>
        <p class="hint">Une timeline cochée importe automatiquement le build dont elle dépend.</p>

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

        <div class="actions">
          <button type="button" (click)="skip()">Plus tard</button>
          <button type="button" (click)="submit()" [disabled]="loading()">
            {{ loading() ? 'Import…' : 'Importer la sélection' }}
          </button>
        </div>
      } @else {
        <p class="info">Aucune donnée locale à importer.</p>
        <div class="actions"><button type="button" (click)="skip()">Continuer</button></div>
      }
    </section>
  `,
  styles: [`
    .import-page { max-width: 520px; margin: 48px auto; padding: 0 16px; }
    h1 { font-size: 20px; margin-bottom: 12px; }
    h2 { font-size: 14px; margin: 20px 0 8px; opacity: 0.8; }
    ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    label { display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .info { font-size: 14px; line-height: 1.5; }
    .hint { font-size: 12px; opacity: 0.7; margin-top: 8px; }
    .error { color: #e5484d; font-size: 13px; }
    .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px; }
    button {
      padding: 9px 12px; border: 1px solid var(--app-border); border-radius: 6px;
      background: var(--app-surface); color: inherit; cursor: pointer;
    }
    button:last-child { background: var(--app-accent); border-color: transparent; color: #fff; }
    button[disabled] { opacity: 0.6; cursor: default; }
  `],
})
export class ImportPageComponent {
  private readonly importService = inject(LocalDataImportService);
  private readonly router = inject(Router);

  readonly builds = signal<Build[]>([]);
  readonly timelines = signal<Timeline[]>([]);
  readonly selectedBuildIds = signal<Set<string>>(new Set());
  readonly selectedTimelineIds = signal<Set<string>>(new Set());
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const preview = await this.importService.preview();
    this.builds.set(preview.builds);
    this.timelines.set(preview.timelines);
    // Tout coche par defaut : le cas courant est de vouloir tout recuperer.
    this.selectedBuildIds.set(new Set(preview.builds.map(b => b.id)));
    this.selectedTimelineIds.set(new Set(preview.timelines.map(t => t.id)));
  }

  toggleBuild(id: string): void {
    this.selectedBuildIds.update(current => toggle(current, id));
  }

  toggleTimeline(id: string): void {
    this.selectedTimelineIds.update(current => toggle(current, id));
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.importService.importSelected({
        buildIds: [...this.selectedBuildIds()],
        timelineIds: [...this.selectedTimelineIds()],
      });
      this.loading.set(false);
      this.router.navigate(['/builds']).catch(() => undefined);
    } catch {
      this.loading.set(false);
      this.error.set('Import impossible : service indisponible. Tes donnees locales sont intactes.');
    }
  }

  skip(): void {
    this.router.navigate(['/accueil']).catch(() => undefined);
  }
}

function toggle(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
}
