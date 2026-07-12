# Éditeur de build plein écran — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Remplacer la modale de création/édition de build par un écran dédié plein écran à deux colonnes (formulaire à gauche, résumé live à droite), accessible depuis l'écran Builds et le menu BUILD du dashboard.

**Architecture :** Un `BuildEditorComponent` routé sur `/builds/nouveau` et `/builds/:id/edition` porte la logique de l'ancien `BuildFormComponent` (mêmes valeurs par défaut, mêmes sélecteurs, même save) dans une mise en page deux colonnes. L'écran Builds et le menu BUILD du dashboard naviguent vers cet éditeur ; `BuildFormComponent` est supprimé.

**Tech Stack :** Angular 20.3 (standalone, signals, `inject()`), Angular Router, `ngModel` (template-driven), CSS variables, karma/Jasmine.

---

## Pré-requis & contraintes

- **Branche `feat_new-ihm`. Rester dessus. Jamais `main`.** Un commit par tâche. **git depuis la RACINE** `/Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur`.
- `ng test` exige Chrome (absent ici) → **NE PAS lancer karma**. Écrire les specs (TDD) puis vérifier via `cd frontend && npx ng build --configuration development` (attendu : `Application bundle generation complete.`).
- **Acquis** : `BuildService` (`allBuilds()`, `getBuildById(id)`, `createBuild(build)`, `updateBuild(id, partial)`), sélecteurs `app-spell-selector` / `app-passive-selector` / `app-sublimation-selector` (bindings ci-dessous), `removeInnateSpellsFromSelection(classId, spells)` dans `utils/innate-spells.utils`, `UiButtonComponent` (`<button ui-button variant="…">`), tokens `--app-*`.
- Bindings des sélecteurs (identiques à l'ancien build-form) :
  - `<app-spell-selector [classId] [selectedSpells] (spellsChange)>`
  - `<app-passive-selector [classId] [characterLevel] [selectedPassives] (passivesChange)>`
  - `<app-sublimation-selector [selectedSublimations] (sublimationsChange)>`

---

## Task B1 : `BuildEditorComponent` + routes

**Files:**
- Create: `frontend/src/app/pages/build-editor.component.ts`
- Test: `frontend/src/app/pages/build-editor.component.spec.ts`
- Modify: `frontend/src/app/app.routes.ts`

- [ ] **Step 1 : Écrire la spec (qui échoue)**

Créer `frontend/src/app/pages/build-editor.component.spec.ts` :
```ts
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { BuildEditorComponent } from './build-editor.component';
import { BuildService } from '../services/build.service';
import { SpellSelectorComponent } from '../components/spell-selector.component';
import { PassiveSelectorComponent } from '../components/passive-selector.component';
import { SublimationSelectorComponent } from '../components/sublimation-selector.component';
import { Build } from '../models/build.model';

function makeBuild(id: string, name: string): Build {
  return {
    id, name, classId: 'XEL', characterLevel: 230,
    spellBar: { spells: [] }, passiveBar: { passives: [] }, sublimationBar: { sublimations: [] },
    stats: {
      level: 230, masteryFire: 100, masteryWater: 0, masteryEarth: 0, masteryAir: 0,
      masterySecondary: 0, backMastery: 0, dommageInflict: 0, critRate: 0, critMastery: 0,
      resistance: 0, ap: 12, mp: 4, wp: 6, range: 3,
    },
  };
}

class StubBuildService {
  getBuildById = jasmine.createSpy('getBuildById').and.returnValue(undefined);
  createBuild = jasmine.createSpy('createBuild');
  updateBuild = jasmine.createSpy('updateBuild');
}

let stub: StubBuildService;

function configure(idParam: string | null): void {
  stub = new StubBuildService();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BuildEditorComponent],
    providers: [
      provideRouter([]),
      { provide: BuildService, useValue: stub },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (_: string) => idParam } } } },
    ],
  });
  // Sélecteurs lourds (DataCacheService/HttpClient) retirés de la compilation : éléments inertes.
  TestBed.overrideComponent(BuildEditorComponent, {
    remove: { imports: [SpellSelectorComponent, PassiveSelectorComponent, SublimationSelectorComponent] },
    add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
  });
}

describe('BuildEditorComponent', () => {
  it('mode création : formulaire vierge, save appelle createBuild', () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    expect(stub.getBuildById).not.toHaveBeenCalled();
    const cmp = fixture.componentInstance;
    cmp.form.name = 'Nouveau';
    cmp.form.classId = 'XEL';
    cmp.save();
    expect(stub.createBuild).toHaveBeenCalled();
    expect(stub.updateBuild).not.toHaveBeenCalled();
    const arg = stub.createBuild.calls.mostRecent().args[0];
    expect(arg.name).toBe('Nouveau');
    expect(arg.classId).toBe('XEL');
  });

  it('mode édition : précharge le build et save appelle updateBuild', () => {
    configure('b1');
    stub.getBuildById.and.returnValue(makeBuild('b1', 'Rouage'));
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    expect(cmp.form.name).toBe('Rouage');
    cmp.save();
    expect(stub.updateBuild).toHaveBeenCalled();
    expect(stub.updateBuild.calls.mostRecent().args[0]).toBe('b1');
    expect(stub.createBuild).not.toHaveBeenCalled();
  });

  it('annuler revient en arrière sans sauvegarder', () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    const loc = TestBed.inject(Location);
    const backSpy = spyOn(loc, 'back');
    fixture.detectChanges();
    fixture.componentInstance.cancel();
    expect(backSpy).toHaveBeenCalled();
    expect(stub.createBuild).not.toHaveBeenCalled();
    expect(stub.updateBuild).not.toHaveBeenCalled();
  });

  it('save sans nom/classe n appelle ni create ni update', () => {
    configure(null);
    spyOn(window, 'alert');
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    fixture.componentInstance.save();
    expect(stub.createBuild).not.toHaveBeenCalled();
    expect(stub.updateBuild).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: erreur (`./build-editor.component` introuvable).

- [ ] **Step 3 : Implémenter le composant**

Créer `frontend/src/app/pages/build-editor.component.ts` :
```ts
import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BuildService } from '../services/build.service';
import { Build, BuildStats, SpellReference, PassiveReference, Sublimation } from '../models/build.model';
import { SpellSelectorComponent } from '../components/spell-selector.component';
import { PassiveSelectorComponent } from '../components/passive-selector.component';
import { SublimationSelectorComponent } from '../components/sublimation-selector.component';
import { UiButtonComponent } from '../ui/ui-button.component';
import { removeInnateSpellsFromSelection } from '../utils/innate-spells.utils';

