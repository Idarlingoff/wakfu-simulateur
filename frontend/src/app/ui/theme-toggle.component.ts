import { Component, computed, inject } from '@angular/core';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'ui-theme-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="ui-theme-toggle"
      [attr.aria-pressed]="isDark()"
      [attr.aria-label]="isDark() ? 'Activer le theme clair' : 'Activer le theme sombre'"
      (click)="theme.toggle()"
    >
      <span aria-hidden="true">{{ isDark() ? '☾' : '☀' }}</span>
    </button>
  `,
  styles: [`
    .ui-theme-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid var(--app-border);
      background: var(--app-surface);
      color: var(--app-text);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
    }
    .ui-theme-toggle:hover { border-color: var(--app-border-strong); }
    .ui-theme-toggle:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; }
  `],
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly isDark = computed(() => this.theme.theme() === 'dark');
}
