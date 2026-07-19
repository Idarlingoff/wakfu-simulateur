import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BuildService } from '../services/build.service';
import { UiButtonComponent } from '../ui/ui-button.component';
import { IconComponent } from '../ui/icon.component';
import { Build } from '../models/build.model';
import { DEMO_BUILD_ID } from '../services/demo-data.service';

@Component({
  selector: 'app-builds-list',
  standalone: true,
  imports: [UiButtonComponent, IconComponent],
  template: `
    <section class="builds">
      <header class="builds-head">
        <h1>Builds</h1>
        <button ui-button variant="primary" (click)="createBuild()" data-tour="builds-nouveau">
          <ui-icon name="user"></ui-icon> Nouveau build
        </button>
      </header>

      @if (builds().length === 0) {
        <div class="empty">
          <p>Aucun build pour le moment.</p>
          <button ui-button variant="primary" (click)="createBuild()">Créer mon premier build</button>
        </div>
      } @else {
        <div class="grid">
          @for (build of builds(); track build.id) {
            <article class="card" [class.selected]="build.id === selectedId()">
              <div class="card-top">
                <span class="card-name">{{ build.name }}</span>
                <span class="badge">{{ build.classId }}</span>
              </div>
              <div class="card-meta">Niveau {{ build.characterLevel }}</div>
              <div class="card-stats">
                <span>{{ build.stats.ap }} PA</span>
                <span>{{ build.stats.mp }} PM</span>
                <span>{{ build.stats.wp }} PW</span>
              </div>
              <div class="card-actions">
                <button ui-button variant="ghost" (click)="selectBuild(build)" [attr.aria-label]="'Sélectionner ' + build.name">Sélectionner</button>
                @if (!isDemo(build)) {
                  <button ui-button variant="ghost" (click)="editBuild(build)" [attr.aria-label]="'Modifier ' + build.name">Modifier</button>
                  <button ui-button variant="danger" (click)="deleteBuild(build)" [attr.aria-label]="'Supprimer ' + build.name">Supprimer</button>
                }
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .builds { max-width: 1000px; margin: 0 auto; padding: 24px 20px; color: var(--app-text); }
    .builds-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .builds-head h1 { margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
    .card { display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 12px; background: var(--app-surface); border: 1px solid var(--app-border); }
    .card.selected { border-color: var(--app-accent); }
    .card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .card-name { font-weight: 600; }
    .badge { font-size: 11px; color: var(--app-info); background: color-mix(in srgb, var(--app-info) 15%, transparent); border-radius: 999px; padding: 2px 8px; }
    .card-meta { font-size: 12px; color: var(--app-text-muted); }
    .card-stats { display: flex; gap: 12px; font-size: 13px; color: var(--app-text-muted); }
    .card-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .empty { text-align: center; color: var(--app-text-muted); padding: 56px 16px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  `],
})
export class BuildsListComponent {
  private readonly buildService = inject(BuildService);
  private readonly router = inject(Router);

  protected readonly builds = this.buildService.allBuilds;
  protected readonly selectedId = computed(() => this.buildService.selectedBuildA()?.id ?? null);

  createBuild(): void {
    this.router.navigate(['/builds/nouveau']);
  }

  editBuild(build: Build): void {
    this.router.navigate(['/builds', build.id, 'edition']);
  }

  selectBuild(build: Build): void {
    this.buildService.selectBuildA(build);
    this.router.navigate(['/timelines']);
  }

  deleteBuild(build: Build): void {
    if (window.confirm(`Supprimer le build « ${build.name} » ?`)) {
      this.buildService.deleteBuild(build.id);
    }
  }

  /**
   * Le build de demo n'existe qu'en memoire : ouvrir l'editeur dessus donnerait un ecran
   * incoherent, et le supprimer n'aurait rien a supprimer. On retire les deux actions
   * plutot que de rattraper le probleme apres coup.
   */
  protected isDemo(build: Build): boolean {
    return build.id === DEMO_BUILD_ID;
  }
}
