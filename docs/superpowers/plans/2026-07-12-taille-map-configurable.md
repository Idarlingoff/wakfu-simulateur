# Taille de map configurable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'utilisateur de choisir la largeur et la hauteur de la map (en nombre de cases, 5–20), avec persistance par timeline + cache localStorage, la grille restant contenue dans son conteneur via une taille de case dynamique.

**Architecture:** `BoardService` devient la source de vérité unique pour `cols`/`rows` (défaut 10×10), avec `setGridSize()` qui clampe, recale les entités hors-bornes et met en cache dans localStorage. `BoardComponent` rend la grille à partir de ces dimensions et calcule une taille de case en pixels via un `ResizeObserver` (exposée en `grid-template`). `DashboardComponent` ajoute un bouton ⚙ + popover pour régler la taille. `TimelineBoardSetup` transporte `cols`/`rows` pour la persistance par timeline.

**Tech Stack:** Angular 19 (signals, computed, effect), TypeScript, Jasmine/Karma (`ng test`), CSS grid, ResizeObserver.

---

## File Structure

- **Modify** `frontend/src/app/models/timeline.model.ts` — champs optionnels `cols`/`rows` sur `TimelineBoardSetup`.
- **Modify** `frontend/src/app/services/board.service.ts` — constantes, `gridSize`, `setGridSize`, clamp/recale, cache localStorage, export/apply avec cols/rows, défaut 10×10.
- **Create** `frontend/src/app/services/board.service.spec.ts` — tests unitaires du service.
- **Modify** `frontend/src/app/components/board.component.ts` — `boardCells` dynamique, `cellSize` signal, `gridStyle`, `ResizeObserver`, template `.board` + `.board-wrapper`.
- **Modify** `frontend/src/app/components/dashboard.component.ts` — bouton ⚙ + popover de réglage, handler `onApplyMapSize`.

**Conventions à respecter (déjà en place dans le repo) :**
- Services `providedIn: 'root'`, signals privés `_x` + `computed` publics.
- localStorage encapsulé dans `try/catch` (cf. `theme.service.ts`).
- Tests : `TestBed.resetTestingModule()` + `TestBed.configureTestingModule({ providers: [Service] })` dans `beforeEach`, nettoyage localStorage (cf. `theme.service.spec.ts`).

---

## Task 1: Étendre le modèle TimelineBoardSetup

**Files:**
- Modify: `frontend/src/app/models/timeline.model.ts`

- [ ] **Step 1: Ajouter cols/rows optionnels à `TimelineBoardSetup`**

Dans `frontend/src/app/models/timeline.model.ts`, remplacer l'interface existante :

```ts
export interface TimelineBoardSetup {
  entities: TimelineBoardEntitySetup[];
  mechanisms?: TimelineBoardMechanismSetup[];
}
```

par :

```ts
export interface TimelineBoardSetup {
  entities: TimelineBoardEntitySetup[];
  mechanisms?: TimelineBoardMechanismSetup[];
  cols?: number;
  rows?: number;
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: aucune sortie (compile sans erreur).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/models/timeline.model.ts
git commit -m "feat(model): cols/rows optionnels sur TimelineBoardSetup"
```

---

## Task 2: Constantes et helpers de taille dans BoardService (TDD)

Cette tâche pose les constantes, le clamp et le cache localStorage. On teste d'abord `setGridSize` (clamp) et le cache.

**Files:**
- Create: `frontend/src/app/services/board.service.spec.ts`
- Modify: `frontend/src/app/services/board.service.ts`

- [ ] **Step 1: Écrire le test qui échoue (clamp + gridSize + cache)**

Créer `frontend/src/app/services/board.service.spec.ts` :

```ts
import { TestBed } from '@angular/core/testing';
import { BoardService } from './board.service';

const MAP_SIZE_KEY = 'wakfu.mapSize';

describe('BoardService — taille de map', () => {
  beforeEach(() => {
    localStorage.removeItem(MAP_SIZE_KEY);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [BoardService] });
  });

  it('gridSize vaut 10x10 par defaut', () => {
    const service = TestBed.inject(BoardService);
    expect(service.gridSize()).toEqual({ cols: 10, rows: 10 });
  });

  it('setGridSize clampe entre 10 et 20', () => {
    const service = TestBed.inject(BoardService);
    service.setGridSize(2, 99);
    expect(service.gridSize()).toEqual({ cols: 5, rows: 20 });
  });

  it('setGridSize persiste la taille dans localStorage', () => {
    const service = TestBed.inject(BoardService);
    service.setGridSize(12, 8);
    expect(JSON.parse(localStorage.getItem(MAP_SIZE_KEY)!)).toEqual({ cols: 12, rows: 8 });
  });

  it('lit la taille en cache au demarrage', () => {
    localStorage.setItem(MAP_SIZE_KEY, JSON.stringify({ cols: 15, rows: 7 }));
    const service = TestBed.inject(BoardService);
    expect(service.gridSize()).toEqual({ cols: 15, rows: 7 });
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/board.service.spec.ts'`
Expected: FAIL — `service.gridSize is not a function` (méthode absente).

