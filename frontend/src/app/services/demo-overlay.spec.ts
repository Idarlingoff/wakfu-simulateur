import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { BuildService } from './build.service';
import { TimelineService } from './timeline.service';
import { DemoDataService, DEMO_BUILD_ID, DEMO_TIMELINE_ID } from './demo-data.service';
import { WakfuApiService } from './wakfu-api.service';
import { SaveErrorService } from './save-error.service';
import { AuthService } from './auth.service';
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
    expect(TestBed.inject(BuildService).allBuilds().map(b => b.id)).toEqual(['reel-1']);
    expect(TestBed.inject(TimelineService).allTimelines().map(t => t.id)).toEqual(['tl-1']);
  });

  it('visite active : la demo apparait en tete, sans effacer le reel', async () => {
    await configure();
    await demo.activate();

    expect(TestBed.inject(BuildService).allBuilds().map(b => b.id)).toEqual([DEMO_BUILD_ID, 'reel-1']);
    expect(TestBed.inject(TimelineService).allTimelines().map(t => t.id)).toEqual([DEMO_TIMELINE_ID, 'tl-1']);
  });

  it('desactiver restaure exactement la liste reelle', async () => {
    await configure();
    await demo.activate();
    demo.deactivate();

    expect(TestBed.inject(BuildService).allBuilds().map(b => b.id)).toEqual(['reel-1']);
    expect(TestBed.inject(TimelineService).allTimelines().map(t => t.id)).toEqual(['tl-1']);
  });

  it('toute ecriture sur un id de demo est refusee sans toucher au stockage', async () => {
    await configure();
    await demo.activate();
    const builds = TestBed.inject(BuildService);
    const timelines = TestBed.inject(TimelineService);

    expect(await builds.updateBuild(DEMO_BUILD_ID, { name: 'pirate' })).toBeFalse();
    expect(await builds.deleteBuild(DEMO_BUILD_ID)).toBeFalse();
    expect(await timelines.deleteTimeline(DEMO_TIMELINE_ID)).toBeFalse();
    expect(await timelines.updateTimeline(DEMO_TIMELINE_ID, { name: 'pirate' })).toBeNull();

    expect(api.updateBuild).not.toHaveBeenCalled();
    expect(api.deleteBuild).not.toHaveBeenCalled();
    expect(api.deleteTimeline).not.toHaveBeenCalled();
    expect(api.updateTimeline).not.toHaveBeenCalled();
  });

  it('les ecritures sur un build reel passent toujours', async () => {
    await configure();
    await demo.activate();

    expect(await TestBed.inject(BuildService).updateBuild('reel-1', { name: 'renomme' })).toBeTrue();
    expect(api.updateBuild).toHaveBeenCalled();
  });

  it('le build de demo est selectionnable pendant la visite', async () => {
    await configure();
    await demo.activate();
    const builds = TestBed.inject(BuildService);

    builds.selectBuildA(builds.allBuilds().find(b => b.id === DEMO_BUILD_ID)!);

    expect(builds.selectedBuildA()?.id).toBe(DEMO_BUILD_ID);
  });

  it('getBuildById voit la demo pendant la visite, plus apres', async () => {
    await configure();
    const builds = TestBed.inject(BuildService);

    await demo.activate();
    expect(builds.getBuildById(DEMO_BUILD_ID)?.name).toBe('Build de démo');

    demo.deactivate();
    expect(builds.getBuildById(DEMO_BUILD_ID)).toBeUndefined();
  });

  it('la timeline de demo peut devenir la timeline courante', async () => {
    await configure();
    await demo.activate();
    const timelines = TestBed.inject(TimelineService);

    timelines.loadTimeline(DEMO_TIMELINE_ID);

    expect(timelines.currentTimeline()?.id).toBe(DEMO_TIMELINE_ID);
  });
});
