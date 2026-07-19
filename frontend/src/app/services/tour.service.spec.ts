import { TestBed } from '@angular/core/testing';
import { Router, NavigationCancel, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { TourService, TOUR_SEEN_KEY } from './tour.service';
import { DemoDataService } from './demo-data.service';
import { TOUR_STEPS } from '../utils/tour-steps';

class StubRouter {
  events = new Subject<any>();
  url = '/accueil';
  private navId = 0;
  /** Leve pour simuler une garde qui interrompt la PROCHAINE navigation pilotee. */
  cancelNext = false;
  // Le vrai routeur emet NavigationEnd DANS la transition, avant que la promesse ne se
  // resolve. Un stub qui navigue en silence laisserait le drapeau `navigatingSelf` non
  // consomme et rendrait les tests d'abandon faussement verts.
  navigateByUrl = jasmine.createSpy('navigateByUrl').and.callFake((u: string) => {
    const id = ++this.navId;
    if (this.cancelNext) {
      // Une navigation annulee n'emet PAS NavigationEnd : c'est tout l'interet du cas.
      this.cancelNext = false;
      this.events.next(new NavigationCancel(id, u, 'garde'));
      return Promise.resolve(false);
    }
    this.url = u;
    this.events.next(new NavigationEnd(id, u, u));
    return Promise.resolve(true);
  });
}

class StubDemo {
  activate = jasmine.createSpy('activate').and.resolveTo(undefined);
  deactivate = jasmine.createSpy('deactivate');
}

let router: StubRouter;
let demo: StubDemo;

function service(): TourService {
  localStorage.removeItem(TOUR_SEEN_KEY);
  router = new StubRouter();
  demo = new StubDemo();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      TourService,
      { provide: Router, useValue: router },
      { provide: DemoDataService, useValue: demo },
    ],
  });
  return TestBed.inject(TourService);
}

describe('TourService', () => {
  afterEach(() => localStorage.removeItem(TOUR_SEEN_KEY));

  it('demarre inactif', () => {
    const svc = service();
    expect(svc.active()).toBeFalse();
    expect(svc.stepIndex()).toBe(0);
  });

  it('start active la demo et navigue vers la premiere etape', async () => {
    const svc = service();
    await svc.start();

    expect(demo.activate).toHaveBeenCalled();
    expect(svc.active()).toBeTrue();
    expect(router.navigateByUrl).toHaveBeenCalledWith(TOUR_STEPS[0].route);
  });

  it('next avance et navigue vers la route de l etape', async () => {
    const svc = service();
    await svc.start();
    await svc.next();

    expect(svc.stepIndex()).toBe(1);
    expect(svc.currentStep()?.id).toBe(TOUR_STEPS[1].id);
    expect(router.navigateByUrl).toHaveBeenCalledWith(TOUR_STEPS[1].route);
  });

  it('previous recule sans passer sous zero', async () => {
    const svc = service();
    await svc.start();
    await svc.next();
    await svc.previous();
    expect(svc.stepIndex()).toBe(0);

    await svc.previous();
    expect(svc.stepIndex()).toBe(0);
    expect(svc.active()).toBeTrue();
  });

  it('next sur la derniere etape termine la visite', async () => {
    const svc = service();
    await svc.start();
    for (let i = 0; i < TOUR_STEPS.length; i++) await svc.next();

    expect(svc.active()).toBeFalse();
    expect(demo.deactivate).toHaveBeenCalled();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('1');
  });

  it('skip termine, desactive la demo et marque vu', async () => {
    const svc = service();
    await svc.start();
    svc.skip();

    expect(svc.active()).toBeFalse();
    expect(demo.deactivate).toHaveBeenCalled();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('1');
  });

  it('currentStep vaut null hors visite', async () => {
    const svc = service();
    expect(svc.currentStep()).toBeNull();

    await svc.start();
    expect(svc.currentStep()).not.toBeNull();

    svc.skip();
    expect(svc.currentStep()).toBeNull();
  });

  it('shouldAutoStart est vrai une seule fois', async () => {
    const svc = service();
    expect(svc.shouldAutoStart()).toBeTrue();
    await svc.start();
    svc.skip();
    expect(svc.shouldAutoStart()).toBeFalse();
  });

  it('rejouer repart de la premiere etape', async () => {
    const svc = service();
    await svc.start();
    await svc.next();
    svc.skip();
    await svc.start();

    expect(svc.stepIndex()).toBe(0);
    expect(svc.active()).toBeTrue();
    expect(demo.activate).toHaveBeenCalledTimes(2);
  });

  it('une navigation hors parcours termine la visite', async () => {
    const svc = service();
    await svc.start();

    router.events.next(new NavigationEnd(1, '/galerie', '/galerie'));

    expect(svc.active()).toBeFalse();
    expect(demo.deactivate).toHaveBeenCalled();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('1');
  });

  it('la navigation pilotee par la visite ne l interrompt pas', async () => {
    const svc = service();
    await svc.start();
    await svc.next();
    await svc.next();

    expect(svc.active()).toBeTrue();
    expect(svc.stepIndex()).toBe(2);
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBeNull();
  });

  it('une navigation pilotee annulee ne bloque pas l abandon suivant', async () => {
    const svc = service();
    await svc.start();

    // Une garde interrompt le passage a l'etape suivante : NavigationCancel, jamais
    // NavigationEnd. Le drapeau doit retomber malgre tout.
    router.cancelNext = true;
    await svc.next();

    // L'utilisateur s'en va de son plein gre : sa navigation ne doit pas etre prise pour
    // celle de la visite, sinon la visite ne se terminerait jamais.
    router.events.next(new NavigationEnd(100, '/galerie', '/galerie'));

    expect(svc.active()).toBeFalse();
  });
});
