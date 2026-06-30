import { Component } from '@angular/core';
import { DashboardComponent } from '../components/dashboard.component';

@Component({
  selector: 'app-freeplay-page',
  standalone: true,
  imports: [DashboardComponent],
  template: `<app-dashboard mode="freeplay"></app-dashboard>`,
})
export class FreeplayPageComponent {}
