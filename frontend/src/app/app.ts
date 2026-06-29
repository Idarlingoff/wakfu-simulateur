import { Component, inject } from '@angular/core';
import { DashboardComponent } from './components/dashboard.component';
import { ThemeToggleComponent } from './ui/theme-toggle.component';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DashboardComponent, ThemeToggleComponent],
  template: `
    <div class="app-toolbar">
      <ui-theme-toggle></ui-theme-toggle>
    </div>
    <app-dashboard></app-dashboard>
  `,
  styles: [`
    .app-toolbar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 8px 12px;
    }
  `],
})
export class App {
  private readonly theme = inject(ThemeService);
}
