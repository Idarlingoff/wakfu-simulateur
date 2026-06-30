import { Component } from '@angular/core';
import { DashboardComponent } from '../components/dashboard.component';
import { IconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-timeline-page',
  standalone: true,
  imports: [DashboardComponent, IconComponent],
  template: `
    <section class="page-head">
      <span class="page-icon"><ui-icon name="clock"></ui-icon></span>
      <div>
        <h1>Timeline</h1>
        <p>Compose une suite d'actions et déroule la simulation.</p>
      </div>
    </section>
    <app-dashboard mode="timeline"></app-dashboard>
  `,
  styles: [`
    .page-head { display: flex; align-items: center; gap: 14px; max-width: 1100px; margin: 0 auto; padding: 20px 20px 0; color: var(--app-text); }
    .page-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: color-mix(in srgb, var(--app-accent) 14%, transparent); color: var(--app-accent); }
    .page-head h1 { margin: 0; }
    .page-head p { margin: 2px 0 0; color: var(--app-text-muted); font-size: 14px; }
  `],
})
export class TimelinePageComponent {}
