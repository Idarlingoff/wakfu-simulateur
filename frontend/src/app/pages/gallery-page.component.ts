import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Timeline } from '../models/timeline.model';
import { SharedTimeline } from '../models/shared-timeline.model';
import { TimelineService } from '../services/timeline.service';
import { PublicTimelineRepository } from '../services/storage/public-timeline.repository';
import { TimelineSharingService, Visibility } from '../services/timeline-sharing.service';
import { AuthService } from '../services/auth.service';

type Tab = 'mine' | 'public';

@Component({
  selector: 'app-gallery-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="gallery">
      <h1>Galerie</h1>

      <nav class="tabs">
        <button type="button" [class.active]="tab() === 'mine'" (click)="selectTab('mine')">Mes timelines</button>
        <button type="button" [class.active]="tab() === 'public'" (click)="selectTab('public')">Publiques</button>
      </nav>

      <label class="filter">
        Classe
        <select [ngModel]="classFilter()" (ngModelChange)="onClassFilterChange($event)">
          <option value="">Toutes</option>
          <option value="XEL">Xélor</option>
        </select>
      </label>

      @if (tab() === 'mine') {
        <ul class="list">
          @for (t of visibleMine(); track t.id) {
            <li>
              <span class="name">{{ t.name }}</span>
              <select [ngModel]="t.visibility ?? 'private'" (ngModelChange)="changeVisibility(t, $event)">
                <option value="private">Privé</option>
                <option value="unlisted">Lien</option>
                <option value="public">Public</option>
              </select>
              @if (t.visibility && t.visibility !== 'private') {
                <button type="button" (click)="copyLink(t)">Copier le lien</button>
              }
            </li>
          }
        </ul>
      } @else {
        @if (loadingPublic()) {
          <p class="info">Chargement…</p>
        } @else if (publicTimelines().length === 0) {
          <p class="info">Aucune timeline publique{{ classFilter() ? ' pour cette classe' : '' }}.</p>
        } @else {
          <ul class="list">
            @for (t of publicTimelines(); track t.id) {
              <li>
                <span class="name">{{ t.name }}</span>
                <span class="author">par {{ t.authorUsername }}</span>
                <a [href]="'#'" (click)="$event.preventDefault(); open(t)">Ouvrir</a>
                @if (canDuplicate()) {
                  <button type="button" (click)="duplicate(t)">Dupliquer</button>
                }
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: [`
    .gallery { max-width: 720px; margin: 32px auto; padding: 0 16px; }
    h1 { font-size: 20px; margin-bottom: 16px; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .tabs button { padding: 6px 12px; border: 1px solid var(--app-border); border-radius: 6px;
      background: var(--app-surface); color: inherit; cursor: pointer; }
    .tabs button.active { background: var(--app-accent); border-color: transparent; color: #fff; }
    .filter { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 12px; }
    .list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .list li { display: flex; align-items: center; gap: 12px; padding: 8px 12px;
      background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 6px; }
    .name { font-weight: 500; }
    .author { font-size: 12px; opacity: 0.7; }
    .list a, .list button { margin-left: auto; }
    .list button { padding: 4px 10px; border: 1px solid var(--app-border); border-radius: 6px;
      background: transparent; color: inherit; cursor: pointer; }
    select { padding: 4px 8px; background: var(--app-surface); border: 1px solid var(--app-border);
      border-radius: 6px; color: inherit; }
    .info { font-size: 14px; opacity: 0.8; }
  `],
})
export class GalleryPageComponent {
  private readonly timelineService = inject(TimelineService);
  private readonly publicRepo = inject(PublicTimelineRepository);
  private readonly sharing = inject(TimelineSharingService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly tab = signal<Tab>('mine');
  readonly classFilter = signal<string>('');
  readonly publicTimelines = signal<SharedTimeline[]>([]);
  readonly loadingPublic = signal(false);

  readonly visibleMine = computed(() => {
    const cls = this.classFilter();
    const all = this.timelineService.allTimelines();
    return cls ? all.filter(t => t.classId === cls) : all;
  });

  canDuplicate(): boolean {
    return this.auth.isAuthenticated();
  }

  async selectTab(tab: Tab): Promise<void> {
    this.tab.set(tab);
    if (tab === 'public') {
      await this.reloadPublic();
    }
  }

  setClassFilter(cls: string): void {
    this.classFilter.set(cls);
  }

  async onClassFilterChange(cls: string): Promise<void> {
    this.classFilter.set(cls);
    if (this.tab() === 'public') {
      await this.reloadPublic();
    }
  }

  async reloadPublic(): Promise<void> {
    this.loadingPublic.set(true);
    const cls = this.classFilter() || undefined;
    this.publicTimelines.set(await firstValueFrom(this.publicRepo.getPublic(cls)));
    this.loadingPublic.set(false);
  }

  async changeVisibility(timeline: Timeline, visibility: Visibility): Promise<void> {
    const ok = await this.sharing.setVisibility(timeline, visibility);
    // Recharge la source de verite : sans ca, le <select> reviendrait a l'ancienne
    // valeur (l'objet du signal n'a pas mute) et /timelines resterait perime.
    if (ok) {
      await this.timelineService.loadTimelines();
    }
  }

  copyLink(timeline: Timeline): void {
    const link = this.sharing.shareLink(timeline);
    navigator.clipboard?.writeText(link).catch(() => undefined);
  }

  open(timeline: SharedTimeline): void {
    this.router.navigate(['/t', timeline.shareToken]).catch(() => undefined);
  }

  async duplicate(timeline: SharedTimeline): Promise<void> {
    const copy = await this.sharing.duplicate(timeline);
    // La copie est insuree en base directement par le service : on recharge pour qu'elle
    // apparaisse dans "Mes timelines" et dans le dashboard sans rafraichir la page.
    if (copy) {
      await this.timelineService.loadTimelines();
    }
  }
}
