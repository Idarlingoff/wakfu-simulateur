import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SupabaseTimelineRepository } from './supabase-timeline.repository';
import { SupabaseClientService } from '../supabase-client.service';
import { AuthService } from '../auth.service';
import { LocalMirror } from './local-mirror.service';
import { Timeline } from '../../models/timeline.model';

const timeline = () =>
  ({ id: 't1', name: 'combo', buildId: 'b1', classId: 'XEL', steps: [] } as unknown as Timeline);

/** Capture la derniere ligne passee a insert(). */
function makeFakeClient() {
  const captured: { row?: any } = {};
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    insert: (row: any) => { captured.row = row; return builder; },
    update: () => builder,
    delete: () => builder,
    then: (res: any) => Promise.resolve({ data: null, error: null }).then(res),
  };
  return { captured, client: { from: () => builder } };
}

describe('SupabaseTimelineRepository — champs de partage', () => {
  it('ecrit class_id a la creation', async () => {
    const fake = makeFakeClient();
    TestBed.configureTestingModule({
      providers: [
        SupabaseTimelineRepository,
        LocalMirror,
        { provide: SupabaseClientService, useValue: { client: fake.client } },
        { provide: AuthService, useValue: { userId: () => 'u1' } },
      ],
    });
    const repo = TestBed.inject(SupabaseTimelineRepository);
    await firstValueFrom(repo.create(timeline()));
    // Sans ca, class_id reste NULL et la galerie ne peut pas filtrer par classe.
    expect(fake.captured.row.class_id).toBe('XEL');
  });

  it('lit visibility et shareToken depuis la ligne', async () => {
    const fake = makeFakeClient();
    TestBed.configureTestingModule({
      providers: [
        SupabaseTimelineRepository,
        LocalMirror,
        { provide: SupabaseClientService, useValue: { client: fake.client } },
        { provide: AuthService, useValue: { userId: () => 'u1' } },
      ],
    });
    const repo = TestBed.inject(SupabaseTimelineRepository);
    const row = { id: 't1', name: 'combo', build_id: 'b1', class_id: 'XEL',
      visibility: 'public', share_token: 'tok-1', data: timeline() };
    const mapped = (repo as any).fromRow(row) as Timeline;
    expect(mapped.visibility).toBe('public');
    expect(mapped.shareToken).toBe('tok-1');
    expect(mapped.classId).toBe('XEL');
  });
});
