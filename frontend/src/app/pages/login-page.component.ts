import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth-page">
      <h1>Connexion</h1>

      <form (ngSubmit)="submit()">
        <label for="email">Email</label>
        <input id="email" type="email" name="email" [(ngModel)]="email" autocomplete="email" />

        <label for="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          name="password"
          [(ngModel)]="password"
          autocomplete="current-password"
        />

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <button type="submit" [disabled]="loading()">
          {{ loading() ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>

      <nav class="links">
        <a routerLink="/mot-de-passe-oublie">Mot de passe oublié ?</a>
        <a routerLink="/inscription">Créer un compte</a>
      </nav>
    </section>
  `,
  styles: [`
    .auth-page { max-width: 360px; margin: 48px auto; padding: 0 16px; }
    h1 { font-size: 20px; margin-bottom: 20px; }
    form { display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 13px; color: var(--app-text-muted, inherit); }
    input {
      padding: 8px 10px;
      margin-bottom: 8px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 6px;
      color: inherit;
    }
    button {
      margin-top: 8px;
      padding: 9px 12px;
      background: var(--app-accent);
      border: 0;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
    }
    button[disabled] { opacity: 0.6; cursor: default; }
    .error { color: #e5484d; font-size: 13px; margin: 4px 0; }
    .links { display: flex; justify-content: space-between; margin-top: 16px; font-size: 13px; }
  `],
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  async submit(): Promise<void> {
    if (!this.email || !this.password) {
      this.error.set('Renseigne ton email et ton mot de passe.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    const result = await this.auth.signIn(this.email, this.password);
    this.loading.set(false);

    if (result.ok) {
      // Non attendu : une eventuelle erreur de navigation (route absente en test,
      // etc.) ne doit jamais faire echouer la soumission du formulaire.
      this.router.navigate(['/accueil']).catch(() => undefined);
    } else {
      this.error.set(result.error ?? null);
    }
  }
}
