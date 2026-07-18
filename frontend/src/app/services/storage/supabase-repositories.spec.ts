import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SupabaseBuildRepository } from './supabase-build.repository';
import { SupabaseClientService } from '../supabase-client.service';
import { AuthService } from '../auth.service';
import { LocalMirror } from './local-mirror.service';
import { Build } from '../../models/build.model';

const build = (id: string) => ({ id, name: `build ${id}`, classId: 'XEL' } as unknown as Build);

/** Faux client Supabase : chaine from().select().eq()… avec resultat pilotable. */
function makeFakeClient(result: { data?: any; error?: any; rejects?: boolean }) {
  const respond = () =>
    result.rejects
      ? Promise.reject(new Error('Failed to fetch'))
      : Promise.resolve({ data: result.data ?? null, error: result.error ?? null });

  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    single: () => respond(),
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    then: (resolve: any, reject: any) => respond().then(resolve, reject),
  };
  return { from: () => builder };
}

function configure(client: any, userId: string | null = 'u1') {
  TestBed.configureTestingModule({
    providers: [
      SupabaseBuildRepository,
      LocalMirror,
      { provide: SupabaseClientService, useValue: { client } },
      { provide: AuthService, useValue: { userId: () => userId } },
    ],
  });
  return TestBed.inject(SupabaseBuildRepository);
}

describe('SupabaseBuildRepository', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('lit les builds depuis Postgres et les recopie dans le miroir', async () => {
    const rows = [{ id: 'b1', name: 'build b1', class_id: 'XEL', data: build('b1') }];
    const repo = configure(makeFakeClient({ data: rows }));
    const result = await firstValueFrom(repo.getAll());
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('b1');
    expect(TestBed.inject(LocalMirror).read('u1', 'builds')).not.toBeNull();
  });

  // L'invariant du lot : une panne reseau ne casse pas la lecture.
  it('retombe sur le miroir quand Postgres est injoignable', async () => {
    const repo = configure(makeFakeClient({ rejects: true }));
    TestBed.inject(LocalMirror).write('u1', 'builds', [build('cache')]);
    const result = await firstValueFrom(repo.getAll());
    expect(result).toEqual([build('cache')]);
  });

  it('retourne une liste vide si Postgres echoue et que le miroir est vide', async () => {
    const repo = configure(makeFakeClient({ rejects: true }));
    expect(await firstValueFrom(repo.getAll())).toEqual([]);
  });

  // Les ecritures ne doivent JAMAIS echouer en silence.
  it('propage l erreur en ecriture quand Postgres est injoignable', async () => {
    const repo = configure(makeFakeClient({ rejects: true }));
    await expectAsync(firstValueFrom(repo.create(build('b1')))).toBeRejected();
  });

  it('propage l erreur en ecriture quand Postgres renvoie une erreur', async () => {
    const repo = configure(makeFakeClient({ error: { message: 'boom' } }));
    await expectAsync(firstValueFrom(repo.create(build('b1')))).toBeRejected();
  });

  it('jette si aucun utilisateur n est connecte', async () => {
    const repo = configure(makeFakeClient({ data: [] }), null);
    await expectAsync(firstValueFrom(repo.create(build('b1')))).toBeRejected();
  });
});
