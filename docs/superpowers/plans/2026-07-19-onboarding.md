# Onboarding — visite guidée : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une visite guidée interactive en 5 étapes, déclenchée au premier passage et rejouable, qui montre à un joueur de Wakfu où cliquer dans l'outil.

**Architecture:** Trois unités. `DemoDataService` expose un build et une timeline de démonstration en mémoire seule, que `BuildService` et `TimelineService` superposent à leurs listes réelles sans jamais rien écrire. `TourService` porte la progression et les étapes déclaratives. `TourOverlayComponent`, monté dans la coquille, dessine le voile percé et la bulle.

**Tech Stack:** Angular 19 standalone, signals, Jasmine + Karma.

**Spec:** `docs/superpowers/specs/2026-07-19-onboarding-design.md`

---

## Écarts assumés par rapport à la spec

Trois ajustements décidés après lecture du code :

1. **La cible de l'étape Timelines vit dans `dashboard.component.ts`.** La spec listait `timeline-page.component.ts`, mais ce fichier n'est qu'un `<app-dashboard mode="timeline">`. Le sélecteur de timeline est dans le `header` du dashboard.
2. **Le build de démo est défini par un code deck, pas par des ids en dur.** Les ids de passifs servis par le backend (`XEL_MAITRE_CADRAN`, `XEL_REMANENCE`) diffèrent de ceux de `frontend/src/assets/data/Passives.json`. Coder les références en dur dériverait silencieusement. `DemoDataService` les résout via `DeckCodeService` à l'activation, ce qui les aligne par construction sur ce que sert le backend.
3. **`activate()` est asynchrone**, conséquence directe du point 2.

## Structure des fichiers

| Fichier | Responsabilité |
| --- | --- |
| `frontend/src/app/utils/tour-steps.ts` | Les 5 étapes en données pures + le type `TourStep`. |
| `frontend/src/app/services/demo-data.service.ts` | Build et timeline de démo, drapeau `active`, reconnaissance des ids réservés. |
| `frontend/src/app/services/tour.service.ts` | Progression, navigation, persistance, abandon. |
| `frontend/src/app/components/tour-overlay.component.ts` | Voile percé, bulle, positionnement, repli. |
| `build.service.ts` / `timeline.service.ts` | Superposition en lecture, refus d'écriture sur les ids de démo. |
| `app-shell.component.ts` | Montage de l'overlay, bouton d'aide. |
| `home.component.ts`, `builds-list.component.ts`, `build-editor.component.ts`, `dashboard.component.ts`, `resultats-page.component.ts` | Attributs `data-tour` sur les cibles. |

**Lancer les tests** (depuis `frontend/`) :

```bash
export CHROME_BIN=/Users/lilia/.cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell
npx ng test --watch=false --browsers=ChromeHeadless
```

`require('puppeteer')` ne se résout pas dans ce dépôt : le chemin littéral est la seule voie. Suite actuelle : **301 SUCCESS**.

---

## Task 1 : données de démonstration

**Files:**
- Create: `frontend/src/app/services/demo-data.service.ts`
- Create: `frontend/src/app/services/demo-data.service.spec.ts`

- [ ] **Step 1 : écrire le test qui échoue**

Créer `frontend/src/app/services/demo-data.service.spec.ts` :

```ts
import { TestBed } from '@angular/core/testing';
import { DemoDataService, DEMO_BUILD_ID, DEMO_TIMELINE_ID } from './demo-data.service';
import { DeckCodeService } from './deck-code.service';

class StubDeckCode {
  decode = jasmine.createSpy('decode').and.resolveTo({
    spells: [
      { spellId: 'XEL_DEVOUEMENT', iconId: 2839 },
      { spellId: 'XEL_REGULATEUR', iconId: 5344 },
      { spellId: 'XEL_POINTE_HEURE', iconId: 767 },
      ...new Array(9).fill(null),
    ],
    passives: [{ passiveId: 'XEL_COURS_TEMPS', iconId: 785 }, ...new Array(5).fill(null)],
    unresolvedSpellIcons: [], unresolvedPassiveIcons: [],
    duplicateSpellIcons: [], duplicatePassiveIcons: [],
  });
}

let deck: StubDeckCode;

function service(): DemoDataService {
  deck = new StubDeckCode();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [DemoDataService, { provide: DeckCodeService, useValue: deck }],
  });
  return TestBed.inject(DemoDataService);
}

describe('DemoDataService', () => {
  it('est inactif au demarrage', () => {
    expect(service().active()).toBeFalse();
  });

  it('resout les sorts du build de demo depuis un code deck', async () => {
    const svc = service();
    await svc.activate();

    expect(deck.decode).toHaveBeenCalled();
    expect(svc.active()).toBeTrue();
    expect(svc.build().id).toBe(DEMO_BUILD_ID);
    expect(svc.build().classId).toBe('XEL');
    expect(svc.build().spellBar.spells[0]).toEqual({ spellId: 'XEL_DEVOUEMENT', iconId: 2839 });
    expect(svc.build().passiveBar.passives[0]).toEqual({ passiveId: 'XEL_COURS_TEMPS', iconId: 785 });
  });

  it('construit une timeline dont les actions visent les sorts resolus', async () => {
    const svc = service();
    await svc.activate();

    const timeline = svc.timeline();
    expect(timeline.id).toBe(DEMO_TIMELINE_ID);
    expect(timeline.buildId).toBe(DEMO_BUILD_ID);
    expect(timeline.steps.length).toBe(3);
    expect(timeline.steps[0].actions[0].spellId).toBe('XEL_DEVOUEMENT');
    expect(timeline.steps[2].actions[0].spellId).toBe('XEL_POINTE_HEURE');
  });

  it('reste utilisable si la resolution du code deck echoue', async () => {
    const svc = service();
    deck.decode.and.rejectWith(new Error('backend indisponible'));

    await svc.activate();

    expect(svc.active()).toBeTrue();
    expect(svc.build().spellBar.spells.every(s => s === null)).toBeTrue();
    expect(svc.timeline().steps.length).toBe(0);
  });

  it('ne resout le code deck qu une seule fois', async () => {
    const svc = service();
    await svc.activate();
    svc.deactivate();
    await svc.activate();

    expect(deck.decode).toHaveBeenCalledTimes(1);
  });

  it('reconnait les identifiants reserves', () => {
    const svc = service();
    expect(svc.isDemoId(DEMO_BUILD_ID)).toBeTrue();
    expect(svc.isDemoId(DEMO_TIMELINE_ID)).toBeTrue();
    expect(svc.isDemoId('build-reel-42')).toBeFalse();
  });

  it('deactivate remet le drapeau a false', async () => {
    const svc = service();
    await svc.activate();
    svc.deactivate();
    expect(svc.active()).toBeFalse();
  });
});
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

```bash
cd frontend
export CHROME_BIN=/Users/lilia/.cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell
npx ng test --watch=false --browsers=ChromeHeadless
```

Attendu : échec de compilation, `Cannot find module './demo-data.service'`.

- [ ] **Step 3 : écrire l'implémentation**

Créer `frontend/src/app/services/demo-data.service.ts` :

```ts
/**
 * Build et timeline de demonstration, montres pendant la visite guidee.
 *
 * Ces objets ne sont JAMAIS ecrits. `BuildService` et `TimelineService` les superposent a
 * leurs listes reelles tant que `active()` vaut vrai. Le nettoyage se reduit donc a
 * repasser un booleen a false : si l'utilisateur ferme l'onglet au milieu de la visite, la
 * demonstration disparait par construction et il n'y a rien qui puisse echouer.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { Build } from '../models/build.model';
import { Timeline } from '../models/timeline.model';
import { DeckCodeService } from './deck-code.service';

export const DEMO_BUILD_ID = '__demo__';
export const DEMO_TIMELINE_ID = '__demo-timeline__';

/**
 * Le build de demo est defini par son CODE DECK, pas par des identifiants en dur.
 *
 * Les ids servis par le backend ne sont pas ceux des JSON d'assets — cote passifs ils
 * different franchement. Passer par le code deck aligne la demo sur ce que sert vraiment
 * le backend, et la fait deriver avec lui au lieu de pourrir en silence.
 */