interface FormBuild {
  name: string;
  classId: string;
  characterLevel: number;
  description: string;
  stats: BuildStats;
  spells: (SpellReference | null)[];
  passives: (PassiveReference | null)[];
  sublimations: (Sublimation | null)[];
}

const CLASS_OPTIONS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'XEL', name: 'Xélor' },
  { id: 'sacrier', name: 'Sacrier' },
  { id: 'osamodas', name: 'Osamodas' },
  { id: 'ecaflip', name: 'Écaflip' },
  { id: 'enutrof', name: 'Enutrof' },
];
const LEVELS: ReadonlyArray<number> = [20, 35, 50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 245];

function emptyForm(): FormBuild {
  return {
    name: '', classId: '', characterLevel: 185, description: '',
    stats: {
      level: 185, masteryFire: 0, masteryWater: 0, masteryEarth: 0, masteryAir: 0,
      masterySecondary: 0, backMastery: 0, dommageInflict: 0, critRate: 0, critMastery: 0,
      resistance: 0, ap: 12, mp: 3, wp: 0, range: 3,
    },
    spells: new Array(12).fill(null),
    passives: new Array(6).fill(null),
    sublimations: new Array(12).fill(null),
  };
}

@Component({
  selector: 'app-build-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, SpellSelectorComponent, PassiveSelectorComponent, SublimationSelectorComponent, UiButtonComponent],
  template: `
    <div class="editor">
      <header class="editor-head">
        <h1>{{ editingId ? 'Modifier le build' : 'Nouveau build' }}</h1>
      </header>

      <div class="editor-grid">
        <div class="editor-form">
          <section class="card">
            <h2>Identité</h2>
            <div class="field">
              <label>Nom *</label>
              <input type="text" [(ngModel)]="form.name" name="name" placeholder="ex: Xélor — Rouage Cycle" />
            </div>
            <div class="field">
              <label>Classe *</label>
              <select [(ngModel)]="form.classId" name="classId">
                <option value="">— Sélectionner —</option>
                @for (c of classOptions; track c.id) { <option [value]="c.id">{{ c.name }}</option> }
              </select>
            </div>
            <div class="field">
              <label>Niveau</label>
              <select [(ngModel)]="form.characterLevel" name="level">
                @for (l of levels; track l) { <option [ngValue]="l">{{ l }}</option> }
              </select>
            </div>
            <div class="field">
              <label>Description</label>
              <textarea [(ngModel)]="form.description" name="description" rows="2" placeholder="Notes sur le build…"></textarea>
            </div>
          </section>

          <section class="card">
            <h2>Sorts</h2>
            <app-spell-selector
              [classId]="form.classId"
              [selectedSpells]="form.spells"
              (spellsChange)="onSpellsChange($event)"
            ></app-spell-selector>
          </section>

          <section class="card">
            <h2>Passifs</h2>
            <app-passive-selector
              [classId]="form.classId"
              [characterLevel]="form.characterLevel"
              [selectedPassives]="form.passives"
              (passivesChange)="onPassivesChange($event)"
            ></app-passive-selector>
          </section>

          <section class="card">
            <h2>Sublimations</h2>
            <app-sublimation-selector
              [selectedSublimations]="form.sublimations"
              (sublimationsChange)="onSublimationsChange($event)"
            ></app-sublimation-selector>
          </section>

          <section class="card">
            <h2>Stats</h2>
            <h3>Maîtrises élémentaires</h3>
            <div class="stat-grid">
              <div class="field"><label>Feu</label><input type="number" [(ngModel)]="form.stats.masteryFire" name="mFire" /></div>
              <div class="field"><label>Eau</label><input type="number" [(ngModel)]="form.stats.masteryWater" name="mWater" /></div>
              <div class="field"><label>Terre</label><input type="number" [(ngModel)]="form.stats.masteryEarth" name="mEarth" /></div>
              <div class="field"><label>Air</label><input type="number" [(ngModel)]="form.stats.masteryAir" name="mAir" /></div>
            </div>
            <h3>Offensif</h3>
            <div class="stat-grid">
              <div class="field"><label>Dégâts infligés</label><input type="number" [(ngModel)]="form.stats.dommageInflict" name="dmg" /></div>
              <div class="field"><label>Taux critique (%)</label><input type="number" [(ngModel)]="form.stats.critRate" name="crit" /></div>
              <div class="field"><label>Maîtrise critique</label><input type="number" [(ngModel)]="form.stats.critMastery" name="critM" /></div>
              <div class="field"><label>Maîtrise secondaire</label><input type="number" [(ngModel)]="form.stats.masterySecondary" name="mSec" /></div>
              <div class="field"><label>Maîtrise dos</label><input type="number" [(ngModel)]="form.stats.backMastery" name="mBack" /></div>
            </div>
            <h3>Défense</h3>
            <div class="stat-grid">
              <div class="field"><label>Résistance</label><input type="number" [(ngModel)]="form.stats.resistance" name="res" /></div>
            </div>
            <h3>Ressources & portée</h3>
            <div class="stat-grid">
              <div class="field"><label>PA</label><input type="number" [(ngModel)]="form.stats.ap" name="ap" /></div>
              <div class="field"><label>PM</label><input type="number" [(ngModel)]="form.stats.mp" name="mp" /></div>
              <div class="field"><label>PW</label><input type="number" [(ngModel)]="form.stats.wp" name="wp" /></div>
              <div class="field"><label>Portée</label><input type="number" [(ngModel)]="form.stats.range" name="range" /></div>
            </div>
          </section>
        </div>

        <aside class="editor-summary">
          <div class="summary-card">
            <h2>Résumé</h2>
            <div class="sum-name">{{ form.name || 'Sans nom' }}</div>
            <div class="sum-meta">{{ classLabel() }} · niveau {{ form.characterLevel }}</div>
            <div class="sum-res">
              <span>{{ form.stats.ap }} PA</span>
              <span>{{ form.stats.mp }} PM</span>
              <span>{{ form.stats.wp }} PW</span>
            </div>
            <div class="sum-mast">
              <span>Feu {{ form.stats.masteryFire }}</span>
              <span>Eau {{ form.stats.masteryWater }}</span>
              <span>Terre {{ form.stats.masteryEarth }}</span>
              <span>Air {{ form.stats.masteryAir }}</span>
            </div>
            <div class="sum-actions">
              <button ui-button variant="primary" (click)="save()">Enregistrer</button>
              <button ui-button variant="ghost" (click)="cancel()">Annuler</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .editor { max-width: 1200px; margin: 0 auto; padding: 20px; color: var(--app-text); }
    .editor-head h1 { margin: 0 0 16px; }
    .editor-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 18px; align-items: start; }
    .editor-form { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .card { background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 12px; padding: 16px; }
    .card h2 { margin: 0 0 12px; font-size: 16px; }
    .card h3 { margin: 14px 0 8px; font-size: 13px; color: var(--app-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    .field label { font-size: 13px; color: var(--app-text-muted); }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
    .stat-grid .field { margin-bottom: 0; }
    .editor-summary { position: sticky; top: 16px; }
    .summary-card { background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .summary-card h2 { margin: 0; font-size: 14px; color: var(--app-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .sum-name { font-weight: 600; font-size: 18px; }
    .sum-meta { color: var(--app-text-muted); font-size: 13px; }
    .sum-res { display: flex; gap: 12px; font-size: 14px; margin-top: 4px; }
    .sum-mast { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--app-text-muted); }
    .sum-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    @media (max-width: 860px) { .editor-grid { grid-template-columns: 1fr; } .editor-summary { position: static; } }
  `],
})
export class BuildEditorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly buildService = inject(BuildService);

  protected readonly classOptions = CLASS_OPTIONS;
  protected readonly levels = LEVELS;
  protected editingId: string | null = null;
  protected form: FormBuild = emptyForm();

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const build = this.buildService.getBuildById(id);
      if (!build) { this.router.navigate(['/builds']); return; }
      this.editingId = id;
      this.form = {
        name: build.name,
        classId: build.classId,
        characterLevel: build.characterLevel,
        description: build.description || '',
        stats: { ...build.stats },
        spells: removeInnateSpellsFromSelection(build.classId, [...build.spellBar.spells]),
        passives: [...build.passiveBar.passives],
        sublimations: [...build.sublimationBar.sublimations],
      };
    }
  }

  classLabel(): string {
    return this.classOptions.find(c => c.id === this.form.classId)?.name ?? '—';
  }

  onSpellsChange(spells: (SpellReference | null)[]): void { this.form.spells = spells; }
  onPassivesChange(passives: (PassiveReference | null)[]): void { this.form.passives = passives; }
  onSublimationsChange(subs: (Sublimation | null)[]): void { this.form.sublimations = subs; }

  save(): void {
    if (!this.form.name || !this.form.classId) {
      alert('Veuillez remplir les champs obligatoires (nom, classe).');
      return;
    }
    const sanitizedSpells = removeInnateSpellsFromSelection(this.form.classId, this.form.spells);
    if (this.editingId) {
      this.buildService.updateBuild(this.editingId, {
        name: this.form.name,
        classId: this.form.classId,
        characterLevel: this.form.characterLevel,
        description: this.form.description,
        spellBar: { spells: sanitizedSpells },
        passiveBar: { passives: this.form.passives },
        sublimationBar: { sublimations: this.form.sublimations },
        stats: this.form.stats,
      });
    } else {
      const newBuild: Build = {
        id: `build_${Date.now()}`,
        name: this.form.name,
        classId: this.form.classId,
        characterLevel: this.form.characterLevel,
        description: this.form.description,
        spellBar: { spells: sanitizedSpells },
        passiveBar: { passives: this.form.passives },
        sublimationBar: { sublimations: this.form.sublimations },
        stats: this.form.stats,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.buildService.createBuild(newBuild);
    }
    this.location.back();
  }

  cancel(): void {
    this.location.back();
  }
}
```

- [ ] **Step 4 : Ajouter les routes**

Dans `frontend/src/app/app.routes.ts`, ajouter l'import :
```ts
import { BuildEditorComponent } from './pages/build-editor.component';
```
puis insérer les deux routes **juste après** la route `{ path: 'builds', component: BuildsListComponent }` :
```ts
  { path: 'builds/nouveau', component: BuildEditorComponent },
  { path: 'builds/:id/edition', component: BuildEditorComponent },
