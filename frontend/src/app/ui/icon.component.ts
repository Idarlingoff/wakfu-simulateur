import { Component, computed, input } from '@angular/core';

/** Jeu minimal d'icônes inline (24x24, currentColor) pour la navigation. */
const ICON_PATHS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  play: 'M8 5v14l11-7z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  menu: 'M4 6h16M4 12h16M4 18h16',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  'user-plus': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  check: 'M20 6 9 17l-5-5',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2ZM17 21v-8H7v8M7 3v5h8',
  grid: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  'log-in': 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  'log-out': 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.6 9.5a2.5 2.5 0 0 1 4.86.83c0 1.67-2.5 2.5-2.5 2.5M12 18a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
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