const DEMO_DECK_CODE =
  '2839-5344-767-771-765-772-777-766-1417-763-775-757-758-785-7190-7191-7192-0';

const DEMO_STATS = {
  level: 200,
  masteryFire: 0, masteryWater: 850, masteryEarth: 0, masteryAir: 0,
  masterySecondary: 0, backMastery: 120,
  masteryMelee: 0, masteryDistance: 200, masteryHealing: 0,
  dommageInflict: 30, critRate: 35, critMastery: 180,
  resistance: 250,
  ap: 12, mp: 4, wp: 6,
  range: 3,
};

@Injectable({ providedIn: 'root' })
export class DemoDataService {
  private readonly deckCode = inject(DeckCodeService);

  private readonly isActive = signal(false);
  private readonly demoBuild = signal<Build>(emptyDemoBuild());
  private readonly demoTimeline = signal<Timeline>(emptyDemoTimeline());
  private resolved = false;

  readonly active = computed(() => this.isActive());
  readonly build = computed(() => this.demoBuild());
  readonly timeline = computed(() => this.demoTimeline());

  /**
   * La resolution n'a lieu qu'une fois : rejouer la visite ne doit pas retaper le backend.
   * Un echec n'empeche PAS la visite — un build vide reste preferable a une visite qui
   * refuse de demarrer parce que le backend tousse.
   */
  async activate(): Promise<void> {
    if (!this.resolved) {
      this.resolved = true;
      try {
        const decoded = await this.deckCode.decode(DEMO_DECK_CODE, 'XEL');
        this.demoBuild.set({
          ...emptyDemoBuild(),
          spellBar: { spells: decoded.spells },
          passiveBar: { passives: decoded.passives },
        });
        this.demoTimeline.set(timelineFromSpells(decoded.spells));
      } catch {
        // Build vide : la visite reste jouable, les ecrans en aval seront simplement vides.
      }
    }
    this.isActive.set(true);
  }

  deactivate(): void {
    this.isActive.set(false);
  }

  isDemoId(id: string): boolean {
    return id === DEMO_BUILD_ID || id === DEMO_TIMELINE_ID;
  }
}

function emptyDemoBuild(): Build {
  return {
    id: DEMO_BUILD_ID,
    name: 'Build de démo',
    classId: 'XEL',
    characterLevel: 200,
    spellBar: { spells: new Array(12).fill(null) },
    passiveBar: { passives: new Array(6).fill(null) },
    sublimationBar: { sublimations: new Array(12).fill(null) },
    stats: { ...DEMO_STATS },
    description: 'Build d’exemple, visible uniquement pendant la visite guidée.',
  };
}

function emptyDemoTimeline(): Timeline {
  return {
    id: DEMO_TIMELINE_ID,
    name: 'Timeline de démo',
    buildId: DEMO_BUILD_ID,
    classId: 'XEL',
    steps: [],
  };
}

