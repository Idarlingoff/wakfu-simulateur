import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PasswordResetPageComponent } from './password-reset-page.component';
import { AuthService } from '../services/auth.service';

describe('PasswordResetPageComponent', () => {
  function configure(result: any = { ok: true }) {
    const auth = {
      requestPasswordReset: jasmine
        .createSpy('requestPasswordReset')
        .and.returnValue(Promise.resolve(result)),
    };
    TestBed.configureTestingModule({
      imports: [PasswordResetPageComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(PasswordResetPageComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance as any, auth };
  }

  it('exige un email', async () => {
    const { component, auth } = configure();
    await component.submit();
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();
    expect(component.error()).toBe('Renseigne ton email.');
  });

  it('appelle le service avec l email saisi', async () => {
    const { component, auth } = configure();
    component.email = 'a@b.c';
    await component.submit();
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('a@b.c');
    expect(component.submitted()).toBe(true);
  });

  it('affiche une erreur en cas d echec', async () => {
    const { component } = configure({
      ok: false,
      error: 'Service indisponible, tu peux continuer sans compte.',
    });
    component.email = 'a@b.c';
    await component.submit();
    expect(component.error()).toBe('Service indisponible, tu peux continuer sans compte.');
    expect(component.submitted()).toBe(false);
  });
});
