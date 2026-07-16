import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupPageComponent } from './signup-page.component';
import { AuthService } from '../services/auth.service';

describe('SignupPageComponent', () => {
  function configure(signUpResult: any = { ok: true }) {
    const auth = {
      signUp: jasmine.createSpy('signUp').and.returnValue(Promise.resolve(signUpResult)),
    };
    TestBed.configureTestingModule({
      imports: [SignupPageComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(SignupPageComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance as any, auth };
  }

  it('exige tous les champs', async () => {
    const { component, auth } = configure();
    await component.submit();
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(component.error()).toBe('Tous les champs sont obligatoires.');
  });

  it('refuse un mot de passe de moins de 8 caracteres sans appeler le service', async () => {
    const { component, auth } = configure();
    component.email = 'a@b.c';
    component.password = 'court';
    component.username = 'Lilia';
    await component.submit();
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(component.error()).toBe('Le mot de passe doit faire au moins 8 caracteres.');
  });

  it('appelle signUp avec email, mot de passe et pseudo', async () => {
    const { component, auth } = configure();
    component.email = 'a@b.c';
    component.password = 'motdepasse8';
    component.username = 'Lilia';
    await component.submit();
    expect(auth.signUp).toHaveBeenCalledWith('a@b.c', 'motdepasse8', 'Lilia');
  });

  // La confirmation d'email est requise : on ne redirige pas, on informe.
  it('affiche l ecran de confirmation apres une inscription reussie', async () => {
    const { component } = configure({ ok: true });
    component.email = 'a@b.c';
    component.password = 'motdepasse8';
    component.username = 'Lilia';
    await component.submit();
    expect(component.submitted()).toBe(true);
  });

  it('affiche l erreur de pseudo deja pris', async () => {
    const { component } = configure({ ok: false, error: 'Ce pseudo est deja utilise.' });
    component.email = 'a@b.c';
    component.password = 'motdepasse8';
    component.username = 'Lilia';
    await component.submit();
    expect(component.error()).toBe('Ce pseudo est deja utilise.');
    expect(component.submitted()).toBe(false);
  });
});