/** Trois lancers, batis sur les sorts REELLEMENT resolus : jamais d'id invente. */
function timelineFromSpells(spells: ReadonlyArray<{ spellId: string } | null>): Timeline {
  const casts = spells.filter((s): s is { spellId: string } => s !== null).slice(0, 3);
  return {
    ...emptyDemoTimeline(),
    steps: casts.map((spell, index) => ({
      id: `${DEMO_TIMELINE_ID}-step-${index}`,
      actions: [{
        id: `${DEMO_TIMELINE_ID}-action-${index}`,
        type: 'CastSpell' as const,
        order: index,
        spellId: spell.spellId,
      }],
      description: `Lancer ${index + 1}`,
    })),
  };
}
```

- [ ] **Step 4 : lancer les tests pour vérifier qu'ils passent**

Même commande. Attendu : les 7 specs de `DemoDataService` passent, suite à 308.

- [ ] **Step 5 : commiter**

```bash
git add frontend/src/app/services/demo-data.service.ts frontend/src/app/services/demo-data.service.spec.ts
git commit -m "feat(onboarding): donnees de demonstration en memoire"
```

---

## Task 2 : superposition dans les services de données

**Files:**
- Modify: `frontend/src/app/services/build.service.ts`
- Modify: `frontend/src/app/services/timeline.service.ts`
- Create: `frontend/src/app/services/demo-overlay.spec.ts`

- [ ] **Step 1 : écrire le test qui échoue**

Créer `frontend/src/app/services/demo-overlay.spec.ts` :

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BuildService } from './build.service';
import { TimelineService } from './timeline.service';
import { DemoDataService, DEMO_BUILD_ID, DEMO_TIMELINE_ID } from './demo-data.service';
import { WakfuApiService } from './wakfu-api.service';
import { SaveErrorService } from './save-error.service';
import { AuthService } from './auth.service';
import { signal } from '@angular/core';
import { Build } from '../models/build.model';
import { Timeline } from '../models/timeline.model';

function realBuild(): Build {
  return {
    id: 'reel-1', name: 'Mon build', classId: 'XEL', characterLevel: 200,
    spellBar: { spells: [] }, passiveBar: { passives: [] }, sublimationBar: { sublimations: [] },
    stats: {
      level: 200, masteryFire: 0, masteryWater: 0, masteryEarth: 0, masteryAir: 0,
      masterySecondary: 0, backMastery: 0, masteryMelee: 0, masteryDistance: 0, masteryHealing: 0,
      dommageInflict: 0, critRate: 0, critMastery: 0, resistance: 0, ap: 12, mp: 4, wp: 6, range: 3,
    },
  };
}

function realTimeline(): Timeline {
  return { id: 'tl-1', name: 'Ma timeline', buildId: 'reel-1', steps: [] };
}

class StubApi {
  getAllBuilds = () => of([realBuild()]);
  getAllTimelines = () => of([realTimeline()]);
  getAllPresets = () => of([]);
  updateBuild = jasmine.createSpy('updateBuild').and.returnValue(of(realBuild()));
  deleteBuild = jasmine.createSpy('deleteBuild').and.returnValue(of(true));
  updateTimeline = jasmine.createSpy('updateTimeline').and.returnValue(of(realTimeline()));
  deleteTimeline = jasmine.createSpy('deleteTimeline').and.returnValue(of(true));
}

class StubAuth { status = signal<'guest' | 'loading'>('guest'); }

let api: StubApi;
let demo: DemoDataService;

async function configure(): Promise<void> {
  api = new StubApi();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      BuildService, TimelineService, DemoDataService, SaveErrorService,
      { provide: WakfuApiService, useValue: api },
      { provide: AuthService, useValue: new StubAuth() },
    ],
  });
  demo = TestBed.inject(DemoDataService);
  await TestBed.inject(BuildService).loadBuilds();
  await TestBed.inject(TimelineService).loadTimelines();
}

describe('Superposition des donnees de demo', () => {
  it('visite inactive : les listes sont exactement les donnees reelles', async () => {
    await configure();
    const builds = TestBed.inject(BuildService);
    const timelines = TestBed.inject(TimelineService);

    expect(builds.allBuilds().map(b => b.id)).toEqual(['reel-1']);
    expect(timelines.allTimelines().map(t => t.id)).toEqual(['tl-1']);
  });

  it('visite active : la demo apparait en tete, sans effacer le reel', async () => {
    await configure();
    await demo.activate();
    const builds = TestBed.inject(BuildService);
    const timelines = TestBed.inject(TimelineService);

    expect(builds.allBuilds().map(b => b.id)).toEqual([DEMO_BUILD_ID, 'reel-1']);
    expect(timelines.allTimelines().map(t => t.id)).toEqual([DEMO_TIMELINE_ID, 'tl-1']);
  });

  it('desactiver restaure exactement la liste reelle', async () => {
    await configure();
    await demo.activate();
    demo.deactivate();

    expect(TestBed.inject(BuildService).allBuilds().map(b => b.id)).toEqual(['reel-1']);
  });

  it('toute ecriture sur un id de demo est refusee sans toucher au stockage', async () => {
    await configure();
    await demo.activate();
    const builds = TestBed.inject(BuildService);
    const timelines = TestBed.inject(TimelineService);

    expect(await builds.updateBuild(DEMO_BUILD_ID, { name: 'pirate' })).toBeFalse();
    expect(await builds.deleteBuild(DEMO_BUILD_ID)).toBeFalse();
    expect(await timelines.deleteTimeline(DEMO_TIMELINE_ID)).toBeFalse();

    expect(api.updateBuild).not.toHaveBeenCalled();
    expect(api.deleteBuild).not.toHaveBeenCalled();
    expect(api.deleteTimeline).not.toHaveBeenCalled();
  });

  it('les ecritures sur un build reel passent toujours', async () => {
    await configure();
    await demo.activate();

    expect(await TestBed.inject(BuildService).updateBuild('reel-1', { name: 'renomme' })).toBeTrue();
    expect(api.updateBuild).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

Même commande. Attendu : la spec « visite active » échoue — la liste ne contient que `reel-1`.

Si `StubApi` s'avère incomplet (méthode manquante appelée par un des deux services au chargement), compléter le stub avec la méthode réelle et son type de retour ; ne PAS retirer la spec.

- [ ] **Step 3 : implémenter la superposition dans `BuildService`**

Dans `frontend/src/app/services/build.service.ts`, ajouter l'import :

```ts
import { DemoDataService } from './demo-data.service';
```

Ajouter le champ juste avant le constructeur :

```ts
  private readonly demo = inject(DemoDataService);
```

et ajouter `inject` à l'import Angular existant (`import { Injectable, signal, computed, effect, inject } from '@angular/core';`).

Remplacer la ligne `public allBuilds = computed(() => this.builds());` par :

```ts
  /**
   * Le build de demo est SUPERPOSE, jamais stocke : il n'existe qu'en memoire, le temps de
   * la visite guidee. Le passer par le stockage l'ecrirait dans Supabase pour un
   * utilisateur connecte, et un abandon en cours de visite y laisserait un orphelin.
   */
  public allBuilds = computed(() =>
    this.demo.active() ? [this.demo.build(), ...this.builds()] : this.builds(),
  );
```

Ajouter le garde en première ligne de `updateBuild` et de `deleteBuild` :

```ts
    if (this.demo.isDemoId(buildId)) return false;