```

- [ ] **Step 5 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: `Application bundle generation complete.`

- [ ] **Step 6 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/pages/build-editor.component.ts frontend/src/app/pages/build-editor.component.spec.ts frontend/src/app/app.routes.ts
git commit -m "feat(ui): editeur de build plein ecran (deux colonnes + resume live)"
```

---

## Task B2 : L'écran Builds navigue vers l'éditeur

**Files:**
- Modify: `frontend/src/app/pages/builds-list.component.ts`
- Modify: `frontend/src/app/pages/builds-list.component.spec.ts`

- [ ] **Step 1 : Mettre à jour la spec (navigation au lieu du formulaire)**

Dans `builds-list.component.spec.ts` :
- Retirer l'import `import { BuildFormComponent } from '../components/build-form.component';`.
- Retirer la ligne `TestBed.overrideComponent(BuildFormComponent, { set: { template: '', imports: [] } });` du `beforeEach`.
- Remplacer le test `it('ouvre le formulaire en creation', …)` par :
```ts
  it('navigue vers l editeur en creation', () => {
    const fixture = TestBed.createComponent(BuildsListComponent);
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'navigate');
    fixture.detectChanges();
    fixture.componentInstance.createBuild();
    expect(nav).toHaveBeenCalledWith(['/builds/nouveau']);
  });
```
- Remplacer le test `it('ouvre le formulaire en edition avec le build cible', …)` par :
```ts
  it('navigue vers l editeur en edition avec l id du build', () => {
    const fixture = TestBed.createComponent(BuildsListComponent);
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'navigate');
    fixture.detectChanges();
    fixture.componentInstance.editBuild(stub.allBuilds()[1]);
    expect(nav).toHaveBeenCalledWith(['/builds', 'b2', 'edition']);
  });
```
(`Router` est déjà importé dans ce spec.)