- [ ] **Step 3: Ajouter constantes, helpers, gridSize et setGridSize**

Dans `frontend/src/app/services/board.service.ts`, après les imports, ajouter les constantes (avant le décorateur `@Injectable`) :

```ts
const MAP_SIZE_KEY = 'wakfu.mapSize';
const MIN_DIM = 5;
const MAX_DIM = 20;
const DEFAULT_DIM = 10;
```

Remplacer le littéral initial du signal `boardState` (les valeurs `cols: 13, rows: 13`) par `DEFAULT_DIM` :

```ts
  private boardState = signal<InteractiveBoardState>({
    cols: DEFAULT_DIM,
    rows: DEFAULT_DIM,
    entities: [],
    mechanisms: [],
    dialHours: [],
    selectedEntityId: undefined,
  });
```

Ajouter le selector public `gridSize` près des autres `computed` (après `public state = computed(...)`) :

```ts
  public gridSize = computed(() => {
    const s = this.boardState();
    return { cols: s.cols, rows: s.rows };
  });
```

Ajouter les méthodes suivantes dans la classe (par ex. juste avant `resetToDefault`) :

```ts
  /**
   * Définit la taille de la grille (largeur/hauteur en cases).
   * Clampe entre MIN_DIM et MAX_DIM, recale les entités/rouages manuels
   * hors des nouvelles bornes, puis met la taille en cache (localStorage).
   */
  public setGridSize(cols: number, rows: number): void {
    const c = this.clampDim(cols);
    const r = this.clampDim(rows);
    this.boardState.update(state => ({ ...state, cols: c, rows: r }));
    this.clampEntitiesToBounds(c, r);
    this.persistSize(c, r);
  }

  private clampDim(n: number): number {
    if (!Number.isFinite(n)) return DEFAULT_DIM;
    return Math.max(MIN_DIM, Math.min(MAX_DIM, Math.round(n)));
  }

  /**
   * Recale les entités et rouages posés manuellement (sans spellId) hors
   * des bornes cols/rows sur la case valide la plus proche (bord de la map).
   */
  private clampEntitiesToBounds(cols: number, rows: number): void {
    this.boardState.update(state => ({
      ...state,
      entities: state.entities.map(e => ({
        ...e,
        position: {
          x: Math.min(e.position.x, cols - 1),
          y: Math.min(e.position.y, rows - 1)
        }
      })),
      mechanisms: state.mechanisms.map(m =>
        m.spellId
          ? m
          : { ...m, position: { x: Math.min(m.position.x, cols - 1), y: Math.min(m.position.y, rows - 1) } }
      )
    }));
  }

  private readCachedSize(): { cols: number; rows: number } {
    try {
      const raw = localStorage.getItem(MAP_SIZE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { cols: this.clampDim(parsed.cols), rows: this.clampDim(parsed.rows) };
      }
    } catch {
      /* localStorage indisponible */
    }
    return { cols: DEFAULT_DIM, rows: DEFAULT_DIM };
  }

  private persistSize(cols: number, rows: number): void {
    try {
      localStorage.setItem(MAP_SIZE_KEY, JSON.stringify({ cols, rows }));
    } catch {
      /* localStorage indisponible */
    }
  }
```

- [ ] **Step 4: Utiliser la taille en cache à l'initialisation**

Toujours dans `board.service.ts`, modifier `initializeBoard()` et `createEmptyBoardState()` pour tenir compte de la taille en cache et d'une taille paramétrable :

