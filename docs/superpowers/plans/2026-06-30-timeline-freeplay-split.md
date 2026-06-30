# Split Timeline / Freeplay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Faire de `/timelines` et `/freeplay` deux écrans distincts — chacun avec son en-tête identitaire et uniquement ses propres boutons (contrôles de simulation pour Timeline, barre Freeplay pour Freeplay).

**Architecture :** Deux pages (`TimelinePageComponent`, `FreeplayPageComponent`) remplacent le `WorkspacePageComponent` partagé. Chacune rend un en-tête + `<app-dashboard [mode]>`. Le `mode` (`'timeline' | 'freeplay'`) descend page → dashboard → board, où des `@if` masquent le bloc de boutons non pertinent. Aucune logique de simulation n'est modifiée.

**Tech Stack :** Angular 20.3 (standalone, signals, `input()`), Angular Router, CSS variables, karma/Jasmine.

---

## Pré-requis & contraintes

- **Branche `feat_new-ihm`. Rester dessus. Jamais `main`.** Un commit par tâche. **git depuis la RACINE** `/Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur`.
- `ng test` exige Chrome (absent ici) → **NE PAS lancer karma**. Écrire les specs (TDD) puis vérifier via `cd frontend && npx ng build --configuration development` (attendu : `Application bundle generation complete.`).
- **Acquis** : coquille routée, `ui-icon` (selector `ui-icon`, input `name` ; noms valides incluent `clock` et `play`), tokens `--app-*`. `BoardComponent` (`components/board.component.ts`, selector `app-board`) importe déjà `input` depuis `@angular/core`. `DashboardComponent` (`components/dashboard.component.ts`, selector `app-dashboard`) rend `<app-board>`.

---

## Task A1 : `mode` sur le board + masquage conditionnel des boutons

**Files:**
- Modify: `frontend/src/app/components/board.component.ts`

- [ ] **Step 1 : Ajouter l'input `mode` à la classe `BoardComponent`**

Dans `board.component.ts`, ajouter la propriété d'input dans la classe `BoardComponent` (le symbole `input` est déjà importé ligne 1). Placer cette ligne juste après l'accolade ouvrante de la classe :
```ts
  readonly mode = input<'timeline' | 'freeplay'>('timeline');
```

- [ ] **Step 2 : Encadrer les contrôles de simulation (`.board-controls`) par `@if` timeline**

Dans le template, le bloc `<div class="board-controls"> … </div>` (actuellement lignes 41–82, qui contient « Lancer Toute la Simulation », « Étape Précédente », l'indicateur d'étape, « Étape Suivante », « Fin de tour », « Réinitialiser »). L'envelopper intégralement :
```html
@if (mode() === 'timeline') {
  <div class="board-controls">
    … (contenu existant inchangé) …
  </div>
}
```
(Insérer `@if (mode() === 'timeline') {` juste avant `<div class="board-controls">` et `}` juste après son `</div>` fermant.)

- [ ] **Step 3 : Encadrer la barre Freeplay (`.interactive-bar`) par `@if` freeplay**

Le bloc `<div class="interactive-bar" …> … </div>` (ouvre actuellement ligne 94 ; contient le bouton Freeplay classique, le bouton Freeplay Xel Rouage, le menu Passifs, les boutons « Fin de tour »/« Reset » de session interactive et les `.interactive-resources`). L'envelopper intégralement :
```html
@if (mode() === 'freeplay') {
  <div class="interactive-bar" …>
    … (contenu existant inchangé) …
  </div>
}
```
(Insérer `@if (mode() === 'freeplay') {` juste avant `<div class="interactive-bar"` et `}` juste après le `</div>` qui ferme ce bloc.)

- [ ] **Step 4 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: `Application bundle generation complete.` sans erreur.

> Note : pas de spec unitaire pour le board — il injecte ~8 services (TimelineService, BuildService, BoardService, SimulationService, InteractivePlayService, ResourceRegenerationService, DataCacheService, StatsCalculatorService), ce qui rend un test isolé disproportionné. Le comportement est validé par le build + les specs de pages (A3) + la vérification visuelle finale.

- [ ] **Step 5 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/components/board.component.ts
git commit -m "feat(ui): input mode sur le board, masque les contrôles selon timeline/freeplay"
```

---

## Task A2 : Propager `mode` depuis le dashboard

**Files:**
- Modify: `frontend/src/app/components/dashboard.component.ts`

- [ ] **Step 1 : Importer `input`**

Ligne 6, l'import est :
```ts
import {Component, inject, signal, ViewChild} from '@angular/core';
```
Le remplacer par :
```ts
import {Component, inject, signal, ViewChild, input} from '@angular/core';
```

- [ ] **Step 2 : Ajouter l'input `mode` à la classe `DashboardComponent`**

Ajouter dans la classe `DashboardComponent` (juste après l'accolade ouvrante de la classe) :
```ts
  readonly mode = input<'timeline' | 'freeplay'>('timeline');
