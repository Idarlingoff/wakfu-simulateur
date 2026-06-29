import { Component, computed, input } from '@angular/core';

export type UiButtonVariant = 'primary' | 'ghost' | 'danger';

@Component({
  selector: 'button[ui-button]',
  standalone: true,
  host: {
    '[class]': 'hostClass()',
    '[disabled]': 'disabled() || null',
  },
  template: `<ng-content></ng-content>`,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 36px;
      padding: 0 14px;
      border-radius: 8px;
      border: 1px solid transparent;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    :host(:focus-visible) { outline: 2px solid var(--app-focus); outline-offset: 2px; }
    :host([disabled]) { opacity: 0.5; cursor: not-allowed; }
    :host(.ui-btn--primary) { background: var(--app-accent); color: var(--app-accent-contrast); }
    :host(.ui-btn--primary:hover:not([disabled])) { background: var(--app-accent-strong); }
    :host(.ui-btn--ghost) { background: transparent; color: var(--app-text); border-color: var(--app-border); }
    :host(.ui-btn--ghost:hover:not([disabled])) { border-color: var(--app-border-strong); }
    :host(.ui-btn--danger) { background: var(--app-danger); color: #ffffff; }
    :host(.ui-btn--danger:hover:not([disabled])) { filter: brightness(1.12); }
  `],
})
export class UiButtonComponent {
  readonly variant = input<UiButtonVariant>('primary');
  readonly disabled = input<boolean>(false);
  protected readonly hostClass = computed(() => `ui-btn ui-btn--${this.variant()}`);
}
