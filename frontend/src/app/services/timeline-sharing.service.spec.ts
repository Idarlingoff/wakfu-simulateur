import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TimelineSharingService } from './timeline-sharing.service';
import { WakfuApiService } from './wakfu-api.service';
import { SaveErrorService } from './save-error.service';
import { Timeline } from '../models/timeline.model';
import { SharedTimeline } from '../models/shared-timeline.model';

const timeline = () =>
  ({ id: 't1', name: 'combo', buildId: 'b1', classId: 'XEL', visibility: 'private',
     shareToken: 'tok-1', steps: [] } as unknown as Timeline);

function configure() {
  const captured = { updated: [] as any[], created: [] as Timeline[] };
  const api = {
    updateTimeline: (id: string, t: Timeline) => { captured.updated.push({ id, t }); return of(t); },
    createTimeline: (t: Timeline) => { captured.created.push(t); return of(t); },
  };
  TestBed.configureTestingModule({
    providers: [
      TimelineSharingService,
      SaveErrorService,
      { provide: WakfuApiService, useValue: api },
    ],
  });
  return { service: TestBed.inject(TimelineSharingService), captured };
}

describe('TimelineSharingService', () => {
  it('change la visibilite via updateTimeline', async () => {
    const { service, captured } = configure();
    await service.setVisibility(timeline(), 'public');
    expect(captured.updated[0].t.visibility).toBe('public');
  });

  it('construit un lien de partage a partir du shareToken', () => {
    const { service } = configure();
    const link = service.shareLink(timeline());
    expect(link).toContain('/t/tok-1');
  });

  it('duplique en une copie privee, nouvel id, sans build', async () => {
    const { service, captured } = configure();
    const shared = { ...timeline(), authorUsername: 'Someone' } as SharedTimeline;
    await service.duplicate(shared);
    const copy = captured.created[0];
    expect(copy.id).not.toBe('t1');
    expect(copy.visibility).toBe('private');
    // Partage "structure seule" : la copie n'herite pas du build de l'auteur.
    expect(copy.buildId).toBe('');
    expect(copy.name).toContain('combo');
  });
});
