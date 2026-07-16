import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-password-reset-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth-page">
      @if (submitted()) {
        <h1>Vérifie tes mails</h1>
        <p class="info">
          Si un compte existe pour <strong>{{ email }}</strong>, un lien de
          réinitialisation vient d'être envoyé.
        </p>
      } @else {
        <h1>Mot de passe oublié</h1>

        <form (ngSubmit)="submit()">
          <label for="email">Email</label>
          <input id="email" type="email" name="email" [(ngModel)]="email" autocomplete="email" />

          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }

          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Envoi…' : 'Envoyer le lien' }}
          </button>
        </form>
      }

      <nav class="links"><a routerLink="/connexion">Retour à la connexion</a></nav>
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
    .info { font-size: 14px; line-height: 1.5; }
    .links { margin-top: 16px; font-size: 13px; }
  `],
})
export class PasswordResetPageComponent {
  private readonly auth = inject(AuthService);

  email = '';
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly submitted = signal(false);

  async submit(): Promise<void> {
    if (!this.email) {
      this.error.set('Renseigne ton email.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    const result = await this.auth.requestPasswordReset(this.email);
    this.loading.set(false);

    if (result.ok) {
      this.submitted.set(true);
    } else {
      this.error.set(result.error ?? null);
    }
  }
}