- [ ] **Step 2 : Modifier le composant**

Dans `builds-list.component.ts` :
- Retirer l'import `import { BuildFormComponent } from '../components/build-form.component';`.
- Retirer `BuildFormComponent` du tableau `imports: [...]` du décorateur.
- Retirer la ligne `private readonly buildForm = viewChild.required(BuildFormComponent);` et l'import `viewChild` s'il n'est plus utilisé ailleurs (vérifier ; sinon le laisser).
- Retirer `<app-build-form #buildForm></app-build-form>` du template.
- Remplacer les méthodes :
```ts
  createBuild(): void {
    this.router.navigate(['/builds/nouveau']);
  }

  editBuild(build: Build): void {
    this.router.navigate(['/builds', build.id, 'edition']);
  }
```
(`Router` est déjà injecté dans ce composant — utilisé par `selectBuild`.)

- [ ] **Step 3 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: `Application bundle generation complete.`

- [ ] **Step 4 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/pages/builds-list.component.ts frontend/src/app/pages/builds-list.component.spec.ts
git commit -m "feat(ui): l ecran Builds navigue vers l editeur (au lieu de la modale)"
```

---

## Task B3 : Menu BUILD du dashboard → éditeur, et suppression de la modale

**Files:**
- Modify: `frontend/src/app/components/dashboard.component.ts`
- Delete: `frontend/src/app/components/build-form.component.ts`

- [ ] **Step 1 : Injecter `Router` dans le dashboard**

Dans `dashboard.component.ts`, ajouter en haut l'import :
```ts
import { Router } from '@angular/router';
```
Puis, dans la classe `DashboardComponent`, ajouter (avec les autres `inject(...)`) :
```ts
  private readonly router = inject(Router);