```ts
  private initializeBoard(): void {
    const { cols, rows } = this.readCachedSize();
    const defaultState = this.createEmptyBoardState(cols, rows);
    defaultState.entities = [
      {
        id: 'default_player',
        type: 'player',
        name: 'Xelor',
        classId: 'XEL',
        position: { x: 4, y: 4 },
        facing: { direction: 'front' }
      },
      {
        id: 'default_enemy',
        type: 'enemy',
        name: 'Ennemi',
        position: { x: 7, y: 4 },
        facing: { direction: 'front' }
      }
    ];
    this.boardState.set(defaultState);
  }

  private createEmptyBoardState(cols: number = DEFAULT_DIM, rows: number = DEFAULT_DIM): InteractiveBoardState {
    return {
      cols,
      rows,
      entities: [],
      mechanisms: [],
      dialHours: [],
      selectedEntityId: undefined,
      draggedEntity: undefined
    };
  }
```

Modifier `resetToDefault()` pour préserver la taille courante (au lieu de retomber à 13×13/10×10) :

```ts
  public resetToDefault(): void {
    const s = this.boardState();
    this.boardState.set(this.createEmptyBoardState(s.cols, s.rows));
  }
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/board.service.spec.ts'`
Expected: PASS (4 tests verts).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/services/board.service.ts frontend/src/app/services/board.service.spec.ts
git commit -m "feat(board): taille de grille configurable (clamp 5-20, defaut 10, cache localStorage)"
```

---

## Task 3: Recalage des entités et round-trip timeline (TDD)

**Files:**
- Modify: `frontend/src/app/services/board.service.spec.ts`
- Modify: `frontend/src/app/services/board.service.ts`

- [ ] **Step 1: Écrire les tests qui échouent (recale + export/apply)**

Ajouter dans `board.service.spec.ts`, à l'intérieur du `describe` existant, ces tests :

```ts
  it('setGridSize recale les entites hors bornes sur le bord', () => {
    const service = TestBed.inject(BoardService);
    service.addEntity({
      id: 'e1', type: 'enemy', name: 'X',
      position: { x: 9, y: 8 }, facing: { direction: 'front' }
    });
    service.setGridSize(6, 6);
    const moved = service.getEntity('e1')!;
    expect(moved.position).toEqual({ x: 5, y: 5 });
  });

  it('setGridSize recale les rouages manuels mais laisse les rouages de sort', () => {
    const service = TestBed.inject(BoardService);
    service.addMechanism({ id: 'manual', type: 'cog', position: { x: 9, y: 9 }, charges: 0 });
    service.addMechanism({ id: 'spell', type: 'cog', position: { x: 8, y: 8 }, charges: 0, spellId: 'S' });
    service.setGridSize(5, 5);
    expect(service.getMechanism('manual')!.position).toEqual({ x: 4, y: 4 });
    expect(service.getMechanism('spell')!.position).toEqual({ x: 8, y: 8 });
  });

  it('exportCurrentSetup ecrit cols/rows courants', () => {
    const service = TestBed.inject(BoardService);
    service.setGridSize(14, 9);
    const setup = service.exportCurrentSetup();
    expect(setup.cols).toBe(14);
    expect(setup.rows).toBe(9);
  });

  it('applyTimelineSetup applique cols/rows du setup', () => {
    const service = TestBed.inject(BoardService);
    service.applyTimelineSetup({
      entities: [{ id: 'a', type: 'player', name: 'P', position: { x: 0, y: 0 }, facing: { direction: 'front' } }],
      cols: 16, rows: 12
    });
    expect(service.gridSize()).toEqual({ cols: 16, rows: 12 });
  });

  it('applyTimelineSetup retombe sur 10x10 si le setup n a pas de taille', () => {
    const service = TestBed.inject(BoardService);
    service.setGridSize(18, 18);
    service.applyTimelineSetup({
      entities: [{ id: 'a', type: 'player', name: 'P', position: { x: 0, y: 0 }, facing: { direction: 'front' } }]
    });
    expect(service.gridSize()).toEqual({ cols: 10, rows: 10 });
  });
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/board.service.spec.ts'`
Expected: FAIL — `exportCurrentSetup` ne renvoie pas `cols`/`rows`, `applyTimelineSetup` n'applique pas la taille.

- [ ] **Step 3: Écrire cols/rows dans `exportCurrentSetup`**

Dans `board.service.ts`, dans `exportCurrentSetup()`, ajouter `cols`/`rows` au retour :

```ts
  public exportCurrentSetup(): TimelineBoardSetup {
    const state = this.boardState();
    return {
      entities: state.entities.map(entity => ({
        id: entity.id,
        type: entity.type,
        name: entity.name,
        classId: entity.classId,
        position: { ...entity.position },
        facing: { ...entity.facing }
      })),
      mechanisms: this.getManualCogs(state.mechanisms).map(m => ({
        id: m.id,
        position: { ...m.position },
        charges: m.charges ?? 0
      })),
      cols: state.cols,
      rows: state.rows
    };
  }
```

