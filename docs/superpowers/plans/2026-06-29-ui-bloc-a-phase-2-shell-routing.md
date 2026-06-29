# UI Bloc A — Phase 2 : Coquille applicative, navigation, routes & thématisation globale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place la coquille applicative redessinée (sidebar repliable + barre supérieure) avec navigation routée entre les sections, et faire fonctionner le thème clair/sombre sur toute la page — en réhébergeant l'expérience existante sous des routes, sans réécrire la logique métier.

**Architecture:** Une `AppShellComponent` (sidebar de navigation + AppBar contenant la bascule de thème + `<router-outlet>`) devient la racine visuelle, montée par `App`. Les routes pointent vers des pages : Accueil (hub), Timelines et Freeplay réhébergent le `DashboardComponent` existant (surface de travail board + sorts), Builds et Comparaison sont des pages d'attente explicites (remplies en Phase 3). La thématisation passe globale : `body` et les éléments de base consomment les tokens `--app-*`, et les styles globaux `button {}` hérités sont restreints pour ne pas déborder sur le kit `ui/`.

**Tech Stack:** Angular 20.3 (standalone, signals, `inject()`), Angular Router, CSS variables, karma/Jasmine. (`@angular/cdk` est différé à la Phase 4, avec la passe responsive.)

---

## Pré-requis & contraintes d'exécution