```

- [ ] **Step 2 : Rediriger les handlers vers l'éditeur**

Remplacer `onCreateBuild()` (≈ lignes 1109–1111) :
```ts
  onCreateBuild(): void {
    this.router.navigate(['/builds/nouveau']);
  }
```
Remplacer `onEditBuild(...)` (≈ lignes 1113–1116) en conservant l'éventuel `event.stopPropagation()` mais en remplaçant l'appel `this.buildForm.openEdit(build)` :
```ts
  onEditBuild(event: any, build: any): void {
    event?.stopPropagation?.();
    this.router.navigate(['/builds', build.id, 'edition']);
  }
```

- [ ] **Step 3 : Retirer la modale build-form du dashboard**

- Supprimer la ligne du template `<app-build-form #buildForm></app-build-form>` (≈ ligne 141).
- Supprimer la propriété `@ViewChild('buildForm') buildForm!: BuildFormComponent;` (≈ ligne 1104).
- Supprimer l'import `import {BuildFormComponent} from './build-form.component';` (ligne 12).
- Retirer `BuildFormComponent` du tableau `imports: [...]` du décorateur (ligne 25).
- Si `ViewChild` n'est plus utilisé (le dashboard garde `timelineForm`, `playerForm`, `enemyForm` en ViewChild → il l'est encore), **laisser** l'import `ViewChild`.

