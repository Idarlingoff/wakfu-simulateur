import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AppSidebarComponent } from './app-sidebar.component';
import { AuthService } from '../services/auth.service';

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
    expect(links.length).toBe(7);
    expect(fixture.nativeElement.textContent).toContain('Accueil');
    expect(fixture.nativeElement.textContent).toContain('Galerie');
    expect(fixture.nativeElement.textContent).toContain('Résultats');
    expect(fixture.nativeElement.textContent).toContain('Comparaison');
  });
});

describe('AppSidebarComponent — etat de connexion', () => {
  function configure(status: 'loading' | 'authenticated' | 'anonymous', username?: string) {
    const auth = {
      status: signal(status),
      profile: signal(username ? { id: 'u1', username } : null),
      isAuthenticated: signal(status === 'authenticated'),
      signOut: jasmine.createSpy('signOut').and.returnValue(Promise.resolve({ ok: true })),
    };
    TestBed.configureTestingModule({
      imports: [AppSidebarComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();
    return { fixture, auth };
  }

  it('propose de se connecter quand on est invite', () => {
    const { fixture } = configure('anonymous');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Se connecter');
  });

  it('affiche le pseudo quand on est connecte', () => {
    const { fixture } = configure('authenticated', 'Lilia');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Lilia');
    expect(text).not.toContain('Se connecter');
  });

  // Evite le flash "Se connecter" au rafraichissement pour un utilisateur deja connecte.
  it('n affiche rien pendant la resolution de session', () => {
    const { fixture } = configure('loading');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Se connecter');
  });
});
