import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../ui/icon.component';
import { TourService } from '../services/tour.service';

interface HomeLink {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
  readonly desc: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <section class="home">
      <h1>Wakfu Simulator</h1>
      <p class="lead">Crée tes builds, monte tes timelines, teste en freeplay et compare tes résultats.</p>
      <div class="cards" data-tour="accueil-cartes">
        @for (link of links; track link.path) {
          <a class="card" [routerLink]="link.path">
            <ui-icon [name]="link.icon"></ui-icon>
            <span class="card-label">{{ link.label }}</span>
            <span class="card-desc">{{ link.desc }}</span>
          </a>
        }
      </div>
    </section>
  `,
  styles: [`
    .home { max-width: 920px; margin: 0 auto; padding: 32px 20px; color: var(--app-text); }
    .home h1 { margin: 0 0 6px; }
    .lead { color: var(--app-text-muted); margin: 0 0 24px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
    .card { display: flex; flex-direction: column; gap: 6px; padding: 16px; border-radius: 12px; background: var(--app-surface); border: 1px solid var(--app-border); color: var(--app-text); text-decoration: none; }
    .card:hover { border-color: var(--app-border-strong); }
    .card:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; }
    .card ui-icon { color: var(--app-accent); }
    .card-label { font-weight: 600; }
    .card-desc { font-size: 13px; color: var(--app-text-muted); }
  `],
})
export class HomeComponent {
  private readonly tour = inject(TourService);

  constructor() {
    // Le declenchement vit sur l'accueil, pas dans la coquille : c'est la seule page dont
    // on est sur qu'un nouvel arrivant la traverse, et la premiere etape la vise deja.
    if (this.tour.shouldAutoStart()) {
      void this.tour.start();
    }
  }

  protected readonly links: ReadonlyArray<HomeLink> = [
    { path: '/builds', label: 'Builds', icon: 'user', desc: 'Gérer tes personnages et équipements' },
    { path: '/timelines', label: 'Timelines', icon: 'clock', desc: 'Composer une suite d\'actions' },
    { path: '/freeplay', label: 'Freeplay', icon: 'play', desc: 'Tester librement sur la map' },
    { path: '/resultats', label: 'Résultats', icon: 'activity', desc: 'Voir les dégâts et le déroulé' },
    { path: '/comparaison', label: 'Comparaison', icon: 'chart', desc: 'Comparer plusieurs builds' },
  ];
}
