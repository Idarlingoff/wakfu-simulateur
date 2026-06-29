import { Injectable, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'wakfu-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<AppTheme>(this.resolveInitialTheme());
  readonly theme = this._theme.asReadonly();

  constructor() {
    this.apply(this._theme());
  }

  setTheme(theme: AppTheme): void {
    this._theme.set(theme);
    this.apply(theme);
  }

  toggle(): void {
    this.setTheme(this._theme() === 'dark' ? 'light' : 'dark');
  }

  private resolveInitialTheme(): AppTheme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      /* localStorage indisponible */
    }
    const prefersLight =
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  }

  private apply(theme: AppTheme): void {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* localStorage indisponible */
    }
  }
}
