import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LocalDataImportService } from './local-data-import.service';
import { LocalBuildRepository } from './local-build.repository';
import { LocalTimelineRepository } from './local-timeline.repository';
import { SupabaseBuildRepository } from './supabase-build.repository';
import { SupabaseTimelineRepository } from './supabase-timeline.repository';
import { AuthService } from '../auth.service';
import { Build } from '../../models/build.model';
import { Timeline } from '../../models/timeline.model';

const build = (id: string) => ({ id, name: `build ${id}`, classId: 'XEL' } as unknown as Build);
const timeline = (id: string, buildId: string) =>
  ({ id, name: `tl ${id}`, buildId, steps: [] } as unknown as Timeline);

function configure(localBuilds: Build[], localTimelines: Timeline[]) {
  const created = { builds: [] as Build[], timelines: [] as Timeline[] };
  TestBed.configureTestingModule({
    providers: [
      LocalDataImportService,
      { provide: LocalBuildRepository, useValue: { getAll: () => of(localBuilds) } },
      { provide: LocalTimelineRepository, useValue: { getAll: () => of(localTimelines) } },
      {
        provide: SupabaseBuildRepository,
        useValue: { create: (b: Build) => { created.builds.push(b); return of(b); } },
      },
      {
        provide: SupabaseTimelineRepository,
        useValue: { create: (t: Timeline) => { created.timelines.push(t); return of(t); } },
      },
      { provide: AuthService, useValue: { userId: () => 'u1' } },
    ],
  });
  return { service: TestBed.inject(LocalDataImportService), created };
}

describe('LocalDataImportService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('liste les donnees locales importables', async () => {
    const { service } = configure([build('b1')], [timeline('t1', 'b1')]);
    const preview = await service.preview();
    expect(preview.builds.length).toBe(1);
    expect(preview.timelines.length).toBe(1);
  });

  it('genere de nouveaux ids et reecrit timeline.buildId', async () => {
    const { service, created } = configure([build('b1')], [timeline('t1', 'b1')]);
    await service.importSelected({ buildIds: ['b1'], timelineIds: ['t1'] });

    const nouveauBuild = created.builds[0];
    const nouvelleTimeline = created.timelines[0];
    expect(nouveauBuild.id).not.toBe('b1');
    expect(nouvelleTimeline.id).not.toBe('t1');
    // Sans ce remap, la timeline importee pointerait vers un build inexistant.
    expect(nouvelleTimeline.buildId).toBe(nouveauBuild.id);
  });

  it('embarque le build requis meme s il n est pas coche', async () => {
    const { service, created } = configure([build('b1')], [timeline('t1', 'b1')]);
    await service.importSelected({ buildIds: [], timelineIds: ['t1'] });
    expect(created.builds.length).toBe(1);
    expect(created.timelines[0].buildId).toBe(created.builds[0].id);
  });

  it('n importe pas ce qui n est pas coche', async () => {
    const { service, created } = configure([build('b1'), build('b2')], []);
    await service.importSelected({ buildIds: ['b1'], timelineIds: [] });
    expect(created.builds.length).toBe(1);
    expect(created.builds[0].name).toBe('build b1');
  });

  it('pose le flag apres un import reussi', async () => {
    const { service } = configure([build('b1')], []);
    expect(service.alreadyImported()).toBe(false);
    await service.importSelected({ buildIds: ['b1'], timelineIds: [] });
    expect(service.alreadyImported()).toBe(true);
  });

  it('ne detruit pas les donnees locales', async () => {
    localStorage.setItem('wakfu_builds', JSON.stringify([build('b1')]));
    const { service } = configure([build('b1')], []);
    await service.importSelected({ buildIds: ['b1'], timelineIds: [] });
    expect(JSON.parse(localStorage.getItem('wakfu_builds')!)).toEqual([build('b1')]);
  });

  it('le flag est cloisonne par utilisateur', async () => {
    const { service } = configure([build('b1')], []);
    await service.importSelected({ buildIds: ['b1'], timelineIds: [] });
    expect(localStorage.getItem('wakfu_imported_u1')).toBeTruthy();
  });
});

/**
 * La proposition d'import ne doit PAS dependre de l'evenement de connexion : une session
 * restauree au chargement ne passe jamais par le formulaire, et l'utilisateur n'aurait
 * alors jamais aucun moyen d'importer ses donnees.
 */
describe('LocalDataImportService — import en attente', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('signale un import en attente quand des donnees locales existent', async () => {
    const { service } = configure([build('b1')], []);
    await service.refreshPending();
    expect(service.pending()).toBe(true);
  });

  it('ne signale rien quand il n y a aucune donnee locale', async () => {
    const { service } = configure([], []);
    await service.refreshPending();
    expect(service.pending()).toBe(false);
  });

  it('ne signale plus rien une fois l import fait', async () => {
    const { service } = configure([build('b1')], []);
    await service.refreshPending();
    expect(service.pending()).toBe(true);

    await service.importSelected({ buildIds: ['b1'], timelineIds: [] });

    expect(service.pending()).toBe(false);
  });

  it('ne signale rien pour un invite (aucun compte ou verser les donnees)', async () => {
    const created = { builds: [] as Build[], timelines: [] as Timeline[] };
    TestBed.configureTestingModule({
      providers: [
        LocalDataImportService,
        { provide: LocalBuildRepository, useValue: { getAll: () => of([build('b1')]) } },
        { provide: LocalTimelineRepository, useValue: { getAll: () => of([]) } },
        { provide: SupabaseBuildRepository, useValue: { create: (b: Build) => { created.builds.push(b); return of(b); } } },
        { provide: SupabaseTimelineRepository, useValue: { create: (t: Timeline) => { created.timelines.push(t); return of(t); } } },
        { provide: AuthService, useValue: { userId: () => null } },
      ],
    });
    const service = TestBed.inject(LocalDataImportService);
    await service.refreshPending();
    expect(service.pending()).toBe(false);
  });
});
