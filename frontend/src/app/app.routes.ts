import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home.component';
import { WorkspacePageComponent } from './pages/workspace-page.component';
import { BuildsPageComponent, ComparaisonPageComponent } from './pages/placeholder-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'accueil', pathMatch: 'full' },
  { path: 'accueil', component: HomeComponent },
  { path: 'builds', component: BuildsPageComponent },
  { path: 'timelines', component: WorkspacePageComponent },
  { path: 'freeplay', component: WorkspacePageComponent },
  { path: 'comparaison', component: ComparaisonPageComponent },
  { path: '**', redirectTo: 'accueil' },
];
