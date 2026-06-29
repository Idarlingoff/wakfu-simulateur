import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BuildsListComponent } from './builds-list.component';
import { BuildFormComponent } from '../components/build-form.component';
import { BuildService } from '../services/build.service';
import { Build } from '../models/build.model';

function makeBuild(id: string, name: string): Build {
  return {
    id, name, classId: 'XEL', characterLevel: 230,
    spellBar: { spells: [] }, passiveBar: { passives: [] }, sublimationBar: { sublimations: [] },
    stats: {
      level: 230, masteryFire: 0, masteryWater: 0, masteryEarth: 0, masteryAir: 0,
      masterySecondary: 0, backMastery: 0, dommageInflict: 0, critRate: 0, critMastery: 0,
      resistance: 0, ap: 12, mp: 4, wp: 6, range: 0,
    },
  };
}

class StubBuildService {
  readonly allBuilds = signal<Build[]>([makeBuild('b1', 'Rouage'), makeBuild('b2', 'Burst')]);
  readonly selectedBuildA = signal<Build | null>(null);
  selectBuildA = jasmine.createSpy('selectBuildA');
  createBuild = jasmine.createSpy('createBuild');
  updateBuild = jasmine.createSpy('updateBuild');
  deleteBuild = jasmine.createSpy('deleteBuild');
}

describe('BuildsListComponent', () => {
  let stub: StubBuildService;

  beforeEach(() => {
    stub = new StubBuildService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BuildsListComponent],
      providers: [provideRouter([]), { provide: BuildService, useValue: stub }],
    });
    // Neutralise le template du formulaire modal (qui embarque les sélecteurs sorts/passifs/
    // sublimations → HttpClient/DataCacheService) pour que le test reste isolé sur BuildService.
    // La classe est conservée : viewChild.required(BuildFormComponent) résout toujours.
    TestBed.overrideComponent(BuildFormComponent, { set: { template: '', imports: [] } });
  });

  it('rend une carte par build', () => {
    const fixture = TestBed.createComponent(BuildsListComponent);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('article.card');
    expect(cards.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Rouage');
    expect(fixture.nativeElement.textContent).toContain('Burst');
  });

  it('affiche l etat vide sans build', () => {
    stub.allBuilds.set([]);
    const fixture = TestBed.createComponent(BuildsListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('article.card').length).toBe(0);
  });

  it('supprime un build apres confirmation', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = TestBed.createComponent(BuildsListComponent);
    fixture.detectChanges();
    fixture.componentInstance.deleteBuild(stub.allBuilds()[0]);
    expect(stub.deleteBuild).toHaveBeenCalledWith('b1');
  });

  it('ne supprime pas si confirmation refusee', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const fixture = TestBed.createComponent(BuildsListComponent);
    fixture.detectChanges();
    fixture.componentInstance.deleteBuild(stub.allBuilds()[0]);
    expect(stub.deleteBuild).not.toHaveBeenCalled();
  });
});