```

- [ ] **Step 3 : Passer `mode` au board**

Dans le template, l'élément `<app-board>` (lignes 106–111) :
```html
            <app-board
              (editPlayer)="onEditPlayerFromBoard($event)"
              (editEnemy)="onEditEnemyFromBoard($event)"
              [placementMode]="placementMode()"
              (boardCellClick)="onBoardCellClick($event)"
            ></app-board>
```
Ajouter le binding `[mode]="mode()"` :
```html
            <app-board
              [mode]="mode()"
              (editPlayer)="onEditPlayerFromBoard($event)"
              (editEnemy)="onEditEnemyFromBoard($event)"
              [placementMode]="placementMode()"
              (boardCellClick)="onBoardCellClick($event)"
            ></app-board>
```

- [ ] **Step 4 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: `Application bundle generation complete.`

- [ ] **Step 5 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/components/dashboard.component.ts
git commit -m "feat(ui): propage le mode timeline/freeplay du dashboard au board"
```

---

## Task A3 : Pages Timeline & Freeplay + routes

**Files:**
- Create: `frontend/src/app/pages/timeline-page.component.ts` (+spec)
- Create: `frontend/src/app/pages/freeplay-page.component.ts` (+spec)
- Modify: `frontend/src/app/app.routes.ts`
- Delete: `frontend/src/app/pages/workspace-page.component.ts`

- [ ] **Step 1 : Écrire les specs (qui échouent)**

Créer `frontend/src/app/pages/timeline-page.component.spec.ts` :
```ts
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TimelinePageComponent } from './timeline-page.component';
import { DashboardComponent } from '../components/dashboard.component';

describe('TimelinePageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TimelinePageComponent] });
    // Isole la page : on n'instancie pas le DashboardComponent (DI lourde) ;
    // <app-dashboard> reste un élément inerte dont on lit l'attribut mode.
    TestBed.overrideComponent(TimelinePageComponent, {
      remove: { imports: [DashboardComponent] },
      add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
  });

  it('affiche l en-tête Timeline et le dashboard en mode timeline', () => {
    const fixture = TestBed.createComponent(TimelinePageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Timeline');
    const dash = el.querySelector('app-dashboard');
    expect(dash).toBeTruthy();
    expect(dash?.getAttribute('mode')).toBe('timeline');
  });
});
```

