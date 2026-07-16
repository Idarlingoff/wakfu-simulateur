import { Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from './icon.component';
import { AuthService } from '../services/auth.service';

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { path: '/accueil', label: 'Accueil', icon: 'home' },
  { path: '/builds', label: 'Builds', icon: 'user' },
  { path: '/timelines', label: 'Timelines', icon: 'clock' },
  { path: '/freeplay', label: 'Freeplay', icon: 'play' },
  { path: '/resultats', label: 'Résultats', icon: 'activity' },
  { path: '/comparaison', label: 'Comparaison', icon: 'chart' },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <nav class="sidebar" [class.expanded]="expanded()" aria-label="Navigation principale">
      <div class="brand">
        <ui-icon name="play"></ui-icon>
        @if (expanded()) { <span class="brand-text">Wakfu Sim</span> }
      </div>
      <ul class="nav-list">
        @for (item of items; track item.path) {
          <li>
            <a
              class="nav-item"
              [routerLink]="item.path"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              [attr.title]="expanded() ? null : item.label"
            >
              <ui-icon [name]="item.icon"></ui-icon>
              @if (expanded()) { <span class="nav-label">{{ item.label }}</span> }
            </a>
          </li>
        }
      </ul>

      <div class="account">
        @if (status() === 'authenticated') {
          <a class="nav-item" routerLink="/accueil" (click)="signOut()" [attr.title]="expanded() ? null : 'Se déconnecter'">
            <ui-icon name="log-out"></ui-icon>
            @if (expanded()) { <span class="nav-label">{{ profile()?.username ?? 'Mon compte' }}</span> }
          </a>
        } @else if (status() === 'anonymous') {
          <a class="nav-item" routerLink="/connexion" routerLinkActive="active" [attr.title]="expanded() ? null : 'Se connecter'">
            <ui-icon name="log-in"></ui-icon>
            @if (expanded()) { <span class="nav-label">Se connecter</span> }
          </a>
        }
      </div>
    </nav>
  `,
  styles: [`
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 56px;
      height: 100%;
      padding: 10px 8px;
      background: var(--app-surface);
      border-right: 1px solid var(--app-border);
      transition: width 0.18s ease;
    }
    .sidebar.expanded { width: 200px; }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 40px;
      padding: 0 8px;
      color: var(--app-accent);
      font-weight: 600;
    }
    .brand-text { color: var(--app-text); white-space: nowrap; }
    .nav-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 40px;
      padding: 0 10px;
      border-radius: 8px;
      color: var(--app-text-muted);
      text-decoration: none;
      white-space: nowrap;
    }
    .nav-item:hover { background: var(--app-surface-2); color: var(--app-text); }
    .nav-item.active { background: var(--app-surface-2); color: var(--app-text); }
    .nav-item.active ui-icon { color: var(--app-accent); }
    .nav-item:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; }
    .nav-label { font-size: 13px; }
    .account { margin-top: auto; border-top: 1px solid var(--app-border); padding-top: 6px; }
  `],
})
export class AppSidebarComponent {
  private readonly auth = inject(AuthService);

  readonly expanded = input<boolean>(true);
  protected readonly items = NAV_ITEMS;

  // 'loading' n'affiche rien : evite le flash "Se connecter" au rafraichissement
  // pour un utilisateur deja connecte.
  protected readonly status = this.auth.status;
  protected readonly profile = this.auth.profile;

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