- [ ] **Step 4: Appliquer cols/rows dans `applyTimelineSetup`**

Remplacer `applyTimelineSetup()` par cette version (applique la taille + recale) :

```ts
  public applyTimelineSetup(setup?: TimelineBoardSetup): void {
    this.clearHistory();
    this.resetDialState();

    const cols = this.clampDim(setup?.cols ?? DEFAULT_DIM);
    const rows = this.clampDim(setup?.rows ?? DEFAULT_DIM);
    this.persistSize(cols, rows);

    if (!setup || setup.entities.length === 0) {
      this.boardState.set(this.createEmptyBoardState(cols, rows));
      return;
    }

    this.boardState.update(state => ({
      ...state,
      cols,
      rows,
      entities: setup.entities.map(entity => ({
        id: entity.id,
        type: entity.type,
        name: entity.name,
        classId: entity.classId,
        position: { ...entity.position },
        facing: { ...entity.facing }
      })),
      mechanisms: (setup.mechanisms ?? []).map(m => ({
        id: m.id,
        type: 'cog' as const,
        position: { ...m.position },
        charges: m.charges ?? 0
      })),
      dialHours: [],
      selectedEntityId: undefined,
      draggedEntity: undefined
    }));

    this.clampEntitiesToBounds(cols, rows);
  }
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/board.service.spec.ts'`
Expected: PASS (9 tests verts au total).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/services/board.service.ts frontend/src/app/services/board.service.spec.ts
git commit -m "feat(board): recalage des entites hors bornes + round-trip cols/rows timeline"
```

---

## Task 4: Rendu dynamique de la grille dans BoardComponent

Rendre la grille à partir de `gridSize()` et calculer la taille de case en px via `ResizeObserver`.

**Files:**
- Modify: `frontend/src/app/components/board.component.ts`

- [ ] **Step 1: Importer les symboles de cycle de vie et ElementRef**

En tête de `board.component.ts`, la ligne d'import Angular est :

```ts
import { Component, inject, computed, output, effect, input, signal } from '@angular/core';
```

La remplacer par :

```ts
import { Component, inject, computed, output, effect, input, signal, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
```

- [ ] **Step 2: Ajouter les constantes de taille de case**

Juste après les imports (avant le décorateur `@Component`), ajouter :

```ts
const MIN_CELL = 16;
const MAX_CELL = 44;
```

- [ ] **Step 3: Rendre `boardCells` dynamique**

Remplacer le `boardCells = computed(...)` (boucles `< 10`) par :

```ts
  boardCells = computed(() => {
    const { cols, rows } = this.boardService.gridSize();
    const cells: BoardCell[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        cells.push({
          x,
          y,
          hasEntity: !!this.getEntityAtPosition(x, y),
          hasMechanism: !!this.getMechanismAtPosition(x, y),
          isAction: !!this.getActionAtPosition(x, y)
        });
      }
    }
    return cells;
  });
```

- [ ] **Step 4: Ajouter le signal `cellSize` et le computed `gridStyle`**

Ajouter ces membres dans la classe (près de `boardCells`) :

```ts
  cellSize = signal<number>(MAX_CELL);

  gridStyle = computed(() => {
    const { cols, rows } = this.boardService.gridSize();
    const size = this.cellSize();
    return {
      'grid-template-columns': `repeat(${cols}, ${size}px)`,
      'grid-template-rows': `repeat(${rows}, ${size}px)`
    };
  });

  @ViewChild('boardWrapper') boardWrapperRef?: ElementRef<HTMLElement>;
  private resizeObserver?: ResizeObserver;
```

- [ ] **Step 5: Déclarer les hooks de cycle de vie sur la classe**

La déclaration actuelle est :

```ts
export class BoardComponent {
```

La remplacer par :

```ts
export class BoardComponent implements AfterViewInit, OnDestroy {
```

- [ ] **Step 6: Implémenter le ResizeObserver et le recalcul**

Ajouter ces méthodes dans la classe (par ex. juste après le `constructor`) :

```ts
  ngAfterViewInit(): void {
    const el = this.boardWrapperRef?.nativeElement;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.recomputeCellSize());
      this.resizeObserver.observe(el);
    }
    this.recomputeCellSize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private recomputeCellSize(): void {
    const el = this.boardWrapperRef?.nativeElement;
    if (!el) return;
    const { cols, rows } = this.boardService.gridSize();
    const style = getComputedStyle(el);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const availW = el.clientWidth - padX;
    const availH = el.clientHeight - padY;
    const GAP = 1;          // .board gap
    const BOARD_PADDING = 10; // .board padding
    const usableW = availW - BOARD_PADDING * 2 - GAP * (cols - 1);
    const usableH = availH - BOARD_PADDING * 2 - GAP * (rows - 1);
    const perCol = usableW / cols;
    const perRow = usableH / rows;
    const size = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(Math.min(perCol, perRow))));
    this.cellSize.set(Number.isFinite(size) && size > 0 ? size : MIN_CELL);
  }
