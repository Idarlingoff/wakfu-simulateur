import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginPageComponent } from './login-page.component';
import { AuthService } from '../services/auth.service';
import { LocalDataImportService } from '../services/storage/local-data-import.service';

describe('LoginPageComponent', () => {
  function configure(authOverrides: Partial<AuthService> = {}) {
    const auth = {
      signIn: jasmine.createSpy('signIn').and.returnValue(Promise.resolve({ ok: true })),
      ...authOverrides,
    };
    TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance as any, auth };
  }

  it('n appelle pas signIn si les champs sont vides', async () => {
    const { component, auth } = configure();
    await component.submit();
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(component.error()).toBe('Renseigne ton email et ton mot de passe.');
  });

  it('appelle signIn avec les identifiants saisis', async () => {
    const { component, auth } = configure();
    component.email = 'a@b.c';
    component.password = 'motdepasse8';
    await component.submit();
    expect(auth.signIn).toHaveBeenCalledWith('a@b.c', 'motdepasse8');
  });

  it('affiche l erreur retournee par le service', async () => {
    const { component } = configure({
      signIn: jasmine.createSpy('signIn').and.returnValue(
        Promise.resolve({ ok: false, error: 'Email ou mot de passe incorrect.' })
      ),
    } as any);
    component.email = 'a@b.c';
    component.password = 'faux';
    await component.submit();
    expect(component.error()).toBe('Email ou mot de passe incorrect.');
    expect(component.loading()).toBe(false);
  });

  it('retombe a loading=false meme apres une erreur', async () => {
    const { component } = configure({
      signIn: jasmine.createSpy('signIn').and.returnValue(
        Promise.resolve({ ok: false, error: 'Service indisponible, tu peux continuer sans compte.' })
      ),
    } as any);
    component.email = 'a@b.c';
    component.password = 'motdepasse8';
    await component.submit();
    expect(component.loading()).toBe(false);
  });

  describe('proposition d import apres connexion', () => {
    function configureWithImport(opts: { hasLocalData: boolean; alreadyImported: boolean }) {
      const auth = {
        signIn: jasmine.createSpy('signIn').and.returnValue(Promise.resolve({ ok: true })),
      };
      const importService = {
        preview: () =>
          Promise.resolve({
            builds: opts.hasLocalData ? [{ id: 'b1' }] : [],
            timelines: [],
          }),
        alreadyImported: () => opts.alreadyImported,
      };
      const router = {
        navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
        // Le template a des RouterLink (liens "mot de passe oublie" / "creer un compte") :
        // leurs directives lisent `routerState.root` et appellent `createUrlTree` a chaque
        // `detectChanges()`. Sans ces stubs, remplacer Router par un mock plante avant meme
        // d'atteindre submit().
        routerState: { root: {} },
        createUrlTree: () => ({}),
        serializeUrl: () => '',
        events: { subscribe: () => ({ unsubscribe: () => undefined }) },
      };

      TestBed.configureTestingModule({
        imports: [LoginPageComponent],
        providers: [
          provideRouter([]),
          { provide: AuthService, useValue: auth },
          { provide: LocalDataImportService, useValue: importService },
          { provide: Router, useValue: router },
        ],
      });
      const fixture = TestBed.createComponent(LoginPageComponent);
      fixture.detectChanges();
      return { component: fixture.componentInstance as any, router };
    }

    it('redirige vers /import quand des donnees locales n ont pas encore ete importees', async () => {
      const { component, router } = configureWithImport({ hasLocalData: true, alreadyImported: false });
      component.email = 'a@b.c';
      component.password = 'motdepasse8';
      await component.submit();
      expect(router.navigate).toHaveBeenCalledWith(['/import']);
    });

    it('va a l accueil quand ce navigateur a deja importe', async () => {
      const { component, router } = configureWithImport({ hasLocalData: true, alreadyImported: true });
      component.email = 'a@b.c';
      component.password = 'motdepasse8';
      await component.submit();
      expect(router.navigate).toHaveBeenCalledWith(['/accueil']);
    });

    it('va a l accueil quand il n y a aucune donnee locale', async () => {
      const { component, router } = configureWithImport({ hasLocalData: false, alreadyImported: false });
      component.email = 'a@b.c';
      component.password = 'motdepasse8';
      await component.submit();
      expect(router.navigate).toHaveBeenCalledWith(['/accueil']);
    });
  });
});
