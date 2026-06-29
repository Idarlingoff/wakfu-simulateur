import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppSidebarComponent } from './app-sidebar.component';

describe('AppSidebarComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AppSidebarComponent],
      providers: [provideRouter([])],
    });
  });

  it('rend un lien de navigation par section', () => {
    const fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll('a.nav-item');
    expect(links.length).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('Accueil');
    expect(fixture.nativeElement.textContent).toContain('Comparaison');
  });
});
