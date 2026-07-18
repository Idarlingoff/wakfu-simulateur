import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { GalleryPageComponent } from './gallery-page.component';
import { TimelineService } from '../services/timeline.service';
import { PublicTimelineRepository } from '../services/storage/public-timeline.repository';
import { TimelineSharingService } from '../services/timeline-sharing.service';
import { AuthService } from '../services/auth.service';

const mine = { id: 't1', name: 'a moi', buildId: 'b1', classId: 'XEL', visibility: 'private', steps: [] } as any;
const pub = { id: 't2', name: 'publique', buildId: '', classId: 'XEL', visibility: 'public', authorUsername: 'Lilia', steps: [] } as any;

function configure(authenticated: boolean) {
  const sharing = {
    setVisibility: jasmine.createSpy('setVisibility').and.returnValue(Promise.resolve(true)),
    shareLink: () => 'http://x/t/tok',
    duplicate: jasmine.createSpy('duplicate').and.returnValue(Promise.resolve(mine)),
  };
  TestBed.configureTestingModule({
    imports: [GalleryPageComponent],
    providers: [
      provideRouter([]),
      { provide: TimelineService, useValue: { allTimelines: signal([mine]) } },
      { provide: PublicTimelineRepository, useValue: { getPublic: (cls?: string) => of(cls && cls !== 'XEL' ? [] : [pub]) } },
      { provide: TimelineSharingService, useValue: sharing },
      { provide: AuthService, useValue: { isAuthenticated: () => authenticated } },
    ],
  });
  const fixture = TestBed.createComponent(GalleryPageComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance as any, sharing };
}

describe('GalleryPageComponent', () => {
  it('affiche mes timelines dans l onglet par defaut', () => {
    const { component } = configure(true);
    expect(component.tab()).toBe('mine');
    expect(component.visibleMine().length).toBe(1);
  });

  it('charge les publiques en basculant d onglet', async () => {
    const { component } = configure(true);
    await component.selectTab('public');
    expect(component.tab()).toBe('public');
    expect(component.publicTimelines().length).toBe(1);
    expect(component.publicTimelines()[0].authorUsername).toBe('Lilia');
  });

  it('filtre les publiques par classe', async () => {
    const { component } = configure(true);
    await component.selectTab('public');
    component.setClassFilter('IOP');
    await component.reloadPublic();
    expect(component.publicTimelines().length).toBe(0);
  });

  it('change la visibilite d une de mes timelines', async () => {
    const { component, sharing } = configure(true);
    await component.changeVisibility(mine, 'public');
    expect(sharing.setVisibility).toHaveBeenCalledWith(mine, 'public');
  });

  it('cache la duplication pour un invite', async () => {
    const { component } = configure(false);
    await component.selectTab('public');
    expect(component.canDuplicate()).toBe(false);
  });
});
