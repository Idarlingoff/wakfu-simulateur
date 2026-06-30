import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FreeplayPageComponent } from './freeplay-page.component';
import { DashboardComponent } from '../components/dashboard.component';

describe('FreeplayPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [FreeplayPageComponent] });
    TestBed.overrideComponent(FreeplayPageComponent, {
      remove: { imports: [DashboardComponent] },
      add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
  });

  it('affiche l en-tête Freeplay et le dashboard en mode freeplay', () => {
    const fixture = TestBed.createComponent(FreeplayPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Freeplay');
    const dash = el.querySelector('app-dashboard');
    expect(dash).toBeTruthy();
    expect(dash?.getAttribute('mode')).toBe('freeplay');
  });
});
