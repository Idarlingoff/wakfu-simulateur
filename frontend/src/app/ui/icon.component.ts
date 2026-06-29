import { Component, computed, input } from '@angular/core';

/** Jeu minimal d'icônes inline (24x24, currentColor) pour la navigation. */
const ICON_PATHS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  play: 'M8 5v14l11-7z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  menu: 'M4 6h16M4 12h16M4 18h16',
};

@Component({
  selector: 'ui-icon',
  standalone: true,
  template: `
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @if (path()) {
        <path [attr.d]="path()"></path>
      }
    </svg>
  `,
  styles: [`:host { display: inline-flex; line-height: 0; }`],
})
export class IconComponent {
  readonly name = input<string>('');
  protected readonly path = computed(() => ICON_PATHS[this.name()] ?? '');
}
