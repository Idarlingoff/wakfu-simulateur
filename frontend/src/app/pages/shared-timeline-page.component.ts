import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SharedTimeline } from '../models/shared-timeline.model';
import { PublicTimelineRepository } from '../services/storage/public-timeline.repository';
import { BuildService } from '../services/build.service';

@Component({
  selector: 'app-shared-timeline-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="shared">
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      } @else if (timeline(); as t) {
        <h1>{{ t.name }}</h1>
        <p class="author">Partagé par {{ t.authorUsername }}</p>

        <ol class="steps">
          @for (step of t.steps; track step.id) {
            <li>{{ step.description || 'Étape' }} — {{ step.actions.length }} action(s)</li>
          }
        </ol>

        <div class="replay">
          <label>
            Rejouer avec mon build
            <select [ngModel]="selectedBuildId() ?? ''" (ngModelChange)="selectBuild($event)">
              <option value="">Choisir un build…</option>
              @for (b of compatibleBuilds(); track b.id) {
                <option [value]="b.id">{{ b.name }}</option>
              }
            </select>
          </label>

          @if (showsDamage()) {
            <p class="ok">Dégâts calculés avec ton build sélectionné.</p>
          } @else {
            <p class="hint">
              Choisis un de tes builds pour voir les dégâts.
              Cette timeline ne contient que la séquence, pas le build de son auteur.
            </p>
          }
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
    .steps { padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
    .replay { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--app-border); }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
    select { padding: 6px 8px; background: var(--app-surface); border: 1px solid var(--app-border);
      border-radius: 6px; color: inherit; max-width: 280px; }
    .hint { font-size: 13px; opacity: 0.7; margin-top: 12px; }
    .ok { font-size: 13px; color: var(--app-accent); margin-top: 12px; }
    .error { color: #e5484d; font-size: 14px; }
    .info { opacity: 0.8; }
  `],
})
export class SharedTimelinePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly publicRepo = inject(PublicTimelineRepository);
  private readonly buildService = inject(BuildService);

  readonly timeline = signal<SharedTimeline | null>(null);
  readonly error = signal<string | null>(null);
  readonly selectedBuildId = signal<string | null>(null);

  // Le lecteur rejoue avec un de SES builds de la meme classe que la timeline.
  readonly compatibleBuilds = computed(() => {
    const cls = this.timeline()?.classId;
    const all = this.buildService.allBuilds();
    return cls ? all.filter(b => b.classId === cls) : all;
  });

  readonly showsDamage = computed(() => this.selectedBuildId() !== null);

  constructor() {
    void this.load();
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

  selectBuild(buildId: string): void {
    this.selectedBuildId.set(buildId || null);
  }
}
