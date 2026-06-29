# UI Bloc A — Phase 1 : Fondations (tokens + thème + premiers composants `ui/`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser la fondation du design system (tokens CSS clair/sombre + `ThemeService`) et les deux premiers composants du kit `ui/` (bouton, bascule de thème), avec un thème commutable réellement actif dans l'app.

**Architecture:** On ajoute des tokens sémantiques préfixés `--app-*` dans `src/styles.css` (cohabitent avec les variables héritées sans les écraser). Un `ThemeService` à base de signal applique `data-theme` sur `document.documentElement` et persiste le choix. Deux composants standalone (`ui-theme-toggle`, `button[ui-button]`) consomment ces tokens. Le thème est appliqué au bootstrap par la racine `App`, et une bascule est montée dans une fine barre d'outils au-dessus du dashboard existant (deviendra l'AppBar en Phase 2).

**Tech Stack:** Angular 20.3 (standalone, signals, `input()`/`output()`/`inject()`), TypeScript, CSS variables, karma/Jasmine pour les tests.

---

## Pré-requis & contraintes d'exécution

- **Tests unitaires** : `ng test` utilise karma + Chrome. Si l'environnement n'a pas de binaire Chrome, exporter `CHROME_BIN` vers un Chromium, ou exécuter sur une machine avec Chrome. Commande de référence : `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`. Elle exécute **toute** la suite (karma ne filtre pas par fichier) ; repérer le bloc `describe` concerné dans la sortie.
- **Vérification toujours disponible** : `cd frontend && npx ng build --configuration development` doit rester vert à chaque tâche.
- **Périmètre Phase 1** : tokens + `ThemeService` + `ui-theme-toggle` + `button[ui-button]` + câblage. Pas de sidebar, pas de routes, pas de CDK (Phase 2). Le dashboard hérité reste tel quel ; en thème clair il ne se repeint pas entièrement (ses couleurs codées en dur restent), c'est **attendu** — la migration visuelle des écrans est en Phase 3.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `frontend/src/styles.css` (modifié) | Tokens sémantiques `--app-*` pour thèmes `dark` (défaut) et `light`. |
| `frontend/src/app/services/theme.service.ts` (créé) | État du thème (signal), application de `data-theme`, persistance localStorage. |
| `frontend/src/app/services/theme.service.spec.ts` (créé) | Specs du service. |
| `frontend/src/app/ui/theme-toggle.component.ts` (créé) | Bouton de bascule de thème. |
| `frontend/src/app/ui/theme-toggle.component.spec.ts` (créé) | Spec du toggle. |
| `frontend/src/app/ui/ui-button.component.ts` (créé) | Composant bouton du kit (`button[ui-button]`). |
| `frontend/src/app/ui/ui-button.component.spec.ts` (créé) | Specs du bouton. |
| `frontend/src/app/app.ts` (modifié) | Applique le thème au bootstrap + monte la bascule. |
| `frontend/src/app/app.spec.ts` (modifié) | Retire le test de titre obsolète. |

---

### Task 1 : Tokens de design (thèmes clair/sombre)

**Files:**
- Modify: `frontend/src/styles.css`

- [ ] **Step 1 : Ajouter les blocs de tokens**

Ajouter à la **fin** de `frontend/src/styles.css` :

