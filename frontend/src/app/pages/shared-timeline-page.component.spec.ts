import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { SharedTimelinePageComponent } from './shared-timeline-page.component';
import { PublicTimelineRepository } from '../services/storage/public-timeline.repository';
import { TimelineService } from '../services/timeline.service';
import { WakfuApiService } from '../services/wakfu-api.service';

const shared = {
  id: 't1', name: 'combo', buildId: '', classId: 'XEL', visibility: 'unlisted',
  shareToken: 'tok-1', authorUsername: 'Lilia',
  steps: [
    { id: 's1', actions: [
      { id: 'a1', type: 'CastSpell', order: 1, spellId: 'XEL_ROUAGE', targetPosition: { x: 6, y: 6 } },
      { id: 'a2', type: 'Move', order: 2, targetPosition: { x: 5, y: 6 } },
    ] },
  ],
} as any;

const spells = [{ id: 'XEL_ROUAGE', name: 'Rouage' }] as any;

function configure(resolved: any) {
  const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
  const timelineService = {
    createTimeline: jasmine.createSpy('createTimeline').and.callFake((t: any) => Promise.resolve({ ...t, id: 'copy-1' })),
    loadTimeline: jasmine.createSpy('loadTimeline'),
  };
  TestBed.configureTestingModule({
    imports: [SharedTimelinePageComponent],
    providers: [
      provideRouter([]),
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'tok-1' } } } },
      { provide: PublicTimelineRepository, useValue: { getByShareToken: () => of(resolved) } },
      { provide: TimelineService, useValue: timelineService },
      { provide: WakfuApiService, useValue: { getAllSpells: () => of(spells) } },
    ],
  });
  const fixture = TestBed.createComponent(SharedTimelinePageComponent);
  fixture.detectChanges();
  return { component: fixture.componentInstance as any, router, timelineService };
}

describe('SharedTimelinePageComponent', () => {
  it('charge la timeline du jeton', async () => {
    const { component } = configure(shared);
    await component.load();
    expect(component.timeline()?.name).toBe('combo');
    expect(component.error()).toBeNull();
  });

  it('affiche une erreur pour un jeton invalide ou une timeline redevenue privee', async () => {
    const { component } = configure(null);
    await component.load();
    expect(component.timeline()).toBeNull();
    expect(component.error()).toBe('Cette timeline n existe plus ou n est plus partagee.');
  });

  // Issue #2 : chaque action doit etre lisible (nom du sort, mouvement), pas "1 action(s)".
  it('rend chaque action avec le nom du sort et la cible', async () => {
    const { component } = configure(shared);
    await component.load();
    await component.loadSpellNames();
    const lines = component.actionLines();
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('Rouage');
    expect(lines[0]).toContain('(6, 6)');
    expect(lines[1]).toContain('Déplacement');
  });

  it('retombe sur l id du sort si son nom est inconnu', async () => {
    const withUnknown = { ...shared, steps: [{ id: 's1', actions: [
      { id: 'a1', type: 'CastSpell', order: 1, spellId: 'INCONNU' },
    ] }] };
    const { component } = configure(withUnknown);
    await component.load();
    await component.loadSpellNames();
    expect(component.actionLines()[0]).toContain('INCONNU');
  });

  // Issue #3 : "Ouvrir dans l'editeur" copie puis navigue vers l'onglet Timelines.
  it('copie la timeline (structure seule) puis ouvre l editeur', async () => {
    const { component, router, timelineService } = configure(shared);
    await component.load();
    await component.openInEditor();
    const copyArg = timelineService.createTimeline.calls.mostRecent().args[0];
    expect(copyArg.id).not.toBe('t1');
    expect(copyArg.shareToken).toBeUndefined();
    expect(copyArg.authorUsername).toBeUndefined();
    expect(timelineService.loadTimeline).toHaveBeenCalledWith('copy-1');
    expect(router.navigate).toHaveBeenCalledWith(['/timelines']);
  });
});
