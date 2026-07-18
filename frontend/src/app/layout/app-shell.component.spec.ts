import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AppShellComponent } from './app-shell.component';
import { AuthService } from '../services/auth.service';
import { LocalDataImportService } from '../services/storage/local-data-import.service';

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

/**
 * La banniere d'import est le SEUL point d'entree pour un utilisateur deja connecte :
 * la page /connexion n'est jamais retraversee quand la session est restauree au
 * chargement, donc sa redirection vers /import ne se declenche pas.
 */
describe('AppShellComponent — banniere d import', () => {
  function configure(pending: boolean) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            // La sidebar est rendue dans la coquille : elle lit aussi profile() et signOut().
            status: signal('authenticated'),
            profile: signal({ id: 'u1', username: 'Lilia' }),
            isAuthenticated: signal(true),
            signOut: () => Promise.resolve({ ok: true }),
          },
        },
        {
          provide: LocalDataImportService,
          useValue: { pending: signal(pending), refreshPending: () => Promise.resolve() },
        },
      ],
    });
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('propose l import quand des donnees locales attendent', () => {
    const el = configure(true);
    const prompt = el.querySelector('.import-prompt');
    expect(prompt).toBeTruthy();
    expect(prompt!.textContent).toContain('Les importer');
    expect(el.querySelector('.import-prompt a')?.getAttribute('href')).toContain('/import');
  });

  it('ne propose rien quand il n y a aucun import en attente', () => {
    expect(configure(false).querySelector('.import-prompt')).toBeNull();
  });
});