```css
/* ============================================================
   Design tokens — Bloc A (themes clair/sombre)
   Prefixe --app-* pour cohabiter avec les variables heritees
   (--bg, --panel...) sans les ecraser pendant la migration.
   ============================================================ */
:root,
[data-theme='dark'] {
  --app-bg: #0f1115;
  --app-surface: #181b22;
  --app-surface-2: #1d2230;
  --app-text: #e8ecf3;
  --app-text-muted: #8c9bb3;
  --app-text-subtle: #5c6678;
  --app-border: #2a2f3a;
  --app-border-strong: #3a4150;
  --app-accent: #a78bfa;
  --app-accent-strong: #c4b5fd;
  --app-accent-contrast: #0f1115;
  --app-accent-2: #ffd166;
  --app-danger: #ef476f;
  --app-success: #7bd88f;
  --app-warning: #ffd166;
  --app-info: #4cc9f0;
  --app-focus: #a78bfa;
}

[data-theme='light'] {
  --app-bg: #f6f7f9;
  --app-surface: #ffffff;
  --app-surface-2: #eceff4;
  --app-text: #1a1d24;
  --app-text-muted: #586074;
  --app-text-subtle: #8a93a6;
  --app-border: #e2e6ec;
  --app-border-strong: #cbd2dc;
  --app-accent: #7c3aed;
  --app-accent-strong: #6d28d9;
  --app-accent-contrast: #ffffff;
  --app-accent-2: #b87503;
  --app-danger: #d12c54;
  --app-success: #2f9e5e;
  --app-warning: #b7791f;
  --app-info: #1f86a8;
  --app-focus: #7c3aed;
}
```

- [ ] **Step 2 : Vérifier le build**

Run: `cd frontend && npx ng build --configuration development`
Expected: `Application bundle generation complete.` sans erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/styles.css
git commit -m "feat(ui): ajoute les tokens de design clair/sombre (--app-*)"
```

---

### Task 2 : ThemeService

**Files:**
- Create: `frontend/src/app/services/theme.service.ts`
- Test: `frontend/src/app/services/theme.service.spec.ts`

- [ ] **Step 1 : Écrire les specs (qui échouent)**

Créer `frontend/src/app/services/theme.service.spec.ts` :

```ts
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.removeItem('wakfu-theme');
    document.documentElement.removeAttribute('data-theme');
  });

  it('applique le theme stocke au demarrage', () => {
    localStorage.setItem('wakfu-theme', 'light');
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('setTheme met a jour le signal, l attribut et le stockage', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('light');
    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('wakfu-theme')).toBe('light');
  });

  it('toggle bascule entre sombre et clair', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('dark');
    service.toggle();
    expect(service.theme()).toBe('light');
    service.toggle();
    expect(service.theme()).toBe('dark');
  });
});
```

- [ ] **Step 2 : Lancer les specs pour vérifier qu'elles échouent**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: échec de compilation / `Cannot find module './theme.service'` (le service n'existe pas encore).

- [ ] **Step 3 : Implémenter le service**

Créer `frontend/src/app/services/theme.service.ts` :

```ts
import { Injectable, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'wakfu-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<AppTheme>(this.resolveInitialTheme());
  readonly theme = this._theme.asReadonly();

  constructor() {
    this.apply(this._theme());
  }

  setTheme(theme: AppTheme): void {
    this._theme.set(theme);
    this.apply(theme);
  }

  toggle(): void {
    this.setTheme(this._theme() === 'dark' ? 'light' : 'dark');
  }

  private resolveInitialTheme(): AppTheme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      /* localStorage indisponible */
    }
    const prefersLight =
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  }

  private apply(theme: AppTheme): void {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* localStorage indisponible */
    }
  }
}
```

- [ ] **Step 4 : Lancer les specs pour vérifier qu'elles passent**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: les 3 specs `ThemeService` passent.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/services/theme.service.ts frontend/src/app/services/theme.service.spec.ts
git commit -m "feat(ui): ThemeService (signal, data-theme, persistance)"
```

---

### Task 3 : Composant bascule de thème (`ui-theme-toggle`)

**Files:**
- Create: `frontend/src/app/ui/theme-toggle.component.ts`
- Test: `frontend/src/app/ui/theme-toggle.component.spec.ts`

- [ ] **Step 1 : Écrire la spec (qui échoue)**

Créer `frontend/src/app/ui/theme-toggle.component.spec.ts` :

```ts
import { TestBed } from '@angular/core/testing';
import { ThemeToggleComponent } from './theme-toggle.component';
import { ThemeService } from '../services/theme.service';

describe('ThemeToggleComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('wakfu-theme');
    document.documentElement.removeAttribute('data-theme');
  });

  it('bascule le theme au clic et reflete aria-pressed', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('dark');
    const fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    fixture.detectChanges();
    expect(service.theme()).toBe('light');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
});
```

