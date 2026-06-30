import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ResultatsPageComponent } from './resultats-page.component';
import { DamageSummaryComponent } from '../components/damage-summary.component';
import { TimelineSummaryComponent } from '../components/timeline-summary.component';

describe('ResultatsPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ResultatsPageComponent] });
    TestBed.overrideComponent(ResultatsPageComponent, {
      remove: { imports: [DamageSummaryComponent, TimelineSummaryComponent] },
      add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
  });

  it('affiche l en-tête Résultats et les deux résumés', () => {
    const fixture = TestBed.createComponent(ResultatsPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Résultats');
    expect(el.querySelector('app-damage-summary')).toBeTruthy();
    expect(el.querySelector('app-timeline-summary')).toBeTruthy();
  });
});
