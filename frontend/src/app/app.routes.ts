import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home.component';
import { TimelinePageComponent } from './pages/timeline-page.component';
import { FreeplayPageComponent } from './pages/freeplay-page.component';
import { ComparaisonPageComponent } from './pages/placeholder-page.component';
import { BuildsListComponent } from './pages/builds-list.component';
import { BuildEditorComponent } from './pages/build-editor.component';
import { ResultatsPageComponent } from './pages/resultats-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { SignupPageComponent } from './pages/signup-page.component';
import { PasswordResetPageComponent } from './pages/password-reset-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'accueil', pathMatch: 'full' },
  { path: 'accueil', component: HomeComponent },
  { path: 'builds', component: BuildsListComponent },
  { path: 'builds/nouveau', component: BuildEditorComponent },
  { path: 'builds/:id/edition', component: BuildEditorComponent },
  { path: 'timelines', component: TimelinePageComponent },
  { path: 'freeplay', component: FreeplayPageComponent },
  { path: 'resultats', component: ResultatsPageComponent },
  { path: 'comparaison', component: ComparaisonPageComponent },
  { path: 'connexion', component: LoginPageComponent },
  { path: 'inscription', component: SignupPageComponent },
  { path: 'mot-de-passe-oublie', component: PasswordResetPageComponent },
  { path: '**', redirectTo: 'accueil' },
];
