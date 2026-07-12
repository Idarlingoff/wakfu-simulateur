import { TestBed } from '@angular/core/testing';
import { ThemeToggleComponent } from './theme-toggle.component';
import { ThemeService } from '../services/theme.service';

describe('ThemeToggleComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('wakfu-theme');
    document.documentElement.removeAttribute('data-theme');
    // ThemeService est providedIn:'root' : on réinitialise le module de test pour une
    // instance fraîche par test (même pattern que theme.service.spec.ts).
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ThemeToggleComponent] });
  });

  it('bascule le theme au clic et reflete aria-pressed', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('dark');
    const fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    fixture.detectChanges();
    expect(service.theme()).toBe('light');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
});
