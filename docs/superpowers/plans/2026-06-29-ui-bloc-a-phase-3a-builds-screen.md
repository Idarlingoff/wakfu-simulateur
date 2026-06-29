# UI Bloc A — Phase 3a : Écran Builds (liste + CRUD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la page d'attente `/builds` par un véritable écran de gestion des builds (grille de cartes + création/édition/suppression/sélection), réutilisant `BuildService` et le formulaire modal existant `BuildFormComponent`, avec le kit `ui/` + tokens.

**Architecture:** Un `BuildsListComponent` routé sur `/builds` lit `BuildService.allBuilds()` et affiche une carte par build (nom, classe, niveau, PA/PM/PW). Les actions délèguent au `BuildService` (suppression, sélection) et au `BuildFormComponent` embarqué (création/édition via `openNew()`/`openEdit()`), qui persiste déjà via `BuildService`. Aucune logique métier dupliquée.

**Tech Stack:** Angular 20.3 (standalone, signals, `inject()`, `viewChild`), Angular Router, CSS variables, karma/Jasmine.

---

## Pré-requis & contraintes d'exécution

- **Branche `feat_new-ihm`. Rester dessus. Jamais `main`.** Un commit par tâche. **git depuis la RACINE** `/Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur`.
- `ng test` exige Chrome (absent ici) — NE PAS lancer karma (échec attendu). Écrire les specs (TDD) et vérifier via `cd frontend && npx ng build --configuration development`.
- **Acquis** : kit `ui/` (`ui-button`, `ui-icon`), tokens `--app-*`, coquille routée (Phase 2). `BuildService` API : `allBuilds()` (signal), `selectedBuildA()` (signal), `selectBuildA(build|null)`, `createBuild(build)`, `updateBuild(id, partial)`, `deleteBuild(id)`. `BuildFormComponent` (selector `app-build-form`) : modal n'injectant QUE `BuildService` ; méthodes publiques `openNew()` et `openEdit(build)` ; persiste lui-même.

## Périmètre

