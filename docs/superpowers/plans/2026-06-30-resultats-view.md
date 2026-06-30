# Vue Résultats dédiée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Déplacer les résumés de simulation (dégâts + timeline) du dashboard vers un écran dédié `/resultats`, ajouté à la navigation.

**Architecture :** Un `ResultatsPageComponent` routé sur `/resultats` héberge un en-tête identitaire + les composants autonomes `<app-damage-summary>` et `<app-timeline-summary>` (qui tirent leurs données des services). On ajoute « Résultats » à la sidebar et à l'accueil, et on retire les deux résumés du dashboard.

**Tech Stack :** Angular 20.3 (standalone, signals, `input()`), Angular Router, CSS variables, karma/Jasmine.

---

## Pré-requis & contraintes

- **Branche `feat_new-ihm`. Rester dessus. Jamais `main`.** Un commit par tâche. **git depuis la RACINE** `/Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur`.
- `ng test` exige Chrome (absent ici) → **NE PAS lancer karma**. Specs en TDD, vérification via `cd frontend && npx ng build --configuration development` (attendu : `Application bundle generation complete.`). Pour les fichiers de spec, `ng build` ne les compile pas → vérifier en plus avec `npx tsc --noEmit -p tsconfig.spec.json`.
- **Acquis** : `DamageSummaryComponent` (`components/damage-summary.component.ts`, selector `app-damage-summary`, autonome) ; `TimelineSummaryComponent` (`components/timeline-summary.component.ts`, selector `app-timeline-summary`, autonome) ; `IconComponent` (`ui/icon.component.ts`, jeu d'icônes dans `ICON_PATHS`) ; sidebar `NAV_ITEMS` et accueil `links` (tableaux de nav) ; tokens `--app-*`.

---

## Task R1 : Icône `activity` + `ResultatsPageComponent` + route

**Files:**
- Modify: `frontend/src/app/ui/icon.component.ts`
- Create: `frontend/src/app/pages/resultats-page.component.ts` (+spec)
- Modify: `frontend/src/app/app.routes.ts`

- [ ] **Step 1 : Ajouter l'icône `activity`**

Dans `frontend/src/app/ui/icon.component.ts`, dans l'objet `ICON_PATHS`, ajouter cette entrée (après `menu`) :
```ts
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
```
(le `Record<string, string>` se termine par `menu: '…',` → ajouter la ligne `activity: '…',` à la suite, avant l'accolade fermante.)

- [ ] **Step 2 : Écrire la spec (qui échoue)**

Créer `frontend/src/app/pages/resultats-page.component.spec.ts` :
```ts
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ResultatsPageComponent } from './resultats-page.component';
import { DamageSummaryComponent } from '../components/damage-summary.component';
import { TimelineSummaryComponent } from '../components/timeline-summary.component';

describe('ResultatsPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ResultatsPageComponent] });
    // Les résumés injectent DataCacheService/HttpClient : on les retire de la
    // compilation de la page → éléments inertes dont on vérifie la présence.
    TestBed.overrideComponent(ResultatsPageComponent, {
      remove: { imports: [DamageSummaryComponent, TimelineSummaryComponent] },
      add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
  });

  it('affiche l en-tête Résultats et les deux résumés', () => {
    const fixture = TestBed.createComponent(ResultatsPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Résultats');
    expect(el.querySelector('app-damage-summary')).toBeTruthy();
    expect(el.querySelector('app-timeline-summary')).toBeTruthy();
  });
});
```

- [ ] **Step 3 : Vérifier l'échec**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx tsc --noEmit -p tsconfig.spec.json`
Expected: erreur (`./resultats-page.component` introuvable).

- [ ] **Step 4 : Implémenter la page**

Créer `frontend/src/app/pages/resultats-page.component.ts` :
```ts
import { Component } from '@angular/core';
import { DamageSummaryComponent } from '../components/damage-summary.component';
import { TimelineSummaryComponent } from '../components/timeline-summary.component';
import { IconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-resultats-page',
  standalone: true,
  imports: [DamageSummaryComponent, TimelineSummaryComponent, IconComponent],
  template: `
    <section class="page-head">
      <span class="page-icon"><ui-icon name="activity"></ui-icon></span>
      <div>
        <h1>Résultats</h1>
        <p>Les dégâts et le déroulé de ta dernière simulation.</p>
      </div>
    </section>
    <div class="resultats">
      <app-damage-summary></app-damage-summary>
      <app-timeline-summary></app-timeline-summary>
    </div>
  `,
  styles: [`
    .page-head { display: flex; align-items: center; gap: 14px; max-width: 1100px; margin: 0 auto; padding: 20px 20px 0; color: var(--app-text); }
    .page-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: color-mix(in srgb, var(--app-accent) 14%, transparent); color: var(--app-accent); }
    .page-head h1 { margin: 0; }
    .page-head p { margin: 2px 0 0; color: var(--app-text-muted); font-size: 14px; }
    .resultats { max-width: 1100px; margin: 0 auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }
  `],
})
export class ResultatsPageComponent {}
```

- [ ] **Step 5 : Ajouter la route**

Dans `frontend/src/app/app.routes.ts`, ajouter l'import :
```ts
import { ResultatsPageComponent } from './pages/resultats-page.component';
```
puis insérer la route **juste après** `{ path: 'freeplay', component: FreeplayPageComponent },` :
```ts
  { path: 'resultats', component: ResultatsPageComponent },
```

- [ ] **Step 6 : Vérifier build + spec**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: `Application bundle generation complete.`
Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx tsc --noEmit -p tsconfig.spec.json`
Expected: aucune erreur.

- [ ] **Step 7 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/ui/icon.component.ts frontend/src/app/pages/resultats-page.component.ts frontend/src/app/pages/resultats-page.component.spec.ts frontend/src/app/app.routes.ts
git commit -m "feat(ui): ecran Resultats (/resultats) hebergeant les resumes degats + timeline"
```

---

## Task R2 : Nav (sidebar + accueil) + retrait des résumés du dashboard

**Files:**
- Modify: `frontend/src/app/ui/app-sidebar.component.ts`
- Modify: `frontend/src/app/ui/app-sidebar.component.spec.ts`
- Modify: `frontend/src/app/pages/home.component.ts`
- Modify: `frontend/src/app/pages/home.component.spec.ts`
- Modify: `frontend/src/app/components/dashboard.component.ts`

- [ ] **Step 1 : Mettre à jour les specs (qui échouent)**

Dans `frontend/src/app/ui/app-sidebar.component.spec.ts`, remplacer le corps du test `it('rend un lien de navigation par section', …)` par :
```ts
    const fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll('a.nav-item');
    expect(links.length).toBe(6);
    expect(fixture.nativeElement.textContent).toContain('Accueil');
    expect(fixture.nativeElement.textContent).toContain('Résultats');
    expect(fixture.nativeElement.textContent).toContain('Comparaison');
```

Dans `frontend/src/app/pages/home.component.spec.ts`, changer l'assertion :
```ts
    expect(cards.length).toBe(5);
```

- [ ] **Step 2 : Ajouter « Résultats » à la sidebar**

Dans `frontend/src/app/ui/app-sidebar.component.ts`, dans le tableau `NAV_ITEMS`, insérer entre la ligne Freeplay et la ligne Comparaison :
```ts
  { path: '/resultats', label: 'Résultats', icon: 'activity' },
```
(Le tableau devient : Accueil, Builds, Timelines, Freeplay, **Résultats**, Comparaison.)

- [ ] **Step 3 : Ajouter la carte « Résultats » à l'accueil**

Dans `frontend/src/app/pages/home.component.ts`, dans le tableau `links`, insérer entre la ligne Freeplay et la ligne Comparaison :
```ts
    { path: '/resultats', label: 'Résultats', icon: 'activity', desc: 'Voir les dégâts et le déroulé' },
```

- [ ] **Step 4 : Retirer les deux résumés du dashboard**

Dans `frontend/src/app/components/dashboard.component.ts` :
- Supprimer le bloc du template qui héberge le résumé des dégâts :
```html
        <aside class="panel">
          <app-damage-summary></app-damage-summary>
        </aside>
```
- Supprimer le bloc du template qui héberge le résumé de timeline :
```html
          <!-- Timeline Summary -->
          <section class="section timeline-summary-section">
            <app-timeline-summary></app-timeline-summary>
          </section>
```
- Supprimer les deux imports :
```ts
import {TimelineSummaryComponent} from './timeline-summary.component';
import {DamageSummaryComponent} from './damage-summary.component';
```
- Retirer `TimelineSummaryComponent` et `DamageSummaryComponent` du tableau `imports: [...]` du décorateur `@Component` (conserver toutes les autres entrées).

(Si la suppression de l'`<aside class="panel">` laisse un conteneur de layout vide ou déséquilibré, ne pas y toucher davantage : le `<main class="content">` restant occupe l'espace ; vérifier visuellement à l'étape 6.)

- [ ] **Step 5 : Vérifier qu'aucune référence aux résumés ne subsiste dans le dashboard**

Run: `grep -nE "app-damage-summary|app-timeline-summary|DamageSummaryComponent|TimelineSummaryComponent" /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend/src/app/components/dashboard.component.ts`
Expected : aucune correspondance. (Les composants eux-mêmes restent utilisés par `ResultatsPageComponent`.)

- [ ] **Step 6 : Vérifier build + spec + manuel**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: `Application bundle generation complete.`
Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx tsc --noEmit -p tsconfig.spec.json`
Expected: aucune erreur.
Manuel (`npx ng serve`) : la sidebar montre « Résultats » entre Freeplay et Comparaison ; `/resultats` affiche les deux résumés ; `/timelines` et `/freeplay` ne montrent plus les résumés (board + sélecteurs seulement) ; l'accueil a une carte « Résultats ».

- [ ] **Step 7 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/ui/app-sidebar.component.ts frontend/src/app/ui/app-sidebar.component.spec.ts frontend/src/app/pages/home.component.ts frontend/src/app/pages/home.component.spec.ts frontend/src/app/components/dashboard.component.ts
git commit -m "feat(ui): Resultats dans la nav (sidebar + accueil) et retire les resumes du dashboard"
```

---

## Self-review (effectué)

- **Couverture spec** : route `/resultats` + page (R1) ✓ ; item sidebar « Résultats » après Freeplay (R2) ✓ ; carte accueil (R2) ✓ ; retrait des deux résumés du dashboard (R2) ✓ ; composants réutilisés tels quels (autonomes) ✓.
- **Écart assumé vs spec** : l'icône de Résultats est `activity` (et non `chart`) car `chart` est déjà utilisée par Comparaison — éviter le doublon. Ajout de `activity` à `ICON_PATHS` (R1, step 1).
- **Placeholders** : aucun ; code complet. Les blocs à retirer du dashboard sont donnés littéralement.
- **Cohérence des types** : item nav `{ path, label, icon }` conforme à `NavItem` ; carte accueil `{ path, label, icon, desc }` conforme à `HomeLink` ; route placée après `freeplay` (cohérent avec l'ordre sidebar) ; specs : sidebar 5→6, accueil 4→5.
- **Risque** : suppression de l'`<aside class="panel">` du dashboard — si le layout `.dashboard` supposait deux colonnes, le `<main>` restant prend toute la largeur (acceptable) ; vérification visuelle prévue (R2 step 6).
```
