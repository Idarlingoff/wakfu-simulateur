import { Component } from '@angular/core';
import { DashboardComponent } from '../components/dashboard.component';

@Component({
  selector: 'app-timeline-page',
  standalone: true,
  imports: [DashboardComponent],
  template: `<app-dashboard mode="timeline"></app-dashboard>`,
})
export class TimelinePageComponent {}
