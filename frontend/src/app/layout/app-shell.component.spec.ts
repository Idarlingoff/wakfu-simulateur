import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShellComponent } from './app-shell.component';

describe('AppShellComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [provideRouter([])],
    });
  });

  it('rend la sidebar, la barre superieure et un router-outlet', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-sidebar')).toBeTruthy();
    expect(el.querySelector('header.appbar')).toBeTruthy();
    expect(el.querySelector('ui-theme-toggle')).toBeTruthy();
    expect(el.querySelector('router-outlet')).toBeTruthy();
  });

  it('bascule l etat de la sidebar via le bouton menu', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    const cmp = fixture.componentInstance;
    fixture.detectChanges();
    const before = cmp.sidebarExpanded();
    (fixture.nativeElement.querySelector('button.menu-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(cmp.sidebarExpanded()).toBe(!before);
  });
});
