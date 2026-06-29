import { Component } from '@angular/core';
import { DashboardComponent } from '../components/dashboard.component';

@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [DashboardComponent],
  template: `<app-dashboard></app-dashboard>`,
})
export class WorkspacePageComponent {}