```

- [ ] **Step 7: Recalculer quand la taille de grille change**

Dans le `constructor`, après les `effect(...)` existants, ajouter un effet qui suit `gridSize` et recalcule après mise à jour du DOM :

```ts
    effect(() => {
      this.boardService.gridSize(); // dépendance : recalcul quand cols/rows changent
      queueMicrotask(() => this.recomputeCellSize());
    });
```

- [ ] **Step 8: Ajouter la référence `#boardWrapper` et le style dynamique dans le template**

Dans le template, la ligne :

```html
        <div class="board-wrapper">
          <div class="board"><div
```

devient :

```html
        <div class="board-wrapper" #boardWrapper>
          <div class="board" [ngStyle]="gridStyle()"><div
```

- [ ] **Step 9: Retirer la grille figée du CSS `.board` et fermer le débordement du wrapper**

Dans les styles, remplacer le bloc `.board { ... }` (celui avec `grid-template-columns: repeat(10, 44px)`) par :

```css
    .board {
      display: grid;
      gap: 1px;
      background: #0f1415;
      padding: 10px;
      border-radius: 8px;
    }
```

Et dans `.board-wrapper { ... }`, remplacer `overflow: auto;` par `overflow: hidden;`.

- [ ] **Step 10: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: aucune sortie (compile sans erreur).

- [ ] **Step 11: Commit**

```bash
git add frontend/src/app/components/board.component.ts
git commit -m "feat(board): rendu dynamique de la grille + taille de case adaptative (ResizeObserver)"
```

---

## Task 5: UI de réglage (bouton ⚙ + popover) dans DashboardComponent

**Files:**
- Modify: `frontend/src/app/components/dashboard.component.ts`

- [ ] **Step 1: Ajouter le bouton et le popover dans la barre d'outils**

Dans `dashboard.component.ts`, le bloc `header-tools` se termine par le bouton "Effacer la map". Juste avant ce bouton "danger", insérer le bouton ⚙ + popover. Le bloc actuel :

```html
          <button class="tool-btn" (click)="onSaveMap()" title="Sauvegarder la map (alliés, ennemis, rouages)" aria-label="Sauvegarder la map"><ui-icon name="save"></ui-icon></button>
          <button class="tool-btn danger" (click)="onClearBoard()" title="Effacer la map" aria-label="Effacer la map"><ui-icon name="trash"></ui-icon></button>
```

devient :

```html
          <button class="tool-btn" (click)="onSaveMap()" title="Sauvegarder la map (alliés, ennemis, rouages)" aria-label="Sauvegarder la map"><ui-icon name="save"></ui-icon></button>
          <div class="map-size-wrapper">
            <button class="tool-btn" (click)="toggleMapSizePanel()" title="Taille de la map" aria-label="Taille de la map"><ui-icon name="cog"></ui-icon></button>
            @if (showMapSizePanel()) {
              <div class="map-size-backdrop" (click)="showMapSizePanel.set(false)"></div>
              <div class="map-size-panel">
                <div class="map-size-title">Taille de la map (cases)</div>
                <label class="map-size-field">
                  <span>Largeur</span>
                  <input type="number" min="5" max="20" [(ngModel)]="mapWidthInput" />
                </label>
                <label class="map-size-field">
                  <span>Hauteur</span>
                  <input type="number" min="5" max="20" [(ngModel)]="mapHeightInput" />
                </label>
                <div class="map-size-hint">Entre 10 et 20 cases.</div>
                <button class="map-size-apply" (click)="onApplyMapSize()">Appliquer</button>
              </div>
            }
          </div>
          <button class="tool-btn danger" (click)="onClearBoard()" title="Effacer la map" aria-label="Effacer la map"><ui-icon name="trash"></ui-icon></button>
```

- [ ] **Step 2: Ajouter les styles du popover**