- [ ] **Step 2 : Lancer la spec pour vérifier qu'elle échoue**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `Cannot find module './theme-toggle.component'`.

- [ ] **Step 3 : Implémenter le composant**

Créer `frontend/src/app/ui/theme-toggle.component.ts` :

```ts
import { Component, computed, inject } from '@angular/core';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'ui-theme-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="ui-theme-toggle"
      [attr.aria-pressed]="isDark()"
      [attr.aria-label]="isDark() ? 'Activer le theme clair' : 'Activer le theme sombre'"
      (click)="theme.toggle()"
    >
      <span aria-hidden="true">{{ isDark() ? '☾' : '☀' }}</span>
    </button>
  `,
  styles: [`
    .ui-theme-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid var(--app-border);
      background: var(--app-surface);
      color: var(--app-text);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
    }
    .ui-theme-toggle:hover { border-color: var(--app-border-strong); }
    .ui-theme-toggle:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; }
  `],
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly isDark = computed(() => this.theme.theme() === 'dark');
}
```

- [ ] **Step 4 : Lancer la spec pour vérifier qu'elle passe**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: la spec `ThemeToggleComponent` passe.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/ui/theme-toggle.component.ts frontend/src/app/ui/theme-toggle.component.spec.ts
git commit -m "feat(ui): composant ui-theme-toggle"
```

---

### Task 4 : Composant bouton du kit (`button[ui-button]`)

**Files:**
- Create: `frontend/src/app/ui/ui-button.component.ts`
- Test: `frontend/src/app/ui/ui-button.component.spec.ts`

- [ ] **Step 1 : Écrire les specs (qui échouent)**

Créer `frontend/src/app/ui/ui-button.component.spec.ts` :

```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiButtonComponent } from './ui-button.component';

@Component({
  standalone: true,
  imports: [UiButtonComponent],
  template: `<button ui-button [variant]="variant" [disabled]="disabled">Action</button>`,
})
class HostComponent {
  variant: 'primary' | 'ghost' | 'danger' = 'primary';
  disabled = false;
}

describe('UiButtonComponent', () => {
  it('applique la classe de variante et projette le contenu', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.classList).toContain('ui-btn--primary');
    expect(btn.textContent?.trim()).toBe('Action');
  });

  it('reflete la variante danger', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.variant = 'danger';
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.classList).toContain('ui-btn--danger');
  });

  it('desactive le bouton', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.disabled = true;
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer les specs pour vérifier qu'elles échouent**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `Cannot find module './ui-button.component'`.

- [ ] **Step 3 : Implémenter le composant**

Créer `frontend/src/app/ui/ui-button.component.ts` :

```ts
import { Component, computed, input } from '@angular/core';

export type UiButtonVariant = 'primary' | 'ghost' | 'danger';