```

- [ ] **Step 4 : implémenter la superposition dans `TimelineService`**

Même traitement dans `frontend/src/app/services/timeline.service.ts` : importer `DemoDataService`, ajouter `private readonly demo = inject(DemoDataService);`, ajouter `inject` à l'import Angular, puis remplacer `public allTimelines = computed(() => this.timelines());` par :

```ts
  /** Superposee comme le build de demo, et pour la meme raison : rien n'est ecrit. */
  public allTimelines = computed(() =>
    this.demo.active() ? [this.demo.timeline(), ...this.timelines()] : this.timelines(),
  );
```

Ajouter `if (this.demo.isDemoId(timelineId)) return false;` en première ligne de `deleteTimeline`, et `if (this.demo.isDemoId(timelineId)) return null;` en première ligne de `updateTimeline` (elle retourne `Promise<Timeline | null>`, pas un booléen — vérifier la signature avant d'écrire).

- [ ] **Step 5 : lancer les tests**

Même commande. Attendu : les 5 nouvelles specs passent, suite à 313, **aucune régression** sur `build-service-save-errors.spec.ts` ni `data-reload-on-auth.spec.ts`.

- [ ] **Step 6 : commiter**

```bash
git add frontend/src/app/services/build.service.ts frontend/src/app/services/timeline.service.ts frontend/src/app/services/demo-overlay.spec.ts
git commit -m "feat(onboarding): superposition des donnees de demo en lecture seule"
```

---

## Task 3 : étapes et service de visite

**Files:**
- Create: `frontend/src/app/utils/tour-steps.ts`
- Create: `frontend/src/app/services/tour.service.ts`
- Create: `frontend/src/app/services/tour.service.spec.ts`

- [ ] **Step 1 : écrire les étapes en données**

Créer `frontend/src/app/utils/tour-steps.ts` :

```ts
/**
 * Les etapes de la visite guidee, en DONNEES.
 *
 * Les cibles sont designees par un attribut `data-tour`, jamais par une classe CSS : une
 * classe se renomme au fil d'un restylage sans que personne ne pense a la visite, alors
 * qu'un `data-tour` est un contrat explicite qu'on ne casse pas par accident.
 *
 * Cinq etapes, pas davantage : l'abandon grimpe fortement au-dela de quatre ou cinq, et
 * couvrir chaque ecran couterait plus d'abandons que cela n'apporterait de comprehension.
 * L'ecran Comparaison est volontairement absent — c'est aujourd'hui une page vide.
 */

export interface TourStep {
  id: string;
  route: string;
  target: string;
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: ReadonlyArray<TourStep> = [
  {
    id: 'accueil',
    route: '/accueil',
    target: '[data-tour="accueil-cartes"]',
    title: 'Par où commencer',
    body: 'Tout part d’un build. Une fois qu’il existe, les timelines, le freeplay et les résultats s’enchaînent.',
    placement: 'bottom',
  },
  {
    id: 'builds',
    route: '/builds',
    target: '[data-tour="builds-nouveau"]',
    title: 'Tes personnages',
    body: 'Chaque build regroupe une classe, ses sorts, ses passifs et ses stats. Un build de démo est affiché le temps de la visite.',
    placement: 'bottom',
  },
  {
    id: 'code-deck',
    route: '/builds/nouveau',
    target: '[data-tour="code-deck"]',
    title: 'Colle ton deck du jeu',
    body: 'Copie ton code deck depuis Wakfu et colle-le ici : les 12 sorts et les 6 passifs se remplissent d’un coup. Le bouton Copier fait l’inverse.',
    placement: 'bottom',
  },
  {
    id: 'timeline',
    route: '/timelines',
    target: '[data-tour="timeline-selecteur"]',
    title: 'Compose ton tour',
    body: 'Une timeline est une suite d’actions. Enchaîne tes lancers dans l’ordre où tu les jouerais.',
    placement: 'bottom',
  },
  {
    id: 'resultats',
    route: '/resultats',
    target: '[data-tour="resultats-degats"]',
    title: 'Lis tes dégâts',
    body: 'Le détail de ce que ton tour a produit. Le Freeplay, lui, te laisse tester la même chose librement sur la carte.',
    placement: 'top',
  },
];
```

- [ ] **Step 2 : écrire le test qui échoue**

Créer `frontend/src/app/services/tour.service.spec.ts` :

```ts
import { TestBed } from '@angular/core/testing';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { TourService, TOUR_SEEN_KEY } from './tour.service';
import { DemoDataService } from './demo-data.service';
import { TOUR_STEPS } from '../utils/tour-steps';

class StubRouter {
  events = new Subject<any>();
  url = '/accueil';
  navigateByUrl = jasmine.createSpy('navigateByUrl').and.callFake((u: string) => {
    this.url = u;
    return Promise.resolve(true);
  });
}

class StubDemo {
  activate = jasmine.createSpy('activate').and.resolveTo(undefined);
  deactivate = jasmine.createSpy('deactivate');
}

let router: StubRouter;
let demo: StubDemo;

function service(): TourService {
  localStorage.removeItem(TOUR_SEEN_KEY);
  router = new StubRouter();
  demo = new StubDemo();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      TourService,
      { provide: Router, useValue: router },
      { provide: DemoDataService, useValue: demo },
    ],
  });
  return TestBed.inject(TourService);
}