- **Branche git : `feat_new-ihm`. Rester dessus. Ne jamais checkout/commit sur `main`.** Un commit par tâche. **Lancer git depuis la RACINE** `/Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur` (ne pas `cd` dans `frontend/` pour les commandes git, sinon les chemins sont faux).
- **Tests unitaires** : `ng test` exige Chrome/karma (absent de l'environnement courant). NE PAS tenter karma (échec attendu, pas un blocage). Écrire les specs (TDD) et vérifier via le build. Elles tourneront dans le CI de l'utilisateur.
- **Vérification disponible** : `cd frontend && npx ng build --configuration development` doit rester vert à chaque tâche.
- **Acquis de la Phase 1** : tokens `--app-*` (clair/sombre) dans `frontend/src/styles.css` ; `ThemeService` (`frontend/src/app/services/theme.service.ts`) ; `ThemeToggleComponent` (`frontend/src/app/ui/theme-toggle.component.ts`) ; `UiButtonComponent` (`frontend/src/app/ui/ui-button.component.ts`).

## Périmètre (frontière)

- **DANS** : thématisation globale (body/base + neutralisation des styles `button` hérités) ; composant icône inline ; sidebar de navigation repliable ; AppShell (sidebar repliée manuellement) ; routes + pages (Accueil hub + pages d'attente) ; câblage `App` → `AppShell` ; réhébergement du dashboard existant sous `/timelines` et `/freeplay` ; la bascule de thème déménage du toolbar temporaire vers l'AppBar.
- **HORS** (Phase 3) : éclatement fin du `DashboardComponent` en écrans Builds/Timelines/Freeplay distincts ; restyle profond des sous-composants hérités (build-form, spell-selector, board…) ; vue « Résultats » ; contenu réel des écrans Builds/Comparaison.
- **HORS** (Phase 4) : `@angular/cdk` + pliage automatique de la sidebar selon la largeur (tiroir mobile) ; passe responsive fine du board (zoom/tactile) ; audit a11y complet (contraste, lecteur d'écran, alternative textuelle du board).

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `frontend/src/styles.css` (modifié) | `body`/base → tokens `--app-*` ; styles `button {}` hérités restreints. |
| `frontend/src/app/ui/icon.component.ts` (+spec) | Icône SVG inline par nom (jeu minimal pour la nav). |
| `frontend/src/app/ui/app-sidebar.component.ts` (+spec) | Sidebar de navigation repliable (routerLink + `aria-current`). |
| `frontend/src/app/layout/app-shell.component.ts` (+spec) | Coquille : sidebar + AppBar (titre + bascule thème) + `<router-outlet>`, responsive. |
| `frontend/src/app/pages/home.component.ts` (+spec) | Page Accueil (hub). |
| `frontend/src/app/pages/placeholder-page.component.ts` (+spec) | Page d'attente réutilisable (Builds, Comparaison). |
| `frontend/src/app/pages/workspace-page.component.ts` | Réhéberge `<app-dashboard>` (Timelines/Freeplay). |
| `frontend/src/app/app.routes.ts` (modifié) | Routes des sections sous la coquille. |
| `frontend/src/app/app.ts` (modifié) | Rend `<app-shell>` (retire le toolbar temporaire de Phase 1). |
| `frontend/src/app/app.spec.ts` (modifié) | Fournit le router de test. |

---

### Task 1 : Thématisation globale (body/base + styles button hérités)

**Files:**
- Modify: `frontend/src/styles.css`

- [ ] **Step 1 : Faire consommer les tokens à `body` et neutraliser le débordement des boutons**

Dans `frontend/src/styles.css` :

1. Remplacer la règle `html, body { ... }` existante pour utiliser les tokens (garder la police et le reset). Repérer le bloc actuel :
```css
html,
body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: #e8ecf3;
  font-family: Inter, Segoe UI, system-ui, -apple-system, Arial, sans-serif;
  font-size: 14px;
```
et remplacer les deux lignes de couleur par les tokens :
```css
  background: var(--app-bg);
  color: var(--app-text);
```
(ne pas toucher aux autres propriétés de ce bloc).

2. Restreindre les styles `button` globaux hérités pour qu'ils n'atteignent pas le kit `ui/`. Repérer la règle globale (autour des lignes 89-108) qui commence par `button {` et ses variantes `button:hover` / `button:active`. Ajouter à CHACUN de ces sélecteurs l'exclusion `:not([ui-button]):not(.ui-theme-toggle)`. Exemple — transformer :
```css
button {
```
en :
```css
button:not([ui-button]):not(.ui-theme-toggle) {
```
et de même pour `button:hover { ... }` → `button:hover:not([ui-button]):not(.ui-theme-toggle) { ... }` et `button:active { ... }` → `button:active:not([ui-button]):not(.ui-theme-toggle) { ... }`. Ne modifier QUE les sélecteurs de ces règles, pas leurs propriétés.

- [ ] **Step 2 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: succès.

- [ ] **Step 3 : Commit** (depuis la racine)

```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/styles.css
git commit -m "feat(ui): thematisation globale body/base + isolation des boutons herites"
```

---

### Task 2 : Composant icône inline (`ui-icon`)

**Files:**
- Create: `frontend/src/app/ui/icon.component.ts`
- Test: `frontend/src/app/ui/icon.component.spec.ts`

- [ ] **Step 1 : Écrire la spec (qui échoue)**

Créer `frontend/src/app/ui/icon.component.spec.ts` :
```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';

@Component({
  standalone: true,
  imports: [IconComponent],
  template: `<ui-icon [name]="name"></ui-icon>`,
})
class HostComponent {
  name = 'home';
}

describe('IconComponent', () => {
  it('rend un svg avec un path pour un nom connu', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.querySelector('path')).toBeTruthy();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('ne rend pas de path pour un nom inconnu', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.name = 'inconnu';
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.querySelector('path')).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: erreur de compilation (`./icon.component` introuvable).

- [ ] **Step 3 : Implémenter le composant**

Créer `frontend/src/app/ui/icon.component.ts` :
```ts
import { Component, computed, input } from '@angular/core';

/** Jeu minimal d'icônes inline (24x24, currentColor) pour la navigation. */
const ICON_PATHS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  play: 'M8 5v14l11-7z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  menu: 'M4 6h16M4 12h16M4 18h16',
};

@Component({
  selector: 'ui-icon',
  standalone: true,
  template: `
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @if (path()) {
        <path [attr.d]="path()"></path>
      }
    </svg>
  `,
  styles: [`:host { display: inline-flex; line-height: 0; }`],
})
export class IconComponent {
  readonly name = input<string>('');
  protected readonly path = computed(() => ICON_PATHS[this.name()] ?? '');
}
```

- [ ] **Step 4 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: succès.

- [ ] **Step 5 : Commit** (depuis la racine)

```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/ui/icon.component.ts frontend/src/app/ui/icon.component.spec.ts
git commit -m "feat(ui): composant ui-icon (SVG inline)"
```

---

### Task 3 : Sidebar de navigation repliable (`app-sidebar`)

**Files:**
- Create: `frontend/src/app/ui/app-sidebar.component.ts`
- Test: `frontend/src/app/ui/app-sidebar.component.spec.ts`

- [ ] **Step 1 : Écrire la spec (qui échoue)**

Créer `frontend/src/app/ui/app-sidebar.component.spec.ts` :
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppSidebarComponent } from './app-sidebar.component';

describe('AppSidebarComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AppSidebarComponent],
      providers: [provideRouter([])],
    });
  });

  it('rend un lien de navigation par section', () => {
    const fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll('a.nav-item');
    expect(links.length).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('Accueil');
    expect(fixture.nativeElement.textContent).toContain('Comparaison');
  });
});
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: erreur (`./app-sidebar.component` introuvable).

- [ ] **Step 3 : Implémenter le composant**

Créer `frontend/src/app/ui/app-sidebar.component.ts` :
```ts
import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from './icon.component';

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
  `],
})
export class AppSidebarComponent {
  readonly expanded = input<boolean>(true);
  protected readonly items = NAV_ITEMS;
}
```

- [ ] **Step 4 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: succès.

- [ ] **Step 5 : Commit** (depuis la racine)

```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/ui/app-sidebar.component.ts frontend/src/app/ui/app-sidebar.component.spec.ts
git commit -m "feat(ui): sidebar de navigation repliable (app-sidebar)"
```

---

### Task 4 : Coquille applicative (`app-shell`)

**Files:**
- Create: `frontend/src/app/layout/app-shell.component.ts`
- Test: `frontend/src/app/layout/app-shell.component.spec.ts`

- [ ] **Step 1 : Écrire la spec (qui échoue)**

Créer `frontend/src/app/layout/app-shell.component.spec.ts` :
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShellComponent } from './app-shell.component';

describe('AppShellComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [provideRouter([])],
    });
  });

  it('rend la sidebar, la barre supérieure et un router-outlet', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-sidebar')).toBeTruthy();
    expect(el.querySelector('header.appbar')).toBeTruthy();
    expect(el.querySelector('ui-theme-toggle')).toBeTruthy();
    expect(el.querySelector('router-outlet')).toBeTruthy();
  });

  it('bascule l etat de la sidebar via le bouton menu', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    const cmp = fixture.componentInstance;
    fixture.detectChanges();
    const before = cmp.sidebarExpanded();
    (fixture.nativeElement.querySelector('button.menu-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(cmp.sidebarExpanded()).toBe(!before);
  });
});
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: erreur (`./app-shell.component` introuvable).