Dans le tableau `styles` de `dashboard.component.ts`, après le bloc `.tool-btn:disabled { ... }`, ajouter :

```css
    .map-size-wrapper { position: relative; display: inline-flex; }
    .map-size-backdrop { position: fixed; inset: 0; z-index: 40; }
    .map-size-panel {
      position: absolute; top: 40px; right: 0; z-index: 41;
      display: flex; flex-direction: column; gap: 8px;
      background: var(--app-surface); border: 1px solid var(--app-border);
      border-radius: 8px; padding: 12px; min-width: 180px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    }
    .map-size-title { font-weight: 600; font-size: 13px; color: var(--app-text); }
    .map-size-field { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; color: var(--app-text); }
    .map-size-field input { width: 64px; padding: 4px 6px; border: 1px solid var(--app-border); border-radius: 6px; background: var(--app-surface-2); color: var(--app-text); }
    .map-size-hint { font-size: 11px; color: var(--app-text-muted); }
    .map-size-apply { padding: 6px 10px; border: 1px solid var(--app-border); border-radius: 6px; background: var(--app-accent); color: #fff; cursor: pointer; font-size: 13px; }
    .map-size-apply:hover { filter: brightness(1.05); }
```

- [ ] **Step 3: Ajouter les signals et handlers dans la classe**

Après `showTimelineDropdown = signal<boolean>(false);`, ajouter :

```ts
  showMapSizePanel = signal<boolean>(false);
  mapWidthInput = signal<number>(10);
  mapHeightInput = signal<number>(10);
```

Ajouter les méthodes (par ex. après `onSaveMap`) :

```ts
  toggleMapSizePanel(): void {
    const size = this.boardService.gridSize();
    this.mapWidthInput.set(size.cols);
    this.mapHeightInput.set(size.rows);
    this.showMapSizePanel.update(v => !v);
  }

  onApplyMapSize(): void {
    this.boardService.setGridSize(Number(this.mapWidthInput()), Number(this.mapHeightInput()));
    this.showMapSizePanel.set(false);
  }
```

- [ ] **Step 4: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: aucune sortie (compile sans erreur).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/components/dashboard.component.ts
git commit -m "feat(ui): bouton + popover de reglage de la taille de la map"
```

---

## Task 6: Vérification globale (tests + build + visuel)

**Files:** aucun changement (vérification uniquement ; corriger si un test échoue).

- [ ] **Step 1: Lancer toute la suite de tests front**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: tous les specs passent (les nouveaux `board.service.spec.ts` inclus).

- [ ] **Step 2: Build de production**

Run: `cd frontend && npx ng build`
Expected: build réussi, aucune erreur de compilation.

- [ ] **Step 3: Vérification visuelle via preview**

Démarrer le serveur de dev (preview_start), puis vérifier :
1. Ouvrir le board ; le bouton ⚙ ouvre le popover.
2. Régler 20×20 → la grille reste **contenue** dans `.board-wrapper` (le wrapper ne change pas de taille), les cases rétrécissent.
3. Régler 5×5 → grande case, wrapper inchangé ; une entité placée loin est recalée sur le bord.
4. Freeplay → Résultats → retour : la taille est conservée (cache localStorage).
5. En mode Timeline : régler une taille, « Sauvegarder la map », recharger la timeline → la taille est restaurée.

Fournir une capture (preview_screenshot) montrant une map redimensionnée.

- [ ] **Step 4: Commit éventuel des corrections**

Si des ajustements ont été nécessaires :

```bash
git add -A
git commit -m "fix: ajustements taille de map suite verification"
```

---

## Notes de vérification du plan (self-review)

- **Couverture spec :** source de vérité unique cols/rows (T2), défaut 10×10 (T2), rendu contenu + case dynamique (T4), UI bouton+popover (T5), persistance par timeline (T1+T3), cache localStorage (T2), bornes 5–20 (T2), recalage hors-bornes (T3). ✅
- **Cohérence des noms :** `gridSize`, `setGridSize`, `clampDim`, `clampEntitiesToBounds`, `readCachedSize`, `persistSize`, `cellSize`, `gridStyle`, `recomputeCellSize`, `toggleMapSizePanel`, `onApplyMapSize` — utilisés de façon cohérente entre tâches. ✅
- **Dépendances de types :** `getManualCogs` existe déjà (introduit lors de la feature save/restore map) et est réutilisé en T3. `TimelineBoardSetup.cols/rows` (T1) est consommé en T3. ✅
