import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
import { TourService } from '../services/tour.service';

class StubTour {
  shouldAutoStart = jasmine.createSpy('shouldAutoStart').and.returnValue(false);
  start = jasmine.createSpy('start').and.resolveTo(undefined);
}

function configure(tour: StubTour) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [HomeComponent],
    providers: [provideRouter([]), { provide: TourService, useValue: tour }],
  });
}

describe('HomeComponent', () => {
  beforeEach(() => configure(new StubTour()));

  it('rend une carte par section', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('a.card');
    expect(cards.length).toBe(5);
  });
});

/**
 * Le declenchement automatique vit dans le constructeur : c'est le seul point qui garantit
 * qu'un nouvel arrivant traverse la visite sans jamais la relancer une fois vue.
 */
describe('HomeComponent — declenchement automatique de la visite', () => {
  it('demarre la visite quand elle n a jamais ete vue', () => {
    const tour = new StubTour();
    tour.shouldAutoStart.and.returnValue(true);
    configure(tour);

    TestBed.createComponent(HomeComponent);

    expect(tour.start).toHaveBeenCalled();
  });

  it('ne demarre pas la visite quand elle a deja ete vue ou passee', () => {
    const tour = new StubTour();
    tour.shouldAutoStart.and.returnValue(false);
    configure(tour);

    TestBed.createComponent(HomeComponent);

    expect(tour.start).not.toHaveBeenCalled();
  });
});
