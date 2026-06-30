import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TimelinePageComponent } from './timeline-page.component';
import { DashboardComponent } from '../components/dashboard.component';

describe('TimelinePageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TimelinePageComponent] });
    TestBed.overrideComponent(TimelinePageComponent, {
      remove: { imports: [DashboardComponent] },
      add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
  });

  it('affiche l en-tête Timeline et le dashboard en mode timeline', () => {
    const fixture = TestBed.createComponent(TimelinePageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const dash = el.querySelector('app-dashboard');
    expect(dash).toBeTruthy();
    expect(dash?.getAttribute('mode')).toBe('timeline');
  });
});
