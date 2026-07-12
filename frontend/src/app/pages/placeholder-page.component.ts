import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="placeholder">
      <h1>{{ title() }}</h1>
      <p>{{ message() }}</p>
      <a class="cta" routerLink="/timelines">Aller à l'espace de travail</a>
    </section>
  `,
  styles: [`
    .placeholder { max-width: 520px; margin: 64px auto; padding: 24px; text-align: center; color: var(--app-text); }
    .placeholder h1 { margin: 0 0 8px; }
    .placeholder p { color: var(--app-text-muted); margin: 0 0 20px; }
    .cta { display: inline-block; padding: 10px 16px; border-radius: 8px; background: var(--app-accent); color: var(--app-accent-contrast); text-decoration: none; }
    .cta:hover { background: var(--app-accent-strong); }
    .cta:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; }
  `],
})
export class PlaceholderPageComponent {
  readonly title = input<string>('Bientôt disponible');
  readonly message = input<string>('Cette section arrive dans une prochaine étape.');
}

@Component({
  selector: 'app-comparaison-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page title="Comparaison" message="La comparaison de builds arrive dans une prochaine étape."></app-placeholder-page>`,
})
export class ComparaisonPageComponent {}
