import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppSidebarComponent } from '../ui/app-sidebar.component';
import { ThemeToggleComponent } from '../ui/theme-toggle.component';
import { IconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, AppSidebarComponent, ThemeToggleComponent, IconComponent],
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
  `],
})
export class AppShellComponent {
  readonly sidebarExpanded = signal<boolean>(true);

  toggleSidebar(): void {
    this.sidebarExpanded.update(v => !v);
  }
}
