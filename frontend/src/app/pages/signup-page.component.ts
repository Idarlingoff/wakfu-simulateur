import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-signup-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth-page">
      @if (submitted()) {
        <h1>Vérifie tes mails</h1>
        <p class="info">
          On a envoyé un lien de confirmation à <strong>{{ email }}</strong>.
          Clique dessus pour activer ton compte, puis connecte-toi.
        </p>
        <nav class="links"><a routerLink="/connexion">Retour à la connexion</a></nav>
      } @else {
        <h1>Créer un compte</h1>

        <form (ngSubmit)="submit()">
          <label for="username">Pseudo</label>
          <input id="username" type="text" name="username" [(ngModel)]="username" autocomplete="nickname" />

          <label for="email">Email</label>
          <input id="email" type="email" name="email" [(ngModel)]="email" autocomplete="email" />

          <label for="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            name="password"
            [(ngModel)]="password"
            autocomplete="new-password"
          />
          <small>Au moins {{ minLength }} caractères.</small>

          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }

          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Création…' : 'Créer mon compte' }}
          </button>
        </form>

        <nav class="links"><a routerLink="/connexion">J'ai déjà un compte</a></nav>
      }
    </section>
  `,
  styles: [`
    .auth-page { max-width: 360px; margin: 48px auto; padding: 0 16px; }
    h1 { font-size: 20px; margin-bottom: 20px; }
    form { display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 13px; color: var(--app-text-muted, inherit); }
    input {
      padding: 8px 10px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 6px;
      color: inherit;
    }
    small { font-size: 12px; opacity: 0.7; margin-bottom: 8px; }
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
    .info { font-size: 14px; line-height: 1.5; }
    .links { display: flex; justify-content: space-between; margin-top: 16px; font-size: 13px; }
  `],
})
export class SignupPageComponent {
  private readonly auth = inject(AuthService);

  readonly minLength = MIN_PASSWORD_LENGTH;

  email = '';
  password = '';
  username = '';
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly submitted = signal(false);

  async submit(): Promise<void> {
    if (!this.email || !this.password || !this.username) {
      this.error.set('Tous les champs sont obligatoires.');
      return;
    }
    if (this.password.length < MIN_PASSWORD_LENGTH) {
      this.error.set('Le mot de passe doit faire au moins 8 caracteres.');
      return;
    }

    this.error.set(null);
    this.loading.set(true);
    const result = await this.auth.signUp(this.email, this.password, this.username);
    this.loading.set(false);

    if (result.ok) {
      // Confirmation d'email requise : le compte n'est pas utilisable tout de suite,
      // on informe au lieu de rediriger vers une connexion qui echouerait.
      this.submitted.set(true);
    } else {
      this.error.set(result.error ?? null);
    }
  }
}