@Component({
  selector: 'button[ui-button]',
  standalone: true,
  host: {
    '[class]': 'hostClass()',
    '[disabled]': 'disabled() || null',
  },
  template: `<ng-content></ng-content>`,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 36px;
      padding: 0 14px;
      border-radius: 8px;
      border: 1px solid transparent;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    :host(:focus-visible) { outline: 2px solid var(--app-focus); outline-offset: 2px; }
    :host([disabled]) { opacity: 0.5; cursor: not-allowed; }
    :host(.ui-btn--primary) { background: var(--app-accent); color: var(--app-accent-contrast); }
    :host(.ui-btn--primary:hover:not([disabled])) { background: var(--app-accent-strong); }
    :host(.ui-btn--ghost) { background: transparent; color: var(--app-text); border-color: var(--app-border); }
    :host(.ui-btn--ghost:hover:not([disabled])) { border-color: var(--app-border-strong); }
    :host(.ui-btn--danger) { background: var(--app-danger); color: #ffffff; }
  `],
})
export class UiButtonComponent {
  readonly variant = input<UiButtonVariant>('primary');
  readonly disabled = input<boolean>(false);
  protected readonly hostClass = computed(() => `ui-btn ui-btn--${this.variant()}`);
}
```

- [ ] **Step 4 : Lancer les specs pour vérifier qu'elles passent**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: les 3 specs `UiButtonComponent` passent.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/ui/ui-button.component.ts frontend/src/app/ui/ui-button.component.spec.ts
git commit -m "feat(ui): composant bouton du kit (button[ui-button])"
```

---

### Task 5 : Câblage dans l'app + nettoyage de la spec racine

**Files:**
- Modify: `frontend/src/app/app.ts`
- Modify: `frontend/src/app/app.spec.ts`

- [ ] **Step 1 : Appliquer le thème au bootstrap + monter la bascule**

Remplacer le contenu de `frontend/src/app/app.ts` par :

```ts
import { Component, inject } from '@angular/core';
import { DashboardComponent } from './components/dashboard.component';
import { ThemeToggleComponent } from './ui/theme-toggle.component';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DashboardComponent, ThemeToggleComponent],
  template: `
    <div class="app-toolbar">
      <ui-theme-toggle></ui-theme-toggle>
    </div>
    <app-dashboard></app-dashboard>
  `,
  styles: [`
    .app-toolbar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 8px 12px;
    }
  `],
})
export class App {
  private readonly theme = inject(ThemeService);
}
```

(L'injection de `ThemeService` suffit à appliquer `data-theme` dès le démarrage via son constructeur.)

- [ ] **Step 2 : Mettre à jour la spec racine (retirer le test de titre obsolète)**

Remplacer le contenu de `frontend/src/app/app.spec.ts` par :

```ts
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
```

- [ ] **Step 3 : Lancer la suite de tests**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: toutes les specs passent (ThemeService, ThemeToggle, UiButton, App).

- [ ] **Step 4 : Vérifier le build**

Run: `cd frontend && npx ng build --configuration development`
Expected: `Application bundle generation complete.` sans erreur.

- [ ] **Step 5 : Vérification manuelle**

Run: `cd frontend && npx ng serve` puis ouvrir `http://localhost:4200`.
Vérifier :
- une bascule (☀/☾) apparaît en haut à droite ;
- cliquer alterne `data-theme="light"`/`"dark"` sur `<html>` (inspecteur) ;
- le choix persiste après rechargement (localStorage `wakfu-theme`) ;
- au premier chargement sans préférence stockée, le thème suit le réglage système (sombre par défaut sinon).

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/app/app.ts frontend/src/app/app.spec.ts
git commit -m "feat(ui): applique le theme au bootstrap + bascule dans la barre d outils"
```

---

## Self-review (effectué)

- **Couverture du spec (Phase 1 uniquement)** : tokens clair/sombre (Task 1), `ThemeService` + `prefers-color-scheme` + persistance (Task 2), premiers composants `ui/` (Tasks 3–4), thème réellement actif (Task 5). Sidebar/routes/CDK/responsive/a11y complète = Phases 2–4 (plans séparés).
- **Placeholders** : aucun — chaque étape contient le code complet et les commandes.
- **Cohérence des types** : `AppTheme`, `ThemeService.theme()/setTheme()/toggle()`, `UiButtonVariant`, sélecteurs `ui-theme-toggle` et `button[ui-button]` cohérents entre composants, specs et câblage.
- **Note environnement** : les étapes `ng test` nécessitent Chrome ; sans lui, exécuter sur une machine/CI équipée. `ng build` reste la vérification disponible partout.

## Suite

Phase 2 (plan séparé) : installer `@angular/cdk`, créer `AppShellComponent` (sidebar repliable + AppBar accueillant la bascule), définir les routes et réhéberger les composants existants (board, panneau sorts, sélecteurs, résumés) dans Builds / Timelines / Freeplay.
