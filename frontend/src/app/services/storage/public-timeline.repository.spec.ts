import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { PublicTimelineRepository } from './public-timeline.repository';
import { SupabaseClientService } from '../supabase-client.service';

/**
 * Faux client : les DEUX lectures publiques passent par des fonctions Postgres (rpc),
 * pas par un embed PostgREST. L'embed `profiles(username)` echouait faute de FK
 * timelines->profiles, ce qui vidait la galerie ET affichait "Anonyme".
 */
function makeFakeClient(opts: {
  publicRows?: any[];
  tokenRows?: any[];
  rejects?: boolean;
} = {}) {
  const calls: Array<{ fn: string; args: any }> = [];
  const resolve = (data: any) =>
    opts.rejects ? Promise.reject(new Error('offline')) : Promise.resolve({ data, error: null });
  return {
    calls,
    rpc: (fn: string, args: any) => {
      calls.push({ fn, args });
      if (fn === 'get_public_timelines') return resolve(opts.publicRows ?? []);
      if (fn === 'get_shared_timeline') return resolve(opts.tokenRows ?? []);
      return resolve([]);
    },
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

// La fonction get_public_timelines renvoie des colonnes PLATES, dont author_username.
const publicRow = (id: string) => ({
  id, name: `tl ${id}`, build_id: null, class_id: 'XEL', visibility: 'public',
  share_token: `tok-${id}`, data: { id, name: `tl ${id}`, steps: [] },
  author_username: 'Lilia',
});

const tokenRow = (id: string, vis = 'unlisted') => ({
  id, name: `tl ${id}`, build_id: null, class_id: 'XEL', visibility: vis,
  share_token: `tok-${id}`, data: { id, name: `tl ${id}`, steps: [] },
  author_username: 'Lilia',
});

describe('PublicTimelineRepository', () => {
  it('liste les timelines publiques via la fonction get_public_timelines, avec le pseudo', async () => {
    const fake = makeFakeClient({ publicRows: [publicRow('t1')] });
    const repo = configure(fake);
    const result = await firstValueFrom(repo.getPublic());
    expect(result.length).toBe(1);
    expect(result[0].authorUsername).toBe('Lilia');
    expect(result[0].classId).toBe('XEL');
    expect(fake.calls[0].fn).toBe('get_public_timelines');
  });

  it('transmet le filtre de classe a la fonction', async () => {
    const fake = makeFakeClient({ publicRows: [] });
    const repo = configure(fake);
    await firstValueFrom(repo.getPublic('IOP'));
    expect(fake.calls[0].args).toEqual({ class_filter: 'IOP' });
  });

  it('retourne une liste vide (pas une erreur) quand le reseau echoue', async () => {
    const repo = configure(makeFakeClient({ rejects: true }));
    expect(await firstValueFrom(repo.getPublic())).toEqual([]);
  });

  it('resout une timeline par jeton, avec le pseudo de l auteur', async () => {
    const repo = configure(makeFakeClient({ tokenRows: [tokenRow('t1')] }));
    const result = await firstValueFrom(repo.getByShareToken('tok-t1'));
    expect(result?.id).toBe('t1');
    expect(result?.visibility).toBe('unlisted');
    expect(result?.authorUsername).toBe('Lilia');
  });

  it('retourne null pour un jeton inconnu ou une timeline redevenue privee', async () => {
    const repo = configure(makeFakeClient({ tokenRows: [] }));
    expect(await firstValueFrom(repo.getByShareToken('inconnu'))).toBeNull();
  });
});
