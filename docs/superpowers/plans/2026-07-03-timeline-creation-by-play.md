# Création de timeline en jouant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Créer des timelines en jouant (le Freeplay/interactif enregistre la séquence d'actions, un bouton « Sauvegarder en timeline » la fige), et supprimer le formulaire de création.

**Architecture :** `InteractivePlayService` accumule chaque `TimelineStep` joué dans un signal `recordedSteps`. Un nouveau `TimelineRecorderComponent` (affiché en mode freeplay) montre la séquence et propose « Sauvegarder en timeline » (→ `TimelineService.createTimeline`) et « Nouvelle timeline ». Le `TimelineFormComponent` est supprimé ; le sélecteur de timeline garde renommer/supprimer.

**Tech Stack :** Angular 20.3 (standalone, signals, `inject()`), karma/Jasmine, CSS variables.

---

## Pré-requis & contraintes

- **Branche `feat_new-ihm`. Rester dessus. Jamais `main`.** Un commit par tâche. **git depuis la RACINE** `/Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur`.
- `ng test` exige Chrome (absent) → **NE PAS lancer karma**. Écrire les specs (TDD), puis vérifier via `cd frontend && npx ng build --configuration development` et `npx tsc --noEmit -p tsconfig.spec.json` (pour les specs, que `ng build` ne compile pas).
- **Acquis** : modèle `Timeline`/`TimelineStep`/`TimelineAction`/`TimelineBoardEntitySetup` (`models/timeline.model.ts`), `BoardEntity` (`models/board.model.ts` : `{id, type:'player'|'enemy', name, classId?, position, facing, icon?}`), `TimelineService` (`createTimeline(t)`, `updateTimeline(id, partial)`, `allTimelines()`), `BoardService` (`players()`, `enemies()` computed de `BoardEntity[]`), `UiButtonComponent` (`<button ui-button variant="primary|ghost|danger">`).

---

## Task 1 : Enregistrement des actions dans `InteractivePlayService`

**Files:**
- Modify: `frontend/src/app/services/interactive-play.service.ts`
- Test: `frontend/src/app/services/interactive-play.service.spec.ts` (existe déjà — y ajouter le describe ci-dessous)

- [ ] **Step 1 : Écrire le test (qui échoue)**

Ajouter ce bloc dans `interactive-play.service.spec.ts` (créer le fichier avec ce contenu s'il n'existe pas ; s'il existe, ajouter le `describe` sans casser l'existant) :
```ts
import { TestBed } from '@angular/core/testing';
import { InteractivePlayService } from './interactive-play.service';
import { SimulationEngineService } from './calculators/simulation-engine.service';
import { SimulationService } from './simulation.service';
import { StatsCalculatorService } from './calculators/stats-calculator.service';
import { BoardService } from './board.service';

describe('InteractivePlayService — enregistrement', () => {
  let service: InteractivePlayService;

  beforeEach(() => {
    const engine = {
      executeSingleStep: jasmine.createSpy('executeSingleStep').and.returnValue(
        Promise.resolve({ success: true, contextAfter: { playerPosition: { x: 3, y: 4 }, mechanisms: [] }, actions: [] })
      ),
    };
    const simSvc = {
      appendInteractiveStep: jasmine.createSpy('appendInteractiveStep'),
      clearInteractiveSteps: jasmine.createSpy('clearInteractiveSteps'),
    };
    const stats = { calculateTotalStats: jasmine.createSpy('calc').and.returnValue({ ap: 12, mp: 3, wp: 6 }) };
    const board = {
      player: () => undefined,
      players: () => [],
      enemies: () => [],
      mechanisms: () => [],
      updateEntityPosition: jasmine.createSpy('updateEntityPosition'),
      updateEntity: jasmine.createSpy('updateEntity'),
      addEntity: jasmine.createSpy('addEntity'),
      removeEntity: jasmine.createSpy('removeEntity'),
      getEntity: () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        InteractivePlayService,
        { provide: SimulationEngineService, useValue: engine },
        { provide: SimulationService, useValue: simSvc },
        { provide: StatsCalculatorService, useValue: stats },
        { provide: BoardService, useValue: board },
      ],
    });
    service = TestBed.inject(InteractivePlayService);
  });

  it('démarre avec une séquence vide', () => {
    expect(service.recordedSteps()).toEqual([]);
  });

  it('enregistre un sort joué dans recordedSteps', async () => {
    service.startSessionFreeplay();
    await service.castSpell('spell_x', { x: 3, y: 4 });
    const steps = service.recordedSteps();
    expect(steps.length).toBe(1);
    expect(steps[0].actions[0].type).toBe('CastSpell');
    expect(steps[0].actions[0].spellId).toBe('spell_x');
    expect(steps[0].actions[0].targetPosition).toEqual({ x: 3, y: 4 });
  });

  it('clearRecording vide la séquence', async () => {
    service.startSessionFreeplay();
    await service.castSpell('spell_x', { x: 3, y: 4 });
    service.clearRecording();
    expect(service.recordedSteps()).toEqual([]);
  });

  it('un nouveau démarrage de session repart d une séquence vide', async () => {
    service.startSessionFreeplay();
    await service.castSpell('spell_x', { x: 3, y: 4 });
    service.startSessionFreeplay();
    expect(service.recordedSteps()).toEqual([]);
  });
});
```
(Si un `sync…FromContext` privé accède à un champ non mocké et jette, enrichir `contextAfter` du mock `executeSingleStep` en conséquence — le mock ci-dessus couvre `playerPosition` et `mechanisms`.)

