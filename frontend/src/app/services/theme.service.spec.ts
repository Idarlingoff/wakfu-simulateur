import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.removeItem('wakfu-theme');
    document.documentElement.removeAttribute('data-theme');
    // ThemeService est providedIn:'root' : on réinitialise le module de test pour
    // garantir une instance fraîche par test (constructeur re-exécuté), indépendamment
    // de l'ordre d'exécution et du teardown automatique du TestBed.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ThemeService] });
  });

  it('applique le theme stocke au demarrage', () => {
    localStorage.setItem('wakfu-theme', 'light');
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('setTheme met a jour le signal, l attribut et le stockage', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('light');
    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('wakfu-theme')).toBe('light');
  });

  it('toggle bascule entre sombre et clair', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('dark');
    service.toggle();
    expect(service.theme()).toBe('light');
    service.toggle();
    expect(service.theme()).toBe('dark');
  });
});
