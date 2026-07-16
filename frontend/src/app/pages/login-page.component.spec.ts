import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginPageComponent } from './login-page.component';
import { AuthService } from '../services/auth.service';

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
});
