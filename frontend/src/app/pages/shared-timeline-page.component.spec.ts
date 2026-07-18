import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { SharedTimelinePageComponent } from './shared-timeline-page.component';
import { PublicTimelineRepository } from '../services/storage/public-timeline.repository';
import { BuildService } from '../services/build.service';
import { AuthService } from '../services/auth.service';

const shared = { id: 't1', name: 'combo', buildId: '', classId: 'XEL', visibility: 'unlisted',
  shareToken: 'tok-1', authorUsername: 'Lilia', steps: [{ id: 's1', actions: [] }] } as any;
const myBuild = { id: 'b9', name: 'mon xelor', classId: 'XEL' } as any;

function configure(token: string, resolved: any) {
  TestBed.configureTestingModule({
    imports: [SharedTimelinePageComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => token } } } },
      { provide: PublicTimelineRepository, useValue: { getByShareToken: () => of(resolved) } },
      { provide: BuildService, useValue: { allBuilds: signal([myBuild]) } },
      { provide: AuthService, useValue: { isAuthenticated: () => true } },
    ],
  });
  const fixture = TestBed.createComponent(SharedTimelinePageComponent);
  fixture.detectChanges();
  return { component: fixture.componentInstance as any };
}

describe('SharedTimelinePageComponent', () => {
  it('charge la timeline du jeton', async () => {
    const { component } = configure('tok-1', shared);
    await component.load();
    expect(component.timeline()?.name).toBe('combo');
    expect(component.error()).toBeNull();
  });

  it('affiche une erreur pour un jeton invalide ou une timeline redevenue privee', async () => {
    const { component } = configure('inconnu', null);
    await component.load();
    expect(component.timeline()).toBeNull();
    expect(component.error()).toBe('Cette timeline n existe plus ou n est plus partagee.');
  });

  // Partage "structure seule" : pas de degats tant qu'aucun build du lecteur n'est choisi.
  it('n affiche pas de degats sans build selectionne', async () => {
    const { component } = configure('tok-1', shared);
    await component.load();
    expect(component.selectedBuildId()).toBeNull();
    expect(component.showsDamage()).toBe(false);
  });

  it('affiche les degats une fois un build du lecteur choisi', async () => {
    const { component } = configure('tok-1', shared);
    await component.load();
    component.selectBuild('b9');
    expect(component.showsDamage()).toBe(true);
  });
});