- [ ] **Step 3 : Implémenter le composant**

Créer `frontend/src/app/layout/app-shell.component.ts` :
```ts
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
```

(NB : la sidebar est contrôlée manuellement par le bouton menu en Phase 2. Le pliage automatique selon la largeur d'écran — via `@angular/cdk` `BreakpointObserver` — est ajouté en Phase 4 avec la passe responsive.)

- [ ] **Step 4 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: succès.

- [ ] **Step 5 : Commit** (depuis la racine)

```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/layout/app-shell.component.ts frontend/src/app/layout/app-shell.component.spec.ts
git commit -m "feat(ui): coquille applicative app-shell (sidebar + appbar + outlet)"
```

---

### Task 5 : Pages, routes & câblage de la coquille

**Files:**
- Create: `frontend/src/app/pages/home.component.ts` (+ `.spec.ts`)
- Create: `frontend/src/app/pages/placeholder-page.component.ts` (+ `.spec.ts`)
- Create: `frontend/src/app/pages/workspace-page.component.ts`
- Modify: `frontend/src/app/app.routes.ts`
- Modify: `frontend/src/app/app.ts`
- Modify: `frontend/src/app/app.spec.ts`

- [ ] **Step 1 : Page d'attente réutilisable + sa spec**

Créer `frontend/src/app/pages/placeholder-page.component.ts` :
```ts
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
    .placeholder {
      max-width: 520px; margin: 64px auto; padding: 24px;
      text-align: center; color: var(--app-text);
    }
    .placeholder h1 { margin: 0 0 8px; }
    .placeholder p { color: var(--app-text-muted); margin: 0 0 20px; }
    .cta {
      display: inline-block; padding: 10px 16px; border-radius: 8px;
      background: var(--app-accent); color: var(--app-accent-contrast); text-decoration: none;
    }
    .cta:hover { background: var(--app-accent-strong); }
    .cta:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; }
  `],
})
export class PlaceholderPageComponent {
  readonly title = input<string>('Bientôt disponible');
  readonly message = input<string>('Cette section arrive dans une prochaine étape.');
}
```

Créer `frontend/src/app/pages/placeholder-page.component.spec.ts` :
```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlaceholderPageComponent } from './placeholder-page.component';