- [ ] **Step 4 : Supprimer le composant build-form (plus aucune référence)**

Run: `grep -rn "BuildFormComponent\|build-form" /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend/src` → attendu : aucune.
Puis: `rm /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend/src/app/components/build-form.component.ts`
(Il n'existe pas de `build-form.component.spec.ts`.)

- [ ] **Step 5 : Vérifier le build**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: `Application bundle generation complete.`

- [ ] **Step 6 : Vérification manuelle**

`cd frontend && npx ng serve` → depuis `/builds`, « Nouveau build » ouvre l'éditeur plein écran ; « Modifier » sur une carte ouvre l'éditeur prérempli ; Enregistrer revient à `/builds` avec le build créé/modifié ; Annuler revient sans changement. Depuis l'espace de travail, le menu BUILD « ➕ Nouveau Build » / « ✏️ » mène aussi à l'éditeur.

- [ ] **Step 7 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/components/dashboard.component.ts frontend/src/app/components/build-form.component.ts
git commit -m "feat(ui): menu BUILD du dashboard vers l editeur + suppression de la modale build-form"
```

---

## Self-review (effectué)

- **Couverture spec (Partie B)** : éditeur plein écran deux colonnes + résumé live (B1) ✓ ; routes `/builds/nouveau` + `/builds/:id/edition` (B1) ✓ ; stats regroupées en 4 sections (B1) ✓ ; écran Builds navigue (B2) ✓ ; menu BUILD du dashboard navigue + modale supprimée (B3) ✓ ; logique de save portée fidèlement (mêmes defaults niv 185, `removeInnateSpellsFromSelection`, id `build_${Date.now()}`) ✓.
- **Placeholders** : aucun ; composant complet. B2/B3 sont des éditions précises (old→new) sur des fichiers connus.
- **Cohérence des types** : `FormBuild` identique à l'ancien build-form ; bindings sélecteurs identiques ; `editingId: string | null` ; routes `['/builds/nouveau']` / `['/builds', id, 'edition']` cohérentes entre éditeur, builds-list et dashboard.
- **Résumé live** : `form` est un objet simple muté par `ngModel` ; la détection de changement (zone) re-lit `form.*` à chaque cycle → le résumé se met à jour. (Pas de signal nécessaire ; même modèle que l'ancien build-form.)
- **Retour** : `Location.back()` ramène à l'écran d'origine (Builds ou espace de travail), conforme à la décision « retour à l'écran précédent ». Repli implicite : si pas d'historique, `back()` ne fait rien (cas limite acceptable).
- **Risque** : le `[ngValue]="l"` sur le select de niveau préserve le type `number` (amélioration vs l'ancien `[value]`). Les sélecteurs lourds sont neutralisés dans la spec via `CUSTOM_ELEMENTS_SCHEMA` (pas d'instanciation → pas de dépendance HttpClient).