- [ ] **Step 2 : Vérifier l'échec de compilation**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx tsc --noEmit -p tsconfig.spec.json`
Expected: erreur (`recordedSteps` / `clearRecording` n'existent pas sur `InteractivePlayService`).

- [ ] **Step 3 : Ajouter le signal d'enregistrement + l'API**

Dans `interactive-play.service.ts`, dans la classe `InteractivePlayService`, ajouter après la ligne `private _stepCount = 0;` (≈ ligne 38) :
```ts
  private readonly _recordedSteps = signal<TimelineStep[]>([]);
  /** Séquence des actions jouées dans la session courante (pour créer une timeline). */
  public readonly recordedSteps = computed(() => this._recordedSteps());
  public readonly recordedCount = computed(() => this._recordedSteps().length);

  /** Vide la séquence enregistrée (sans arrêter la session). */
  clearRecording(): void {
    this._recordedSteps.set([]);
  }
```
(`signal`, `computed` et `TimelineStep` sont déjà importés.)

- [ ] **Step 4 : Vider la séquence à chaque (re)démarrage/arrêt de session**

Toujours dans ce fichier, `this._stepCount = 0;` apparaît à 4 endroits (startSession, startSessionFreeplay, startSessionXelorFreeplay, stopSession). **Après chacune** de ces lignes, ajouter :
```ts
    this._recordedSteps.set([]);
```
(Astuce : remplacer chaque occurrence `this._stepCount = 0;` par `this._stepCount = 0;` suivi de `this._recordedSteps.set([]);`.)

- [ ] **Step 5 : Pousser le step joué (cast) dans la séquence**

Dans `castSpell(...)`, dans la branche succès (le `else` après `if (!result.success)`, qui contient `console.log(...dégâts...)` + les `sync…`), ajouter à la fin de ce bloc `else` :
```ts
        this._recordedSteps.update(s => [...s, step]);
```

- [ ] **Step 6 : Pousser le step joué (move) dans la séquence**

Dans `move(...)`, dans la branche `if (result.success) { … }` (celle qui fait `this._context.set(result.contextAfter)` + `updateEntityPosition`), ajouter à la fin de ce bloc `if` :
```ts
        this._recordedSteps.update(s => [...s, step]);
```

- [ ] **Step 7 : Compiler + type-check spec**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: `Application bundle generation complete.`
Run: `npx tsc --noEmit -p tsconfig.spec.json`
Expected: aucune erreur.

- [ ] **Step 8 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/services/interactive-play.service.ts frontend/src/app/services/interactive-play.service.spec.ts
git commit -m "feat(sim): InteractivePlayService enregistre la sequence d actions jouees"
```

---

## Task 2 : `TimelineRecorderComponent`

**Files:**
- Create: `frontend/src/app/components/timeline-recorder.component.ts`
- Test: `frontend/src/app/components/timeline-recorder.component.spec.ts`

- [ ] **Step 1 : Écrire la spec (qui échoue)**

Créer `frontend/src/app/components/timeline-recorder.component.spec.ts` :
```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TimelineRecorderComponent } from './timeline-recorder.component';
import { InteractivePlayService } from '../services/interactive-play.service';
import { TimelineService } from '../services/timeline.service';
import { BuildService } from '../services/build.service';
import { BoardService } from '../services/board.service';
import { TimelineStep } from '../models/timeline.model';