- **DANS** : `BuildsListComponent` (grille de cartes + état vide + nouveau/éditer/supprimer/sélectionner) ; route `/builds` → ce composant ; retrait du placeholder `BuildsPageComponent` devenu inutile.
- **HORS** : duplication de build (suivi ultérieur — évite la gestion d'id ici) ; restyle interne du `BuildFormComponent` (Phase 3d) ; dédup du header dashboard (Phase 3b).

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `frontend/src/app/pages/builds-list.component.ts` (+spec) | Écran de gestion des builds. |
| `frontend/src/app/pages/placeholder-page.component.ts` (modifié) | Retire `BuildsPageComponent` (conserve `PlaceholderPageComponent` + `ComparaisonPageComponent`). |
| `frontend/src/app/app.routes.ts` (modifié) | `/builds` → `BuildsListComponent`. |

---

### Task 1 : BuildsListComponent

**Files:**
- Create: `frontend/src/app/pages/builds-list.component.ts`
- Test: `frontend/src/app/pages/builds-list.component.spec.ts`

- [ ] **Step 1 : Écrire la spec (qui échoue)**

Créer `frontend/src/app/pages/builds-list.component.spec.ts` :
```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BuildsListComponent } from './builds-list.component';
import { BuildService } from '../services/build.service';
import { Build } from '../models/build.model';

function makeBuild(id: string, name: string): Build {
  return {
    id, name, classId: 'XEL', characterLevel: 230,
    spellBar: { spells: [] }, passiveBar: { passives: [] }, sublimationBar: { sublimations: [] },
    stats: {
      level: 230, masteryFire: 0, masteryWater: 0, masteryEarth: 0, masteryAir: 0,
      masterySecondary: 0, backMastery: 0, dommageInflict: 0, critRate: 0, critMastery: 0,
      resistance: 0, ap: 12, mp: 4, wp: 6, range: 0,
    },
  };
}

class StubBuildService {
  readonly allBuilds = signal<Build[]>([makeBuild('b1', 'Rouage'), makeBuild('b2', 'Burst')]);
  readonly selectedBuildA = signal<Build | null>(null);
  selectBuildA = jasmine.createSpy('selectBuildA');
  createBuild = jasmine.createSpy('createBuild');
  updateBuild = jasmine.createSpy('updateBuild');
  deleteBuild = jasmine.createSpy('deleteBuild');
}

describe('BuildsListComponent', () => {
  let stub: StubBuildService;

  beforeEach(() => {
    stub = new StubBuildService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BuildsListComponent],
      providers: [provideRouter([]), { provide: BuildService, useValue: stub }],
    });
  });

  it('rend une carte par build', () => {
    const fixture = TestBed.createComponent(BuildsListComponent);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('article.card');
    expect(cards.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Rouage');
    expect(fixture.nativeElement.textContent).toContain('Burst');
  });

  it('affiche l etat vide sans build', () => {
    stub.allBuilds.set([]);
    const fixture = TestBed.createComponent(BuildsListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('article.card').length).toBe(0);
  });

  it('supprime un build apres confirmation', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = TestBed.createComponent(BuildsListComponent);
    fixture.detectChanges();
    fixture.componentInstance.deleteBuild(stub.allBuilds()[0]);
    expect(stub.deleteBuild).toHaveBeenCalledWith('b1');
  });

  it('ne supprime pas si confirmation refusee', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const fixture = TestBed.createComponent(BuildsListComponent);
    fixture.detectChanges();
    fixture.componentInstance.deleteBuild(stub.allBuilds()[0]);
    expect(stub.deleteBuild).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: erreur (`./builds-list.component` introuvable).

- [ ] **Step 3 : Implémenter le composant**

Créer `frontend/src/app/pages/builds-list.component.ts` :
```ts
import { Component, computed, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { BuildService } from '../services/build.service';
import { BuildFormComponent } from '../components/build-form.component';
import { UiButtonComponent } from '../ui/ui-button.component';
import { IconComponent } from '../ui/icon.component';
import { Build } from '../models/build.model';

@Component({
  selector: 'app-builds-list',
  standalone: true,
  imports: [BuildFormComponent, UiButtonComponent, IconComponent],
  template: `
    <section class="builds">
      <header class="builds-head">
        <h1>Builds</h1>
        <button ui-button variant="primary" (click)="createBuild()">
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
                <button ui-button variant="ghost" (click)="selectBuild(build)">Sélectionner</button>
                <button ui-button variant="ghost" (click)="editBuild(build)" [attr.aria-label]="'Modifier ' + build.name">Modifier</button>
                <button ui-button variant="danger" (click)="deleteBuild(build)" [attr.aria-label]="'Supprimer ' + build.name">Supprimer</button>
              </div>
            </article>
          }
        </div>
      }
    </section>

    <app-build-form #buildForm></app-build-form>
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
  private readonly buildForm = viewChild.required(BuildFormComponent);

  protected readonly builds = this.buildService.allBuilds;
  protected readonly selectedId = computed(() => this.buildService.selectedBuildA()?.id ?? null);

  createBuild(): void {
    this.buildForm().openNew();
  }

  editBuild(build: Build): void {
    this.buildForm().openEdit(build);
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
}
```

- [ ] **Step 4 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: succès.

- [ ] **Step 5 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/pages/builds-list.component.ts frontend/src/app/pages/builds-list.component.spec.ts
git commit -m "feat(ui): ecran Builds (liste + creation/edition/suppression/selection)"
```

---

### Task 2 : Router `/builds` vers le nouvel écran

**Files:**
- Modify: `frontend/src/app/app.routes.ts`
- Modify: `frontend/src/app/pages/placeholder-page.component.ts`

- [ ] **Step 1 : Retirer `BuildsPageComponent` du fichier placeholder**

Dans `frontend/src/app/pages/placeholder-page.component.ts`, supprimer le bloc `@Component({...}) export class BuildsPageComponent {}` (le composant `app-builds-page`). Conserver `PlaceholderPageComponent` et `ComparaisonPageComponent` inchangés.

- [ ] **Step 2 : Mettre à jour les routes**

Dans `frontend/src/app/app.routes.ts` :
- Remplacer l'import `import { BuildsPageComponent, ComparaisonPageComponent } from './pages/placeholder-page.component';` par :
```ts
import { ComparaisonPageComponent } from './pages/placeholder-page.component';
import { BuildsListComponent } from './pages/builds-list.component';
```
- Remplacer la route builds `{ path: 'builds', component: BuildsPageComponent },` par :
```ts
  { path: 'builds', component: BuildsListComponent },
```
(laisser les autres routes inchangées).

- [ ] **Step 3 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: succès (plus aucune référence à `BuildsPageComponent`).

- [ ] **Step 4 : Vérification manuelle**

`cd frontend && npx ng serve` → `/builds` affiche la grille des builds ; « Nouveau build » ouvre le formulaire ; éditer/supprimer/sélectionner fonctionnent ; l'état vide s'affiche sans build.

- [ ] **Step 5 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/app.routes.ts frontend/src/app/pages/placeholder-page.component.ts
git commit -m "feat(ui): route /builds vers l ecran Builds (retire le placeholder)"
```

---

## Self-review (effectué)

- **Couverture** : écran Builds réel (T1) + routage (T2). Duplication, restyle du form, dédup header = hors périmètre (notés).
- **Placeholders** : aucun ; code complet. Le `BuildFormComponent` n'injectant que `BuildService`, le stub du spec suffit pour le composant ET son enfant modal.
- **Cohérence** : `BuildsListComponent` (selector `app-builds-list`), méthodes `createBuild/editBuild/selectBuild/deleteBuild`, `builds()`/`selectedId()`, `viewChild.required(BuildFormComponent)` → `openNew()/openEdit()`. Le spec teste `article.card`, `.empty`, et `deleteBuild` (confirm true/false).
- **Risque** : `viewChild.required` résout après le premier `detectChanges` ; les méthodes (create/edit) ne sont appelées que par interaction utilisateur, donc après init. Le spec n'invoque que `deleteBuild` (n'utilise pas le viewChild) → robuste.
- **Note env** : specs non exécutables ici (pas de Chrome) ; `ng build` = barrière.

## Suite

3b : éditeur Timelines (map + sorts, en-tête build/lecture) + dédup du header du dashboard. 3c : Freeplay dédié. 3d : vue « Résultats » + restyle profond des sous-composants hérités.
