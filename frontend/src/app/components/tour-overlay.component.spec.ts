import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TourOverlayComponent } from './tour-overlay.component';
import { TourService } from '../services/tour.service';
import { TourStep } from '../utils/tour-steps';

const STEP: TourStep = {
  id: 'code-deck', route: '/builds/nouveau', target: '[data-tour="cible-test"]',
  title: 'Colle ton deck', body: 'Texte de l etape.', placement: 'bottom',
};

class StubTour {
  active = signal(true);
  stepIndex = signal(2);
  currentStep = signal<TourStep | null>(STEP);
  steps = new Array(5);
  next = jasmine.createSpy('next').and.resolveTo(undefined);
  previous = jasmine.createSpy('previous').and.resolveTo(undefined);
  skip = jasmine.createSpy('skip');
}

let tour: StubTour;

function mount(withTarget: boolean) {
  document.querySelectorAll('[data-tour="cible-test"]').forEach(e => e.remove());
  if (withTarget) {
    const el = document.createElement('div');
    el.setAttribute('data-tour', 'cible-test');
    el.style.cssText = 'position:fixed;top:100px;left:50px;width:200px;height:40px;';
    document.body.appendChild(el);
  }
  tour = new StubTour();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TourOverlayComponent],
    providers: [{ provide: TourService, useValue: tour }],
  });
  const fixture = TestBed.createComponent(TourOverlayComponent);
  fixture.detectChanges();
  return fixture;
}

function boutonNomme(fixture: any, nom: string): HTMLButtonElement {
  return [...fixture.nativeElement.querySelectorAll('button')]
    .find((b: any) => b.textContent.trim() === nom) as HTMLButtonElement;
}

describe('TourOverlayComponent', () => {
  afterEach(() => document.querySelectorAll('[data-tour="cible-test"]').forEach(e => e.remove()));

  it('affiche le titre et le corps de l etape', () => {
    const fixture = mount(true);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Colle ton deck');
    expect(text).toContain('Texte de l etape.');
  });

  it('affiche la progression', () => {
    expect(mount(true).nativeElement.textContent).toContain('3 / 5');
  });

  it('se positionne d apres le rectangle de la cible', () => {
    const fixture = mount(true);
    expect(fixture.componentInstance.spotlight()).not.toBeNull();
    expect(fixture.componentInstance.spotlight()!.top).toBe(100);
  });

  it('cible absente : repli centre, aucune erreur, etape franchissable', () => {
    const fixture = mount(false);

    expect(fixture.componentInstance.spotlight()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Colle ton deck');
    boutonNomme(fixture, 'Suivant').click();
    expect(tour.next).toHaveBeenCalled();
  });

  it('Passer termine la visite', () => {
    boutonNomme(mount(true), 'Passer').click();
    expect(tour.skip).toHaveBeenCalled();
  });

  it('Precedent n apparait pas sur la premiere etape', () => {
    const fixture = mount(true);
    expect(boutonNomme(fixture, 'Précédent')).toBeTruthy();

    tour.stepIndex.set(0);
    fixture.detectChanges();
    expect(boutonNomme(fixture, 'Précédent')).toBeUndefined();
  });

  it('Echap termine la visite', () => {
    mount(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tour.skip).toHaveBeenCalled();
  });

  it('ne rend rien quand la visite est inactive', () => {
    const fixture = mount(true);
    tour.active.set(false);
    tour.currentStep.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