function castStep(spellId: string, x: number, y: number): TimelineStep {
  return { id: 's_' + spellId, actions: [{ id: 'a', type: 'CastSpell', order: 1, spellId, targetPosition: { x, y } }] };
}

describe('TimelineRecorderComponent', () => {
  let recorded: ReturnType<typeof signal<TimelineStep[]>>;
  let iplay: any;
  let timelineSvc: any;

  beforeEach(() => {
    recorded = signal<TimelineStep[]>([]);
    iplay = {
      recordedSteps: recorded,
      recordedCount: () => recorded().length,
      clearRecording: jasmine.createSpy('clearRecording'),
      resetSession: jasmine.createSpy('resetSession'),
    };
    timelineSvc = { createTimeline: jasmine.createSpy('createTimeline').and.returnValue(Promise.resolve({ id: 't1' })) };
    const buildSvc = { selectedBuildA: () => ({ id: 'b1' }) };
    const boardSvc = { players: () => [], enemies: () => [] };
    TestBed.configureTestingModule({
      imports: [TimelineRecorderComponent],
      providers: [
        { provide: InteractivePlayService, useValue: iplay },
        { provide: TimelineService, useValue: timelineSvc },
        { provide: BuildService, useValue: buildSvc },
        { provide: BoardService, useValue: boardSvc },
      ],
    });
  });

  it('désactive Sauvegarder quand aucune action', () => {
    const fixture = TestBed.createComponent(TimelineRecorderComponent);
    fixture.detectChanges();
    const saveBtn = fixture.nativeElement.querySelector('button.save') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('sauvegarde crée une timeline avec les steps et le build courant', async () => {
    recorded.set([castStep('spell_x', 3, 4), castStep('spell_y', 5, 6)]);
    spyOn(window, 'prompt').and.returnValue('Mon combo');
    const fixture = TestBed.createComponent(TimelineRecorderComponent);
    fixture.detectChanges();
    await fixture.componentInstance.save();
    expect(timelineSvc.createTimeline).toHaveBeenCalled();
    const arg = timelineSvc.createTimeline.calls.mostRecent().args[0];
    expect(arg.name).toBe('Mon combo');
    expect(arg.buildId).toBe('b1');
    expect(arg.steps.length).toBe(2);
    expect(iplay.clearRecording).toHaveBeenCalled();
  });

  it('sauvegarde annulée (prompt vide) n appelle pas createTimeline', async () => {
    recorded.set([castStep('spell_x', 3, 4)]);
    spyOn(window, 'prompt').and.returnValue(null);
    const fixture = TestBed.createComponent(TimelineRecorderComponent);
    fixture.detectChanges();
    await fixture.componentInstance.save();
    expect(timelineSvc.createTimeline).not.toHaveBeenCalled();
  });

  it('Nouvelle timeline réinitialise la session', () => {
    const fixture = TestBed.createComponent(TimelineRecorderComponent);
    fixture.detectChanges();
    fixture.componentInstance.newTimeline();
    expect(iplay.resetSession).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: erreur (`./timeline-recorder.component` introuvable).

- [ ] **Step 3 : Implémenter le composant**

Créer `frontend/src/app/components/timeline-recorder.component.ts` :
```ts
import { Component, computed, inject } from '@angular/core';
import { InteractivePlayService } from '../services/interactive-play.service';
import { TimelineService } from '../services/timeline.service';
import { BuildService } from '../services/build.service';
import { BoardService } from '../services/board.service';
import { UiButtonComponent } from '../ui/ui-button.component';
import { Timeline, TimelineStep, TimelineBoardEntitySetup } from '../models/timeline.model';

@Component({
  selector: 'app-timeline-recorder',
  standalone: true,
  imports: [UiButtonComponent],
  template: `
    <section class="recorder">
      <header class="recorder-head">
        <span class="rec-dot" aria-hidden="true"></span>
        <span class="rec-title">Timeline en cours</span>
        <span class="rec-count">{{ count() }} action{{ count() > 1 ? 's' : '' }}</span>
        <span class="rec-spacer"></span>
        <button ui-button variant="primary" class="save" [disabled]="count() === 0" (click)="save()">Sauvegarder en timeline</button>
        <button ui-button variant="ghost" class="new" (click)="newTimeline()">Nouvelle timeline</button>
      </header>

      @if (count() === 0) {
        <p class="rec-empty">Joue sur la map (clique un sort → clique une case) : chaque action s'ajoute ici.</p>
      } @else {
        <ol class="rec-list">
          @for (step of steps(); track step.id) {
            <li class="rec-item">
              <span class="rec-num">{{ $index + 1 }}</span>
              <span class="rec-label">{{ label(step) }}</span>
              @if (target(step); as t) { <span class="rec-target">→ ({{ t.x }}, {{ t.y }})</span> }
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: [`
    .recorder { background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 12px; padding: 12px 14px; color: var(--app-text); }
    .recorder-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .rec-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--app-danger); }
    .rec-title { font-weight: 600; }
    .rec-count { font-size: 12px; color: var(--app-text-muted); }
    .rec-spacer { flex: 1 1 auto; }
    .rec-empty { color: var(--app-text-muted); font-size: 13px; margin: 4px 0 0; }
    .rec-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow: auto; }
    .rec-item { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 8px; background: var(--app-surface-2); font-size: 13px; }
    .rec-num { width: 20px; text-align: center; color: var(--app-text-muted); }
    .rec-label { font-weight: 500; }
    .rec-target { color: var(--app-text-muted); }
  `],
})
export class TimelineRecorderComponent {
  private readonly interactivePlay = inject(InteractivePlayService);
  private readonly timelineService = inject(TimelineService);
  private readonly buildService = inject(BuildService);
  private readonly boardService = inject(BoardService);

  protected readonly steps = this.interactivePlay.recordedSteps;
  protected readonly count = computed(() => this.steps().length);

  protected label(step: TimelineStep): string {
    const a = step.actions[0];
    if (!a) return 'Action';
    if (a.type === 'CastSpell') return 'Sort ' + (a.spellId ?? '');
    if (a.type === 'Move') return 'Déplacement';
    return a.type;
  }

  protected target(step: TimelineStep): { x: number; y: number } | null {
    return step.actions[0]?.targetPosition ?? null;
  }

  async save(): Promise<void> {
    if (this.count() === 0) return;
    const name = window.prompt('Nom de la timeline :');
    if (!name || !name.trim()) return;
    const entities: TimelineBoardEntitySetup[] = [
      ...this.boardService.players(),
      ...this.boardService.enemies(),
    ].map(e => ({ id: e.id, type: e.type, name: e.name, classId: e.classId, position: e.position, facing: e.facing }));
    const timeline: Timeline = {
      id: `timeline_${Date.now()}`,
      name: name.trim(),
      buildId: this.buildService.selectedBuildA()?.id ?? '',
      steps: [...this.steps()],
      boardSetup: { entities },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.timelineService.createTimeline(timeline);
    this.interactivePlay.clearRecording();
    alert('Timeline « ' + timeline.name + ' » sauvegardée.');
  }

  newTimeline(): void {
    this.interactivePlay.resetSession(null);
  }
}
```

- [ ] **Step 4 : Compiler + type-check spec**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development` → `Application bundle generation complete.`
Run: `npx tsc --noEmit -p tsconfig.spec.json` → aucune erreur.

- [ ] **Step 5 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/components/timeline-recorder.component.ts frontend/src/app/components/timeline-recorder.component.spec.ts
git commit -m "feat(ui): TimelineRecorderComponent (sequence jouee + sauvegarde en timeline)"
```

---

## Task 3 : Afficher le recorder en Freeplay, retirer le formulaire, recâbler le sélecteur

**Files:**
- Modify: `frontend/src/app/components/dashboard.component.ts`
- Delete: `frontend/src/app/components/timeline-form.component.ts`

- [ ] **Step 1 : Importer le recorder, retirer le form**

Dans `dashboard.component.ts` :
- Remplacer l'import `import {TimelineFormComponent} from './timeline-form.component';` (ligne 13) par :
  `import {TimelineRecorderComponent} from './timeline-recorder.component';`
- Dans le tableau `imports: [...]` du décorateur (ligne 25), remplacer `TimelineFormComponent` par `TimelineRecorderComponent`.
- Supprimer la ligne du template `<app-timeline-form #timelineForm></app-timeline-form>` (≈ ligne 132).
- Supprimer la propriété `@ViewChild('timelineForm') timelineForm!: TimelineFormComponent;` (≈ ligne 1083).

- [ ] **Step 2 : Afficher le recorder en mode freeplay**

Dans le template, juste après l'élément `<app-board … ></app-board>` (dans `<section class="section board-section">`), ajouter :
```html
            @if (mode() === 'freeplay') {
              <app-timeline-recorder></app-timeline-recorder>
            }
```

- [ ] **Step 3 : Recâbler les handlers du sélecteur timeline**

Remplacer `onCreateTimeline()` (≈ lignes 1104-1106) par :
```ts
  onCreateTimeline(): void {
    this.router.navigate(['/freeplay']);
  }
```
Remplacer `onEditTimeline(...)` (≈ lignes 1108-1111) par :
```ts
  onEditTimeline(event: any, timeline: any): void {
    event?.stopPropagation?.();
    const name = window.prompt('Nouveau nom de la timeline :', timeline.name);
    if (name && name.trim()) {
      this.timelineService.updateTimeline(timeline.id, { name: name.trim() });
    }
  }
```
(`this.router` est déjà injecté ; `this.timelineService` est déjà injecté — vérifier le nom exact de la propriété et le réutiliser.)

- [ ] **Step 4 : Supprimer le composant formulaire**

Run: `grep -rn "TimelineFormComponent\|timeline-form" /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend/src` → attendu : aucune correspondance.
Puis: `rm /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend/src/app/components/timeline-form.component.ts`
(Vérifier s'il existe `timeline-form.component.spec.ts` ; si oui, le supprimer aussi.)

- [ ] **Step 5 : Compiler**

Run: `cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend && npx ng build --configuration development`
Expected: `Application bundle generation complete.`

- [ ] **Step 6 : Vérification manuelle**

`cd frontend && npx ng serve` → `/freeplay` : démarrer une session, lancer un sort / se déplacer → la bande « Timeline en cours » se remplit ; « Sauvegarder en timeline » demande un nom et crée la timeline (visible dans le sélecteur en mode Timeline) ; « Nouvelle timeline » repart propre. Le sélecteur timeline : « ➕ Nouvelle Timeline » mène à /freeplay ; « ✏️ » renomme via prompt. Plus aucune modale de formulaire.

- [ ] **Step 7 : Commit** (depuis la racine)
```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/components/dashboard.component.ts frontend/src/app/components/timeline-form.component.ts
git commit -m "feat(ui): recorder de timeline en freeplay + suppression du formulaire de timeline"
```

---

## Self-review (effectué)

- **Couverture spec** : enregistrement dans le service (T1) ✓ ; recorder visuel + save + new (T2) ✓ ; affichage freeplay + suppression du form + recâblage sélecteur (T3) ✓ ; construction Timeline (name/buildId/steps/boardSetup) conforme à la spec (T2) ✓ ; renommer/supprimer via sélecteur conservés (T3 : rename par prompt ; delete inchangé) ✓.
- **Placeholders** : aucun ; code complet. T1 pousse dans les branches succès existantes ; T3 = édits précis sur des lignes connues.
- **Cohérence des types** : `recordedSteps` (computed `TimelineStep[]`), `clearRecording()`, `recordedCount` définis en T1 et consommés en T2/T3 ; `TimelineBoardEntitySetup` construit depuis `BoardEntity` (mêmes champs sauf `icon`) ; `createTimeline(Timeline)` / `updateTimeline(id, Partial<Timeline>)` conformes.
- **Risques** : (a) le spec de T1 mocke le moteur — si un `sync…FromContext` privé touche un champ non mocké, enrichir `contextAfter` (noté). (b) `boardSetup` best-effort : si aucune entité placée, `entities: []` (timeline sauvegardée quand même). (c) « Fin de tour » non enregistrée comme étape (non-objectif). (d) `buildId` vide en freeplay sans build (noté dans la spec).
- **Env** : specs non exécutables ici (pas de Chrome) → `ng build` + `tsc -p tsconfig.spec.json` comme barrières.
