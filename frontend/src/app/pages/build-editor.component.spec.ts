import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { BuildEditorComponent } from './build-editor.component';
import { BuildService } from '../services/build.service';
import { SpellSelectorComponent } from '../components/spell-selector.component';
import { PassiveSelectorComponent } from '../components/passive-selector.component';
import { SublimationSelectorComponent } from '../components/sublimation-selector.component';
import { Build } from '../models/build.model';

function makeBuild(id: string, name: string): Build {
  return {
    id, name, classId: 'XEL', characterLevel: 230,
    spellBar: { spells: [] }, passiveBar: { passives: [] }, sublimationBar: { sublimations: [] },
    stats: {
      level: 230, masteryFire: 100, masteryWater: 0, masteryEarth: 0, masteryAir: 0,
      masterySecondary: 0, backMastery: 0, masteryMelee: 0, masteryDistance: 0, masteryHealing: 0,
      dommageInflict: 0, critRate: 0, critMastery: 0,
      resistance: 0, ap: 12, mp: 4, wp: 6, range: 3,
    },
  };
}

class StubBuildService {
  getBuildById = jasmine.createSpy('getBuildById').and.returnValue(undefined);
  createBuild = jasmine.createSpy('createBuild');
  updateBuild = jasmine.createSpy('updateBuild');
}

let stub: StubBuildService;

function configure(idParam: string | null): void {
  stub = new StubBuildService();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BuildEditorComponent],
    providers: [
      provideRouter([]),
      { provide: BuildService, useValue: stub },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (_: string) => idParam } } } },
    ],
  });
  TestBed.overrideComponent(BuildEditorComponent, {
    remove: { imports: [SpellSelectorComponent, PassiveSelectorComponent, SublimationSelectorComponent] },
    add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
  });
}

describe('BuildEditorComponent', () => {
  it('mode création : formulaire vierge, save appelle createBuild', () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    expect(stub.getBuildById).not.toHaveBeenCalled();
    const cmp = fixture.componentInstance;
    cmp.form.name = 'Nouveau';
    cmp.form.classId = 'XEL';
    cmp.save();
    expect(stub.createBuild).toHaveBeenCalled();
    expect(stub.updateBuild).not.toHaveBeenCalled();
    const arg = stub.createBuild.calls.mostRecent().args[0];
    expect(arg.name).toBe('Nouveau');
    expect(arg.classId).toBe('XEL');
  });

  it('mode édition : précharge le build et save appelle updateBuild', () => {
    configure('b1');
    stub.getBuildById.and.returnValue(makeBuild('b1', 'Rouage'));
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    expect(cmp.form.name).toBe('Rouage');
    cmp.save();
    expect(stub.updateBuild).toHaveBeenCalled();
    expect(stub.updateBuild.calls.mostRecent().args[0]).toBe('b1');
    expect(stub.createBuild).not.toHaveBeenCalled();
  });

  it('annuler revient en arrière sans sauvegarder', () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    const loc = TestBed.inject(Location);
    const backSpy = spyOn(loc, 'back');
    fixture.detectChanges();
    fixture.componentInstance.cancel();
    expect(backSpy).toHaveBeenCalled();
    expect(stub.createBuild).not.toHaveBeenCalled();
    expect(stub.updateBuild).not.toHaveBeenCalled();
  });

  it('save sans nom/classe n appelle ni create ni update', () => {
    configure(null);
    spyOn(window, 'alert');
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    fixture.componentInstance.save();
    expect(stub.createBuild).not.toHaveBeenCalled();
    expect(stub.updateBuild).not.toHaveBeenCalled();
  });
});
