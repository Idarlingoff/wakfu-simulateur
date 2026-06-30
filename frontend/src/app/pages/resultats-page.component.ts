import { Component } from '@angular/core';
import { DamageSummaryComponent } from '../components/damage-summary.component';
import { TimelineSummaryComponent } from '../components/timeline-summary.component';
import { IconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-resultats-page',
  standalone: true,
  imports: [DamageSummaryComponent, TimelineSummaryComponent, IconComponent],
  template: `
    <section class="page-head">
      <span class="page-icon"><ui-icon name="activity"></ui-icon></span>
      <div>
        <h1>Résultats</h1>
        <p>Les dégâts et le déroulé de ta dernière simulation.</p>
      </div>
    </section>
    <div class="resultats">
      <app-damage-summary></app-damage-summary>
      <app-timeline-summary></app-timeline-summary>
    </div>
  `,
  styles: [`
    .page-head { display: flex; align-items: center; gap: 14px; max-width: 1100px; margin: 0 auto; padding: 20px 20px 0; color: var(--app-text); }
    .page-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: color-mix(in srgb, var(--app-accent) 14%, transparent); color: var(--app-accent); }
    .page-head h1 { margin: 0; }
    .page-head p { margin: 2px 0 0; color: var(--app-text-muted); font-size: 14px; }
    .resultats { max-width: 1100px; margin: 0 auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }
  `],
})
export class ResultatsPageComponent {}
