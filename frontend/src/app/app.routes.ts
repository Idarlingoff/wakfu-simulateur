import { Routes } from '@angular/router';
import { SimulationComponent } from './components/simulation.component';
import { DashboardComponent } from './components/dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'simulation', component: SimulationComponent },
  { path: '**', redirectTo: '/dashboard' }
];

