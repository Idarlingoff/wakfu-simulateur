import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { PublicTimelineRepository } from './public-timeline.repository';
import { SupabaseClientService } from '../supabase-client.service';

/** Faux client : from().select().eq().order() pour la liste, rpc() pour le jeton. */
function makeFakeClient(opts: { rows?: any[]; rpcData?: any[]; rejects?: boolean } = {}) {
  const resolve = (data: any) =>
    opts.rejects ? Promise.reject(new Error('offline')) : Promise.resolve({ data, error: null });
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => resolve(opts.rows ?? []),
    then: (r: any) => resolve(opts.rows ?? []).then(r),
  };
  return {
    from: () => builder,
    rpc: (_fn: string, _args: any) => resolve(opts.rpcData ?? []),
  };
}

function configure(client: any) {
  TestBed.configureTestingModule({
    providers: [
      PublicTimelineRepository,
      { provide: SupabaseClientService, useValue: { client } },
    ],
  });
  return TestBed.inject(PublicTimelineRepository);
}

const row = (id: string, vis = 'public') => ({
  id, name: `tl ${id}`, build_id: null, class_id: 'XEL', visibility: vis,
  share_token: `tok-${id}`, data: { id, name: `tl ${id}`, steps: [] },
  profiles: { username: 'Lilia' },
});

describe('PublicTimelineRepository', () => {
  it('liste les timelines publiques avec le pseudo de l auteur', async () => {
    const repo = configure(makeFakeClient({ rows: [row('t1')] }));
    const result = await firstValueFrom(repo.getPublic());
    expect(result.length).toBe(1);
    expect(result[0].authorUsername).toBe('Lilia');
    expect(result[0].classId).toBe('XEL');
  });

  it('retourne une liste vide (pas une erreur) quand le reseau echoue', async () => {
    const repo = configure(makeFakeClient({ rejects: true }));
    expect(await firstValueFrom(repo.getPublic())).toEqual([]);
  });

  it('resout une timeline par jeton', async () => {
    const repo = configure(makeFakeClient({ rpcData: [row('t1', 'unlisted')] }));
    const result = await firstValueFrom(repo.getByShareToken('tok-t1'));
    expect(result?.id).toBe('t1');
    expect(result?.visibility).toBe('unlisted');
  });

  it('retourne null pour un jeton inconnu ou une timeline redevenue privee', async () => {
    const repo = configure(makeFakeClient({ rpcData: [] }));
    expect(await firstValueFrom(repo.getByShareToken('inconnu'))).toBeNull();
  });
});