describe('TourService', () => {
  afterEach(() => localStorage.removeItem(TOUR_SEEN_KEY));

  it('demarre inactif', () => {
    const svc = service();
    expect(svc.active()).toBeFalse();
    expect(svc.stepIndex()).toBe(0);
  });

  it('start active la demo et navigue vers la premiere etape', async () => {
    const svc = service();
    await svc.start();

    expect(demo.activate).toHaveBeenCalled();
    expect(svc.active()).toBeTrue();
    expect(router.navigateByUrl).toHaveBeenCalledWith(TOUR_STEPS[0].route);
  });

  it('next avance et navigue vers la route de l etape', async () => {
    const svc = service();
    await svc.start();
    await svc.next();

    expect(svc.stepIndex()).toBe(1);
    expect(svc.currentStep()?.id).toBe(TOUR_STEPS[1].id);
    expect(router.navigateByUrl).toHaveBeenCalledWith(TOUR_STEPS[1].route);
  });

  it('previous recule sans passer sous zero', async () => {
    const svc = service();
    await svc.start();
    await svc.previous();

    expect(svc.stepIndex()).toBe(0);
  });

  it('next sur la derniere etape termine la visite', async () => {
    const svc = service();
    await svc.start();
    for (let i = 0; i < TOUR_STEPS.length; i++) await svc.next();

    expect(svc.active()).toBeFalse();
    expect(demo.deactivate).toHaveBeenCalled();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('1');
  });

  it('skip termine, desactive la demo et marque vu', async () => {
    const svc = service();
    await svc.start();
    svc.skip();

    expect(svc.active()).toBeFalse();
    expect(demo.deactivate).toHaveBeenCalled();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('1');
  });

  it('shouldAutoStart est vrai une seule fois', async () => {
    const svc = service();
    expect(svc.shouldAutoStart()).toBeTrue();
    await svc.start();
    svc.skip();
    expect(svc.shouldAutoStart()).toBeFalse();
  });

  it('rejouer repart de la premiere etape', async () => {
    const svc = service();
    await svc.start();
    await svc.next();
    svc.skip();
    await svc.start();

    expect(svc.stepIndex()).toBe(0);
    expect(svc.active()).toBeTrue();
  });

  it('une navigation hors parcours termine la visite', async () => {
    const svc = service();
    await svc.start();

    router.events.next(new NavigationEnd(1, '/galerie', '/galerie'));

    expect(svc.active()).toBeFalse();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('1');
  });

  it('la navigation pilotee par la visite ne l interrompt pas', async () => {
    const svc = service();
    await svc.start();
    await svc.next();

    router.events.next(new NavigationEnd(2, TOUR_STEPS[1].route, TOUR_STEPS[1].route));

    expect(svc.active()).toBeTrue();
    expect(svc.stepIndex()).toBe(1);
  });
});
```

- [ ] **Step 3 : lancer les tests pour vérifier qu'ils échouent**

Même commande. Attendu : `Cannot find module './tour.service'`.

- [ ] **Step 4 : écrire l'implémentation**

Créer `frontend/src/app/services/tour.service.ts` :

```ts
/**
 * Progression de la visite guidee.
 *
 * Le service navigue lui-meme vers la route de chaque etape. Il doit donc distinguer SA
 * navigation de celle de l'utilisateur : partir ailleurs de son plein gre met fin a la
 * visite, changer d'etape non. La distinction passe par un drapeau leve le temps de la
 * navigation pilotee, et NON par une comparaison d'URL — comparer se ferait piéger par les
 * redirections et les parametres de requete.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { DemoDataService } from './demo-data.service';
import { TOUR_STEPS, TourStep } from '../utils/tour-steps';

export const TOUR_SEEN_KEY = 'wakfu-onboarding-vu';

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly router = inject(Router);
  private readonly demo = inject(DemoDataService);

  private readonly isActive = signal(false);
  private readonly index = signal(0);
  private navigatingSelf = false;

  readonly active = computed(() => this.isActive());
  readonly stepIndex = computed(() => this.index());
  readonly steps = TOUR_STEPS;
  readonly currentStep = computed<TourStep | null>(() =>
    this.isActive() ? TOUR_STEPS[this.index()] ?? null : null,
  );

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isActive() && !this.navigatingSelf) {
          this.finish();
        }
        this.navigatingSelf = false;
      });
  }

  /** Vrai tant que l'utilisateur n'a ni termine ni passe la visite. */
  shouldAutoStart(): boolean {
    return this.readSeen() === null;
  }

  async start(): Promise<void> {
    await this.demo.activate();
    this.index.set(0);
    this.isActive.set(true);
    await this.goTo(TOUR_STEPS[0]);
  }

  async next(): Promise<void> {
    const target = this.index() + 1;
    if (target >= TOUR_STEPS.length) {
      this.finish();
      return;
    }
    this.index.set(target);
    await this.goTo(TOUR_STEPS[target]);
  }

  async previous(): Promise<void> {
    const target = this.index() - 1;
    if (target < 0) {
      return;
    }
    this.index.set(target);
    await this.goTo(TOUR_STEPS[target]);
  }

  /** Passer vaut terminer : quelqu'un qui passe a choisi, on ne le relance pas. */
  skip(): void {
    this.finish();
  }

  finish(): void {
    this.isActive.set(false);
    this.demo.deactivate();
    this.writeSeen();
  }

  private async goTo(step: TourStep): Promise<void> {
    this.navigatingSelf = true;
    await this.router.navigateByUrl(step.route);
  }

  // localStorage peut lever : navigation privee, quota, stockage desactive. Un onboarding
  // ne doit jamais empecher l'application de demarrer pour si peu.
  private readSeen(): string | null {
    try {
      return localStorage.getItem(TOUR_SEEN_KEY);
    } catch {
      return '1';
    }
  }

  private writeSeen(): void {
    try {
      localStorage.setItem(TOUR_SEEN_KEY, '1');
    } catch {
      // Sans stockage la visite se relancera au prochain passage : desagreable, pas grave.
    }
  }
}
```

- [ ] **Step 5 : lancer les tests**

Même commande. Attendu : les 11 specs de `TourService` passent, suite à 324.

- [ ] **Step 6 : commiter**

```bash
git add frontend/src/app/utils/tour-steps.ts frontend/src/app/services/tour.service.ts frontend/src/app/services/tour.service.spec.ts
git commit -m "feat(onboarding): etapes declaratives et service de visite"
```

---

## Task 4 : overlay

**Files:**
- Create: `frontend/src/app/components/tour-overlay.component.ts`
- Create: `frontend/src/app/components/tour-overlay.component.spec.ts`

- [ ] **Step 1 : écrire le test qui échoue**

Créer `frontend/src/app/components/tour-overlay.component.spec.ts` :

```ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TourOverlayComponent } from './tour-overlay.component';
import { TourService } from '../services/tour.service';
import { TourStep } from '../utils/tour-steps';