@Component({
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page [title]="'Builds'" [message]="'msg'"></app-placeholder-page>`,
})
class HostComponent {}

describe('PlaceholderPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideRouter([])] });
  });

  it('affiche le titre et le message fournis', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Builds');
    expect(el.textContent).toContain('msg');
  });
});
```

- [ ] **Step 2 : Page Accueil (hub) + sa spec**

Créer `frontend/src/app/pages/home.component.ts` :
```ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../ui/icon.component';

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
      <div class="cards">
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
    .card {
      display: flex; flex-direction: column; gap: 6px;
      padding: 16px; border-radius: 12px;
      background: var(--app-surface); border: 1px solid var(--app-border);
      color: var(--app-text); text-decoration: none;
    }
    .card:hover { border-color: var(--app-border-strong); }
    .card:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; }
    .card ui-icon { color: var(--app-accent); }
    .card-label { font-weight: 600; }
    .card-desc { font-size: 13px; color: var(--app-text-muted); }
  `],
})
export class HomeComponent {
  protected readonly links: ReadonlyArray<HomeLink> = [
    { path: '/builds', label: 'Builds', icon: 'user', desc: 'Gérer tes personnages et équipements' },
    { path: '/timelines', label: 'Timelines', icon: 'clock', desc: 'Composer une suite d\'actions' },
    { path: '/freeplay', label: 'Freeplay', icon: 'play', desc: 'Tester librement sur la map' },
    { path: '/comparaison', label: 'Comparaison', icon: 'chart', desc: 'Comparer plusieurs builds' },
  ];
}
```

Créer `frontend/src/app/pages/home.component.spec.ts` :
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HomeComponent], providers: [provideRouter([])] });
  });

  it('rend une carte par section', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('a.card');
    expect(cards.length).toBe(4);
  });
});
```

- [ ] **Step 3 : Page de travail réhébergeant le dashboard existant**

Créer `frontend/src/app/pages/workspace-page.component.ts` :
```ts
import { Component } from '@angular/core';
import { DashboardComponent } from '../components/dashboard.component';

@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [DashboardComponent],
  template: `<app-dashboard></app-dashboard>`,
})
export class WorkspacePageComponent {}
```

- [ ] **Step 4 : Définir les routes**

Remplacer le contenu de `frontend/src/app/app.routes.ts` par :
```ts
import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home.component';
import { WorkspacePageComponent } from './pages/workspace-page.component';
import { PlaceholderPageComponent } from './pages/placeholder-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'accueil', pathMatch: 'full' },
  { path: 'accueil', component: HomeComponent },
  {
    path: 'builds',
    component: PlaceholderPageComponent,
    data: { title: 'Builds', message: 'La gestion des builds arrive dans la prochaine étape.' },
  },
  { path: 'timelines', component: WorkspacePageComponent },
  { path: 'freeplay', component: WorkspacePageComponent },
  {
    path: 'comparaison',
    component: PlaceholderPageComponent,
    data: { title: 'Comparaison', message: 'La comparaison de builds arrive dans une prochaine étape.' },
  },
  { path: '**', redirectTo: 'accueil' },
];
```

