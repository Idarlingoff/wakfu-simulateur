import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { BuildService } from './build.service';
import { TimelineService } from './timeline.service';
import { WakfuApiService } from './wakfu-api.service';
import { SaveErrorService } from './save-error.service';
import { AuthService } from './auth.service';
import { AuthStatus } from './auth.service';
import { Build } from '../models/build.model';
import { Timeline } from '../models/timeline.model';

const inviteBuild = { id: 'build_1765203886507', name: 'invite', classId: 'XEL' } as unknown as Build;
const cloudBuild = { id: '11111111-1111-4111-8111-111111111111', name: 'cloud', classId: 'XEL' } as unknown as Build;
const inviteTimeline = { id: 'timeline_1765203886507', name: 'invite', buildId: 'x', steps: [] } as unknown as Timeline;
const cloudTimeline = { id: '22222222-2222-4222-8222-222222222222', name: 'cloud', buildId: 'x', steps: [] } as unknown as Timeline;

/**
 * Le constructeur des services chargeait les donnees immediatement, alors que la
 * restauration de session est asynchrone : `status` valait encore 'loading', donc
 * `isAuthenticated()` etait faux et le chargement partait vers le stockage INVITE.
 * La session se restaurait ensuite et les ECRITURES basculaient vers le cloud, tandis
 * que la liste affichee restait celle de l'invite : supprimer visait alors un id local
 * inexistant en base (400 "invalid input syntax for type uuid").
 */
describe('Rechargement des donnees au changement d etat d auth', () => {
  function configure() {
    const status = signal<AuthStatus>('loading');
    const authenticated = () => status() === 'authenticated';

    const api = {
      getAllBuilds: () => of(authenticated() ? [cloudBuild] : [inviteBuild]),
      getAllTimelines: () => of(authenticated() ? [cloudTimeline] : [inviteTimeline]),
    };

    TestBed.configureTestingModule({
      providers: [
        BuildService,
        TimelineService,
        SaveErrorService,
        { provide: WakfuApiService, useValue: api },
        { provide: AuthService, useValue: { status, isAuthenticated: authenticated } },
      ],
    });
    return { status };
  }

  it('ne charge rien tant que l etat d auth n est pas resolu', async () => {
    const { status } = configure();
    const service = TestBed.inject(BuildService);
    TestBed.tick();
    await Promise.resolve();
    expect(status()).toBe('loading');
    expect(service.allBuilds().length).toBe(0);
  });

  it('charge les builds du cloud quand la session se restaure', async () => {
    const { status } = configure();
    const service = TestBed.inject(BuildService);
    status.set('authenticated');
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(service.allBuilds().map(b => b.name)).toEqual(['cloud']);
  });

  it('charge les builds de l invite quand aucune session n existe', async () => {
    const { status } = configure();
    const service = TestBed.inject(BuildService);
    status.set('anonymous');
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(service.allBuilds().map(b => b.name)).toEqual(['invite']);
  });

  it('rebascule sur les donnees d invite a la deconnexion', async () => {
    const { status } = configure();
    const service = TestBed.inject(BuildService);
    status.set('authenticated');
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(service.allBuilds().map(b => b.name)).toEqual(['cloud']);

    status.set('anonymous');
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(service.allBuilds().map(b => b.name)).toEqual(['invite']);
  });

  it('recharge aussi les timelines quand la session se restaure', async () => {
    const { status } = configure();
    const service = TestBed.inject(TimelineService);
    status.set('authenticated');
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(service.allTimelines().map(t => t.name)).toEqual(['cloud']);
  });
});
