import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LocalBuildRepository } from './local-build.repository';
import { LocalTimelineRepository } from './local-timeline.repository';
import { Build } from '../../models/build.model';
import { Timeline } from '../../models/timeline.model';

const build = (id: string) => ({ id, name: `build ${id}`, classId: 'XEL' } as unknown as Build);
const timeline = (id: string, buildId: string) =>
  ({ id, name: `tl ${id}`, buildId, steps: [] } as unknown as Timeline);

describe('LocalBuildRepository', () => {
  let repo: LocalBuildRepository;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [LocalBuildRepository] });
    repo = TestBed.inject(LocalBuildRepository);
  });
  afterEach(() => localStorage.clear());

  it('retourne une liste vide au depart', async () => {
    expect(await firstValueFrom(repo.getAll())).toEqual([]);
  });

  it('cree puis relit un build', async () => {
    await firstValueFrom(repo.create(build('b1')));
    expect(await firstValueFrom(repo.getAll())).toEqual([build('b1')]);
    expect(await firstValueFrom(repo.getById('b1'))).toEqual(build('b1'));
  });

  it('utilise bien la cle d invite wakfu_builds', async () => {
    await firstValueFrom(repo.create(build('b1')));
    expect(JSON.parse(localStorage.getItem('wakfu_builds')!)).toEqual([build('b1')]);
  });

  it('jette si le build est introuvable', async () => {
    await expectAsync(firstValueFrom(repo.getById('absent'))).toBeRejected();
  });

  it('met a jour puis supprime', async () => {
    await firstValueFrom(repo.create(build('b1')));
    const modifie = { ...build('b1'), name: 'renomme' } as Build;
    await firstValueFrom(repo.update('b1', modifie));
    expect((await firstValueFrom(repo.getById('b1'))).name).toBe('renomme');
    await firstValueFrom(repo.delete('b1'));
    expect(await firstValueFrom(repo.getAll())).toEqual([]);
  });
});

describe('LocalTimelineRepository', () => {
  let repo: LocalTimelineRepository;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [LocalTimelineRepository] });
    repo = TestBed.inject(LocalTimelineRepository);
  });
  afterEach(() => localStorage.clear());

  it('cree puis relit une timeline', async () => {
    await firstValueFrom(repo.create(timeline('t1', 'b1')));
    expect(await firstValueFrom(repo.getAll())).toEqual([timeline('t1', 'b1')]);
  });

  it('filtre par buildId', async () => {
    await firstValueFrom(repo.create(timeline('t1', 'b1')));
    await firstValueFrom(repo.create(timeline('t2', 'b2')));
    expect(await firstValueFrom(repo.getAll('b1'))).toEqual([timeline('t1', 'b1')]);
  });

  it('utilise bien la cle d invite wakfu_timelines', async () => {
    await firstValueFrom(repo.create(timeline('t1', 'b1')));
    expect(JSON.parse(localStorage.getItem('wakfu_timelines')!)).toEqual([timeline('t1', 'b1')]);
  });

  it('jette si la timeline est introuvable', async () => {
    await expectAsync(firstValueFrom(repo.getById('absent'))).toBeRejected();
  });
});