const STEP: TourStep = {
  id: 'code-deck', route: '/builds/nouveau', target: '[data-tour="cible-test"]',
  title: 'Colle ton deck', body: 'Texte de l etape.', placement: 'bottom',
};

class StubTour {
  active = signal(true);
  stepIndex = signal(2);
  currentStep = signal<TourStep | null>(STEP);
  steps = new Array(5);
  next = jasmine.createSpy('next').and.resolveTo(undefined);
  previous = jasmine.createSpy('previous').and.resolveTo(undefined);
  skip = jasmine.createSpy('skip');
}

let tour: StubTour;

function mount(withTarget: boolean) {
  document.querySelectorAll('[data-tour="cible-test"]').forEach(e => e.remove());
  if (withTarget) {
    const el = document.createElement('div');
    el.setAttribute('data-tour', 'cible-test');
    el.style.cssText = 'position:fixed;top:100px;left:50px;width:200px;height:40px;';
    document.body.appendChild(el);
  }
  tour = new StubTour();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TourOverlayComponent],
    providers: [{ provide: TourService, useValue: tour }],
  });
  const fixture = TestBed.createComponent(TourOverlayComponent);
  fixture.detectChanges();
  return fixture;
}

describe('TourOverlayComponent', () => {
  afterEach(() => document.querySelectorAll('[data-tour="cible-test"]').forEach(e => e.remove()));

  it('affiche le titre et le corps de l etape', () => {
    const fixture = mount(true);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Colle ton deck');
    expect(text).toContain('Texte de l etape.');
  });

  it('affiche la progression', () => {
    const fixture = mount(true);
    expect(fixture.nativeElement.textContent).toContain('3 / 5');
  });

  it('se positionne d apres le rectangle de la cible', () => {
    const fixture = mount(true);
    expect(fixture.componentInstance.spotlight()).not.toBeNull();
    expect(fixture.componentInstance.spotlight()!.top).toBe(100);
  });

  it('cible absente : repli centre, aucune erreur, etape franchissable', () => {
    const fixture = mount(false);

    expect(fixture.componentInstance.spotlight()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Colle ton deck');
    const suivant = [...fixture.nativeElement.querySelectorAll('button')]
      .find((b: HTMLButtonElement) => b.textContent!.trim() === 'Suivant') as HTMLButtonElement;
    suivant.click();
    expect(tour.next).toHaveBeenCalled();
  });

  it('Passer termine la visite', () => {
    const fixture = mount(true);
    const passer = [...fixture.nativeElement.querySelectorAll('button')]
      .find((b: HTMLButtonElement) => b.textContent!.trim() === 'Passer') as HTMLButtonElement;
    passer.click();
    expect(tour.skip).toHaveBeenCalled();
  });

  it('Echap termine la visite', () => {
    mount(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tour.skip).toHaveBeenCalled();
  });

  it('ne rend rien quand la visite est inactive', () => {
    const fixture = mount(true);
    tour.active.set(false);
    tour.currentStep.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
```

- [ ] **Step 2 : lancer les tests pour vérifier qu'ils échouent**

Même commande. Attendu : `Cannot find module './tour-overlay.component'`.

- [ ] **Step 3 : écrire l'implémentation**

Créer `frontend/src/app/components/tour-overlay.component.ts` :

```ts
/**
 * Voile de la visite guidee, avec un trou sur l'element mis en avant.
 *
 * Semi-bloquant : le voile intercepte les clics partout SAUF sur la zone eclairee, qui
 * reste utilisable. Echap et « Passer » quittent a tout moment.
 *
 * Cible absente — element non rendu, ecran trop etroit, chargement en cours — la bulle se
 * centre sans surbrillance et la visite continue. C'est le mode de defaillance le plus
 * courant d'une visite guidee : il se concoit, il ne se decouvre pas.
 */

import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { TourService } from '../services/tour.service';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 6;

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  template: `
    @if (tour.currentStep(); as step) {
      <div class="tour-veil" [style.clip-path]="veilClip()"></div>
      <div class="tour-bubble" [class.centered]="spotlight() === null" [style.top.px]="bubbleTop()" [style.left.px]="bubbleLeft()" role="dialog" aria-modal="true">
        <h2>{{ step.title }}</h2>
        <p>{{ step.body }}</p>
        <div class="tour-foot">
          <span class="tour-progress">{{ tour.stepIndex() + 1 }} / {{ tour.steps.length }}</span>
          <span class="tour-spacer"></span>
          <button type="button" class="tour-ghost" (click)="tour.skip()">Passer</button>
          @if (tour.stepIndex() > 0) {
            <button type="button" class="tour-ghost" (click)="tour.previous()">Précédent</button>
          }
          <button type="button" class="tour-primary" (click)="tour.next()">Suivant</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .tour-veil { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); z-index: 900; }
    .tour-bubble {
      position: fixed; z-index: 901; width: min(340px, calc(100vw - 32px));
      background: var(--app-surface); color: var(--app-text);
      border: 1px solid var(--app-border); border-radius: 12px; padding: 16px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    }
    .tour-bubble.centered { top: 50% !important; left: 50% !important; transform: translate(-50%, -50%); }
    .tour-bubble h2 { margin: 0 0 6px; font-size: 16px; }
    .tour-bubble p { margin: 0 0 14px; font-size: 14px; color: var(--app-text-muted); }
    .tour-foot { display: flex; align-items: center; gap: 8px; }
    .tour-progress { font-size: 12px; color: var(--app-text-muted); }
    .tour-spacer { flex: 1 1 auto; }
    .tour-ghost, .tour-primary { padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; }
    .tour-ghost { background: transparent; border: 1px solid var(--app-border); color: var(--app-text); }
    .tour-primary { background: var(--app-accent); border: 0; color: var(--app-accent-contrast); }
    .tour-ghost:focus-visible, .tour-primary:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; }
  `],
})
export class TourOverlayComponent {
  protected readonly tour = inject(TourService);

  readonly spotlight = signal<SpotlightRect | null>(null);

  constructor() {
    // Deux mesures, et les deux sont necessaires. L'immediate sert quand la cible est deja
    // a l'ecran — c'est le cas au montage et lors d'un retour en arriere. La differee sert
    // quand l'etape vient de declencher une navigation : l'ecran cible n'est alors pas
    // encore rendu, et une mesure unique ne trouverait jamais l'element.
    effect(() => {
      const step = this.tour.currentStep();
      if (!step) {
        this.spotlight.set(null);
        return;
      }
      this.measure(step.target);
      setTimeout(() => this.measure(step.target), 50);
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.tour.active()) {
      this.tour.skip();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    const step = this.tour.currentStep();
    if (step) {
      this.measure(step.target);
    }
  }

  private measure(selector: string): void {
    const el = document.querySelector(selector);
    if (!el) {
      this.spotlight.set(null);
      return;
    }
    const r = el.getBoundingClientRect();
    this.spotlight.set({
      top: r.top - PADDING,
      left: r.left - PADDING,
      width: r.width + PADDING * 2,
      height: r.height + PADDING * 2,
    });
  }

  /** Rectangle exterieur puis rectangle interieur en sens inverse : le trou du voile. */
  protected readonly veilClip = computed(() => {
    const s = this.spotlight();
    if (!s) {
      return 'none';
    }
    const { top, left, width, height } = s;
    return `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${left}px ${top}px, ${left}px ${top + height}px, ${left + width}px ${top + height}px, ${left + width}px ${top}px, ${left}px ${top}px)`;
  });

  protected readonly bubbleTop = computed(() => {
    const s = this.spotlight();
    const step = this.tour.currentStep();
    if (!s || !step) return 0;
    return step.placement === 'top' ? Math.max(8, s.top - 190) : s.top + s.height + 12;
  });

  protected readonly bubbleLeft = computed(() => {
    const s = this.spotlight();
    if (!s) return 0;
    return Math.max(16, Math.min(s.left, window.innerWidth - 356));
  });
}
```

- [ ] **Step 4 : lancer les tests**

Même commande. Attendu : les 8 specs passent, suite à 332.

- [ ] **Step 5 : commiter**

```bash
git add frontend/src/app/components/tour-overlay.component.ts frontend/src/app/components/tour-overlay.component.spec.ts
git commit -m "feat(onboarding): overlay de visite guidee"
```

---

## Task 5 : câblage dans l'interface

**Files:**
- Modify: `frontend/src/app/layout/app-shell.component.ts`
- Modify: `frontend/src/app/pages/home.component.ts`
- Modify: `frontend/src/app/pages/builds-list.component.ts`
- Modify: `frontend/src/app/pages/build-editor.component.ts`
- Modify: `frontend/src/app/components/dashboard.component.ts`
- Modify: `frontend/src/app/pages/resultats-page.component.ts`
- Modify: `frontend/src/app/pages/builds-list.component.spec.ts`

- [ ] **Step 1 : écrire le test qui échoue**

Le fichier existant remplace entièrement `BuildService` par un `StubBuildService` dont
`allBuilds` est un signal. La superposition de `DemoDataService` ne s'y applique donc pas,
et c'est très bien : ce qu'on teste ici, c'est la décision du COMPOSANT face à un build
portant l'identifiant de démo. Il suffit d'en glisser un dans le stub.

Ajouter cet import en haut de `frontend/src/app/pages/builds-list.component.spec.ts` :

```ts
import { DEMO_BUILD_ID } from '../services/demo-data.service';
```

Puis ajouter ce `describe` à la fin du fichier :

```ts
describe('BuildsListComponent — build de demo', () => {
  it('masque Modifier et Supprimer sur le build de demo, pas sur les autres', () => {
    const stub = new StubBuildService();
    stub.allBuilds.set([makeBuild(DEMO_BUILD_ID, 'Build de démo'), makeBuild('b2', 'Burst')]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BuildsListComponent],
      providers: [provideRouter([]), { provide: BuildService, useValue: stub }],
    });

    const fixture = TestBed.createComponent(BuildsListComponent);
    fixture.detectChanges();

    const cartes = [...fixture.nativeElement.querySelectorAll('article.card')] as HTMLElement[];
    const carteDemo = cartes.find(c => c.textContent!.includes('Build de démo'))!;
    const carteReelle = cartes.find(c => c.textContent!.includes('Burst'))!;

    expect(carteDemo.textContent).not.toContain('Modifier');
    expect(carteDemo.textContent).not.toContain('Supprimer');
    expect(carteDemo.textContent).toContain('Sélectionner');
    expect(carteReelle.textContent).toContain('Modifier');
    expect(carteReelle.textContent).toContain('Supprimer');
  });
});
```

`StubBuildService` et `makeBuild` sont déjà définis en haut du fichier : les réutiliser, ne
pas en écrire de nouveaux.

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

Même commande. Attendu : échec — la carte de démo affiche encore « Modifier ».

- [ ] **Step 3 : poser les attributs `data-tour`**

Cinq modifications de template, une par cible. Chaque attribut doit correspondre EXACTEMENT au sélecteur de `tour-steps.ts`.

`home.component.ts` — sur le conteneur des cartes :
```html
      <div class="cards" data-tour="accueil-cartes">
```

`builds-list.component.ts` — sur le bouton de l'en-tête (celui du `.builds-head`, pas celui de l'état vide) :
```html
        <button ui-button variant="primary" (click)="createBuild()" data-tour="builds-nouveau">
```

`build-editor.component.ts` — sur la section de la carte Code deck :
```html
          <section class="card" data-tour="code-deck">
            <h2>Code deck</h2>
```

`dashboard.component.ts` — sur le `.selector-group` du sélecteur **Timeline** (le second, pas celui du Build) :
```html
          <div class="selector-group" data-tour="timeline-selecteur">
            <label class="selector-label">Timeline</label>
```

`resultats-page.component.ts` — sur le résumé des dégâts :
```html
      <app-damage-summary data-tour="resultats-degats"></app-damage-summary>
```

- [ ] **Step 4 : masquer les actions sur le build de démo**

Dans `builds-list.component.ts`, ajouter les imports :

```ts
import { DemoDataService, DEMO_BUILD_ID } from '../services/demo-data.service';
```

Ajouter le champ dans la classe :

```ts
  private readonly demo = inject(DemoDataService);

  /**
   * Le build de demo n'existe qu'en memoire : ouvrir l'editeur dessus donnerait un ecran
   * incoherent, et le supprimer n'aurait rien a supprimer. On retire les deux actions
   * plutot que de rattraper le probleme apres coup.
   */
  protected isDemo(build: Build): boolean {
    return build.id === DEMO_BUILD_ID;
  }
```

Envelopper les deux boutons dans le template :

```html
                @if (!isDemo(build)) {
                  <button ui-button variant="ghost" (click)="editBuild(build)" [attr.aria-label]="'Modifier ' + build.name">Modifier</button>
                  <button ui-button variant="danger" (click)="deleteBuild(build)" [attr.aria-label]="'Supprimer ' + build.name">Supprimer</button>
                }
```

- [ ] **Step 5 : monter l'overlay et le bouton d'aide dans la coquille**

Dans `frontend/src/app/layout/app-shell.component.ts` :

Ajouter aux imports du fichier :
```ts
import { TourOverlayComponent } from '../components/tour-overlay.component';
import { TourService } from '../services/tour.service';
```

Ajouter `TourOverlayComponent` au tableau `imports` du décorateur.

Ajouter le bouton d'aide dans l'`appbar`, juste avant `<ui-theme-toggle>` :
```html
          <button
            type="button"
            class="menu-btn"
            (click)="tour.start()"
            title="Revoir la visite guidée"
            aria-label="Revoir la visite guidée"
          >
            <ui-icon name="help"></ui-icon>
          </button>
```

Vérifier que l'icône `help` existe dans `frontend/src/app/ui/icon.component.ts`. Si elle n'y est pas, utiliser une icône déjà présente plutôt que d'en inventer une, et le signaler dans le rapport.

Ajouter l'overlay juste avant la fermeture de `.shell` :
```html
      <app-tour-overlay></app-tour-overlay>
```

Ajouter dans la classe :
```ts
  protected readonly tour = inject(TourService);
```

- [ ] **Step 6 : démarrer la visite au premier passage**

Dans `frontend/src/app/pages/home.component.ts`, ajouter les imports :

```ts
import { inject } from '@angular/core';
import { TourService } from '../services/tour.service';
```

et le constructeur :

```ts
  private readonly tour = inject(TourService);

  constructor() {
    // Le declenchement vit sur l'accueil, pas dans la coquille : c'est la seule page dont
    // on est sur qu'un nouvel arrivant la traverse, et la premiere etape la vise deja.
    if (this.tour.shouldAutoStart()) {
      void this.tour.start();
    }
  }
```

- [ ] **Step 7 : lancer les tests et la compilation de production**

```bash
cd frontend
export CHROME_BIN=/Users/lilia/.cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell
npx ng test --watch=false --browsers=ChromeHeadless
npx ng build
```

Attendu : la nouvelle spec passe, aucune régression, build sans erreur TypeScript.

- [ ] **Step 8 : commiter**

```bash
git add frontend/src/app
git commit -m "feat(onboarding): cablage de la visite dans l interface"
```

---

## Task 6 : vérification navigateur

**Files:** aucun (validation seule)

- [ ] **Step 1 : lancer le front et vider l'état**

Démarrer le serveur de dev, ouvrir l'application, puis dans la console : `localStorage.removeItem('wakfu-onboarding-vu')` et recharger.

- [ ] **Step 2 : vérifier le démarrage automatique**

Attendu : la visite s'ouvre seule sur l'accueil, les cartes de navigation sont éclairées, la bulle affiche « 1 / 5 ».

- [ ] **Step 3 : dérouler les cinq étapes**

Cliquer « Suivant » quatre fois. Attendu : navigation vers `/builds`, `/builds/nouveau`, `/timelines`, `/resultats`, avec à chaque fois la bonne zone éclairée. Vérifier qu'aucune erreur `NG0100` ni exception n'apparaît en console.

- [ ] **Step 4 : vérifier le build de démo**

Pendant la visite, sur `/builds` : « Build de démo » apparaît en tête, **sans** boutons Modifier ni Supprimer. Sur `/resultats`, le résumé des dégâts est peuplé.

- [ ] **Step 5 : vérifier la disparition**

Terminer la visite. Attendu : « Build de démo » disparaît de la liste, la timeline de démo disparaît du sélecteur, et les builds réels sont intacts.

- [ ] **Step 6 : vérifier la persistance et la relecture**

Recharger : la visite ne se relance pas. Cliquer le bouton d'aide : elle repart de l'étape 1.

- [ ] **Step 7 : vérifier l'abandon**

Relancer la visite, puis cliquer « Galerie » dans la barre latérale. Attendu : la visite se termine, la démo disparaît, aucune erreur.

- [ ] **Step 8 : vérifier le repli sans cible**

Dans la console, pendant l'étape 3 : `document.querySelector('[data-tour="code-deck"]').removeAttribute('data-tour')`, puis passer à l'étape suivante et revenir. Attendu : bulle centrée, pas de surbrillance, aucune erreur, « Suivant » fonctionne toujours.

- [ ] **Step 9 : commiter les correctifs éventuels**

```bash
git add -A
git commit -m "fix(onboarding): corrections issues de la verification manuelle"
```

---

## Couverture de la spec

| Exigence | Task |
| --- | --- |
| Build et timeline de démo en mémoire seule | 1 |
| Résolution par code deck (pas d'ids en dur) | 1 |
| Superposition dans les deux services | 2 |
| Refus d'écriture sur les ids `__demo__` | 2 |
| Listes réelles inchangées hors visite | 2 |
| Cinq étapes en données, ciblage `data-tour` | 3 |
| Progression, navigation, bornes | 3 |
| Persistance posée au `finish` comme au `skip` | 3 |
| Abandon par navigation hors parcours | 3 |
| `localStorage` indisponible | 3 |
| Voile semi-bloquant, Échap, « Passer » | 4 |
| Repli si la cible est absente | 4 |
| Actions masquées sur la carte de démo | 5 |
| Montage de l'overlay, bouton d'aide | 5 |
| Démarrage automatique au premier passage | 5 |
| Comparaison exclue du parcours | 3 (absente de `TOUR_STEPS`) |