Créer `frontend/src/app/pages/freeplay-page.component.spec.ts` :
```ts
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FreeplayPageComponent } from './freeplay-page.component';
import { DashboardComponent } from '../components/dashboard.component';

describe('FreeplayPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [FreeplayPageComponent] });
    TestBed.overrideComponent(FreeplayPageComponent, {
      remove: { imports: [DashboardComponent] },
      add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
  });

  it('affiche l en-tête Freeplay et le dashboard en mode freeplay', () => {
    const fixture = TestBed.createComponent(FreeplayPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Freeplay');
    const dash = el.querySelector('app-dashboard');
    expect(dash).toBeTruthy();
    expect(dash?.getAttribute('mode')).toBe('freeplay');
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: erreur (`./timeline-page.component` / `./freeplay-page.component` introuvables).

- [ ] **Step 3 : Implémenter les pages**

Créer `frontend/src/app/pages/timeline-page.component.ts` :
```ts
import { Component } from '@angular/core';
import { DashboardComponent } from '../components/dashboard.component';
import { IconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-timeline-page',
  standalone: true,
  imports: [DashboardComponent, IconComponent],
  template: `
    <section class="page-head">
      <span class="page-icon"><ui-icon name="clock"></ui-icon></span>
      <div>
        <h1>Timeline</h1>
        <p>Compose une suite d'actions et déroule la simulation.</p>
      </div>
    </section>
    <app-dashboard mode="timeline"></app-dashboard>
  `,
  styles: [`
    .page-head { display: flex; align-items: center; gap: 14px; max-width: 1100px; margin: 0 auto; padding: 20px 20px 0; color: var(--app-text); }
    .page-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: color-mix(in srgb, var(--app-accent) 14%, transparent); color: var(--app-accent); }
    .page-head h1 { margin: 0; }
    .page-head p { margin: 2px 0 0; color: var(--app-text-muted); font-size: 14px; }
  `],
})
export class TimelinePageComponent {}
```

Créer `frontend/src/app/pages/freeplay-page.component.ts` :
```ts
import { Component } from '@angular/core';
import { DashboardComponent } from '../components/dashboard.component';
import { IconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-freeplay-page',
  standalone: true,
  imports: [DashboardComponent, IconComponent],
  template: `
    <section class="page-head">
      <span class="page-icon"><ui-icon name="play"></ui-icon></span>
      <div>
        <h1>Freeplay</h1>
        <p>Teste librement sur la map, sans timeline.</p>
      </div>
    </section>
    <app-dashboard mode="freeplay"></app-dashboard>
  `,
  styles: [`
    .page-head { display: flex; align-items: center; gap: 14px; max-width: 1100px; margin: 0 auto; padding: 20px 20px 0; color: var(--app-text); }
    .page-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: color-mix(in srgb, var(--app-accent) 14%, transparent); color: var(--app-accent); }
    .page-head h1 { margin: 0; }
    .page-head p { margin: 2px 0 0; color: var(--app-text-muted); font-size: 14px; }
  `],
})
export class FreeplayPageComponent {}
```

- [ ] **Step 4 : Mettre à jour les routes**

Remplacer l'intégralité de `frontend/src/app/app.routes.ts` par :
```ts
import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home.component';
import { TimelinePageComponent } from './pages/timeline-page.component';
import { FreeplayPageComponent } from './pages/freeplay-page.component';
import { ComparaisonPageComponent } from './pages/placeholder-page.component';
import { BuildsListComponent } from './pages/builds-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'accueil', pathMatch: 'full' },
  { path: 'accueil', component: HomeComponent },
  { path: 'builds', component: BuildsListComponent },
  { path: 'timelines', component: TimelinePageComponent },
  { path: 'freeplay', component: FreeplayPageComponent },
  { path: 'comparaison', component: ComparaisonPageComponent },
  { path: '**', redirectTo: 'accueil' },
];
```

- [ ] **Step 5 : Supprimer l'ancienne page partagée**

Run: `rm /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend/src/app/pages/workspace-page.component.ts`
Vérifier qu'aucune référence ne subsiste :
Run: `grep -rn "WorkspacePageComponent\|workspace-page" /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend/src` → attendu : aucune.

- [ ] **Step 6 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: `Application bundle generation complete.`

- [ ] **Step 7 : Vérification manuelle**

`cd frontend && npx ng serve` → `/timelines` montre l'en-tête « Timeline » + uniquement les contrôles de simulation (pas la barre Freeplay) ; `/freeplay` montre l'en-tête « Freeplay » + uniquement la barre Freeplay (pas les boutons Lancer/Étapes/Fin de tour/Réinitialiser).

- [ ] **Step 8 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/pages/timeline-page.component.ts frontend/src/app/pages/timeline-page.component.spec.ts frontend/src/app/pages/freeplay-page.component.ts frontend/src/app/pages/freeplay-page.component.spec.ts frontend/src/app/app.routes.ts frontend/src/app/pages/workspace-page.component.ts
git commit -m "feat(ui): ecrans Timeline et Freeplay distincts (en-tete + routes dediees)"
```

---

## Self-review (effectué)

- **Couverture spec (Partie A)** : en-têtes identitaires (A3) ✓ ; masquage des contrôles par mode (A1) ✓ ; threading page→dashboard→board (A1/A2/A3) ✓ ; accent violet partagé (styles tokenisés, pas de couleur distincte) ✓ ; aucune logique de simulation touchée (uniquement `@if` + `input`) ✓.
- **Placeholders** : aucun ; code complet. Les blocs `.board-controls`/`.interactive-bar` ne sont pas recopiés (on les enveloppe in situ) — instruction d'enveloppement précise via les ancres d'ouverture/fermeture.
- **Cohérence des types** : `mode = input<'timeline' | 'freeplay'>('timeline')` identique sur board et dashboard ; binding statique `mode="timeline"` / `mode="freeplay"` côté pages (input signal de type string-union) ; specs lisent l'attribut DOM `mode`.
- **Risque** : placement exact du `}` fermant de `@if(mode()==='freeplay')` après le `</div>` de `.interactive-bar` — l'implémenteur doit identifier le `</div>` correspondant (le bloc contient des `.interactive-resources` ; le `</div>` à cibler est celui qui ferme `.interactive-bar`, pas un enfant).
```
