import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home.component';
import { WorkspacePageComponent } from './pages/workspace-page.component';
import { ComparaisonPageComponent } from './pages/placeholder-page.component';
import { BuildsListComponent } from './pages/builds-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'accueil', pathMatch: 'full' },
  { path: 'accueil', component: HomeComponent },
  { path: 'builds', component: BuildsListComponent },
  { path: 'timelines', component: WorkspacePageComponent },
  { path: 'freeplay', component: WorkspacePageComponent },
  { path: 'comparaison', component: ComparaisonPageComponent },
  { path: '**', redirectTo: 'accueil' },
];
