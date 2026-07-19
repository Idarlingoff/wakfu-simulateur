import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PassiveSelectorComponent } from './passive-selector.component';
import { PassiveReference } from '../models/build.model';
import { DataCacheService } from '../services/data-cache.service';

function ref(passiveId: string, unlockedAtLevel: number): PassiveReference {
  return { passiveId, unlockedAtLevel };
}

/**
 * Hote minimal qui reproduit le cablage de l'editeur de build : le parent detient
 * la liste des passifs et la reinjecte via [selectedPassives].
 */
@Component({
  standalone: true,
  imports: [PassiveSelectorComponent],
  template: `
    <app-passive-selector
      [classId]="'XEL'"
      [characterLevel]="level"
      [selectedPassives]="passives"
      (passivesChange)="passives = $event"
    ></app-passive-selector>
  `,
})
class HostComponent {
  level = 200;
  passives: (PassiveReference | null)[] = [
    ref('p1', 20), ref('p2', 35), ref('p3', 50), ref('p4', 100), ref('p5', 150), null,
  ];
}

class StubDataCacheService {
  getPassives = jasmine.createSpy('getPassives').and.resolveTo([]);
  clearPassivesCache = jasmine.createSpy('clearPassivesCache');
}

function configure(): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [{ provide: DataCacheService, useValue: new StubDataCacheService() }],
  });
}

describe('PassiveSelectorComponent', () => {
  it('baisser le niveau ne declenche pas NG0100 (pas d emission pendant la detection de changement)', () => {
    configure();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.componentInstance.level = 50;

    // detectChanges() lance checkNoChanges : une emission synchrone depuis ngOnChanges
    // ferait remonter ExpressionChangedAfterItHasBeenCheckedError.
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('le composant n emet jamais depuis ngOnChanges quand le niveau baisse', () => {
    configure();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const selector = fixture.debugElement.children[0].componentInstance as PassiveSelectorComponent;
    const emitted: (PassiveReference | null)[][] = [];
    selector.passivesChange.subscribe(v => emitted.push(v));

    fixture.componentInstance.level = 50;
    fixture.detectChanges();

    expect(emitted).toEqual([]);
  });

  it('isSlotAvailable suit les niveaux de deverrouillage', () => {
    configure();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.level = 50;
    fixture.detectChanges();

    const selector = fixture.debugElement.children[0].componentInstance as PassiveSelectorComponent;
    expect(selector.isSlotAvailable(0)).toBeTrue();
    expect(selector.isSlotAvailable(2)).toBeTrue();
    expect(selector.isSlotAvailable(3)).toBeFalse();
    expect(selector.isSlotAvailable(5)).toBeFalse();
  });
});
