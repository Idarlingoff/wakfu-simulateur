import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AppSidebarComponent } from '../ui/app-sidebar.component';
import { ThemeToggleComponent } from '../ui/theme-toggle.component';
import { IconComponent } from '../ui/icon.component';
import { SaveErrorService } from '../services/save-error.service';
import { AuthService } from '../services/auth.service';
import { LocalDataImportService } from '../services/storage/local-data-import.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, AppSidebarComponent, ThemeToggleComponent, IconComponent],
  template: `
    <div class="shell">
      <app-sidebar class="shell-sidebar" [expanded]="sidebarExpanded()"></app-sidebar>
      <div class="shell-main">
        <header class="appbar">
          <button
            type="button"
            class="menu-btn"
            (click)="toggleSidebar()"
            aria-label="Afficher/masquer la navigation"
          >
            <ui-icon name="menu"></ui-icon>
          </button>
          <span class="appbar-title">Wakfu Simulator</span>
          <span class="appbar-spacer"></span>
          <ui-theme-toggle></ui-theme-toggle>
        </header>
        @if (saveError.message()) {
          <div class="save-error" role="alert">
            {{ saveError.message() }}
            <button type="button" (click)="saveError.dismiss()" aria-label="Fermer">×</button>
          </div>
        }
        @if (importService.pending()) {
          <div class="import-prompt">
            Des builds ou timelines de ce navigateur ne sont pas dans ton compte.
            <a routerLink="/import">Les importer</a>
          </div>
        }
        <main class="shell-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .shell { display: flex; height: 100vh; background: var(--app-bg); color: var(--app-text); }
    .shell-sidebar { flex: 0 0 auto; }
    .shell-main { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
    .appbar {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 52px;
      padding: 0 14px;
      border-bottom: 1px solid var(--app-border);
      background: var(--app-surface);
    }
    .menu-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 8px;
      background: transparent; border: 1px solid var(--app-border);
      color: var(--app-text); cursor: pointer;
    }
    .menu-btn:hover { border-color: var(--app-border-strong); }
    .menu-btn:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; }
    .appbar-title { font-weight: 600; }
    .appbar-spacer { flex: 1 1 auto; }
    .shell-content { flex: 1 1 auto; min-height: 0; overflow: auto; }
    .save-error {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 8px 12px; background: #e5484d; color: #fff; font-size: 13px;
    }
    .save-error button { background: none; border: 0; color: #fff; font-size: 18px; cursor: pointer; }
    .import-prompt {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; background: var(--app-surface);
      border-bottom: 1px solid var(--app-border); font-size: 13px;
    }
    .import-prompt a { color: var(--app-accent); }
  `],
})
export class AppShellComponent {
  protected readonly saveError = inject(SaveErrorService);
  protected readonly importService = inject(LocalDataImportService);
  private readonly auth = inject(AuthService);

  readonly sidebarExpanded = signal<boolean>(true);

  constructor() {
    // Recalcule a chaque changement d'etat d'auth, y compris une session restauree au
    // chargement : sans cela, un utilisateur deja connecte n'aurait aucun moyen de
    // decouvrir l'import, la page /connexion n'etant jamais retraversee.
    effect(() => {
      this.auth.status();
      void this.importService.refreshPending();
    });
  }

  toggleSidebar(): void {
    this.sidebarExpanded.update(v => !v);
  }
}
