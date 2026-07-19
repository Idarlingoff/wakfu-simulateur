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
