import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { TourService } from './services/tour.service';

class StubTour {
  active = signal(false);
  currentStep = signal(null);
  stepIndex = signal(0);
  steps: unknown[] = [];
  shouldAutoStart = jasmine.createSpy('shouldAutoStart').and.returnValue(false);
  start = jasmine.createSpy('start').and.resolveTo(undefined);
  next = jasmine.createSpy('next').and.resolveTo(undefined);
  previous = jasmine.createSpy('previous').and.resolveTo(undefined);
  skip = jasmine.createSpy('skip');
  finish = jasmine.createSpy('finish');
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: TourService, useValue: new StubTour() }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