NB : les `data.title`/`data.message` ne sont pas lus automatiquement par les `input()` du placeholder. Pour rester simple et data-driven sans `ActivatedRoute`, créer deux mini-composants dédiés. Remplacer les deux entrées placeholder ci-dessus par des composants concrets : ajouter à la fin de `placeholder-page.component.ts` deux sous-classes :
```ts
@Component({
  selector: 'app-builds-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page title="Builds" message="La gestion des builds arrive dans la prochaine étape."></app-placeholder-page>`,
})
export class BuildsPageComponent {}

@Component({
  selector: 'app-comparaison-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page title="Comparaison" message="La comparaison de builds arrive dans une prochaine étape."></app-placeholder-page>`,
})
export class ComparaisonPageComponent {}
```
(ajouter les imports `Component`/`input` déjà présents ; `RouterLink` déjà importé). Puis dans `app.routes.ts`, importer `BuildsPageComponent` et `ComparaisonPageComponent` et router `builds`→`BuildsPageComponent`, `comparaison`→`ComparaisonPageComponent` (sans bloc `data`).

- [ ] **Step 5 : Câbler `App` sur la coquille**

Remplacer le contenu de `frontend/src/app/app.ts` par :
```ts
import { Component, inject } from '@angular/core';
import { AppShellComponent } from './layout/app-shell.component';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AppShellComponent],
  template: `<app-shell></app-shell>`,
})
export class App {
  // Injecté pour appliquer le thème (data-theme) dès le bootstrap via son constructeur.
  private readonly theme = inject(ThemeService);
}
```

- [ ] **Step 6 : Mettre à jour la spec racine (fournir le router)**

Remplacer le contenu de `frontend/src/app/app.spec.ts` par :
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
```

- [ ] **Step 7 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: succès. (Le routeur est déjà fourni globalement par `provideRouter(routes)` dans `app.config.ts`.)

- [ ] **Step 8 : Vérification manuelle**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng serve` puis ouvrir `http://localhost:4200`.
Vérifier :
- redirection vers `/accueil` ; le hub affiche 4 cartes ;
- la sidebar liste 5 sections ; les liens naviguent ; l'item actif est mis en valeur ;
- le bouton menu replie/déplie la sidebar ;
- la bascule de thème (AppBar) change clair/sombre et **toute la page** suit (fond + texte de base) ;
- `/timelines` et `/freeplay` affichent l'espace de travail existant (board + sorts + résumés) sans régression ;
- `/builds` et `/comparaison` affichent la page d'attente.

- [ ] **Step 9 : Commit** (depuis la racine)

```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/pages frontend/src/app/app.routes.ts frontend/src/app/app.ts frontend/src/app/app.spec.ts
git commit -m "feat(ui): routes + coquille (accueil, espace de travail rehebergé, pages d attente)"
```

---

## Self-review (effectué)

- **Couverture (périmètre Phase 2)** : thématisation globale (T1), icône (T2), sidebar (T3), shell (T4), routes + pages + câblage + réhébergement (T5). Le split fin des écrans et le restyle profond des sous-composants restent explicitement Phase 3 ; `@angular/cdk` + responsive auto = Phase 4.
- **Placeholders** : aucun « TBD » ; tout le code est fourni. Les pages « d'attente » sont une fonctionnalité voulue (sections Phase 3), pas un placeholder de plan.
- **Cohérence des types/sélecteurs** : `ui-icon` (`name`), `app-sidebar` (`expanded`), `app-shell` (`sidebarExpanded()`, `toggleSidebar()`, bouton `.menu-btn`), routes `/accueil /builds /timelines /freeplay /comparaison`, `App` → `<app-shell>`. La spec du shell teste `.menu-btn`, `app-sidebar`, `header.appbar`, `ui-theme-toggle`, `router-outlet` — tous présents dans le template.
- **Risque** : `WorkspacePageComponent` réutilise `DashboardComponent` tel quel → aucune logique board/moteur modifiée. Le `ThemeService` reste `providedIn:'root'`, partagé par toutes les routes.
- **Note env** : specs non exécutables ici (pas de Chrome) ; `ng build` est la barrière.

## Suite

Phase 3 (plan séparé) : éclater `DashboardComponent` en écrans Builds / Timelines (éditeur map+sorts) / Freeplay distincts, vue « Résultats » de timeline, et restyle profond des sous-composants hérités avec le kit `ui/` + tokens.
