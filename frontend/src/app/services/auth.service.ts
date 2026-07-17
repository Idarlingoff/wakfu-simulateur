import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { Profile } from '../models/profile.model';
import { toFrenchAuthMessage, USERNAME_TAKEN_MESSAGE } from './auth-errors';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

/** Resultat d'une action d'auth : jamais d'exception, toujours un message pret a afficher. */
export interface AuthResult {
  ok: boolean;
  error?: string;
}

/**
 * Seul point de contact de l'application avec l'authentification.
 *
 * Invariant : ce service n'est JAMAIS dans le chemin critique de la simulation.
 * Toute panne (Supabase injoignable, session expiree, hors-ligne) retombe
 * silencieusement en mode invite ; builds, timelines et simulation continuent.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseClientService);

  private readonly _status = signal<AuthStatus>('loading');
  private readonly _profile = signal<Profile | null>(null);

  readonly status = this._status.asReadonly();
  readonly profile = this._profile.asReadonly();

  /** Id de l'utilisateur connecte, ou null. Necessaire au cloisonnement du miroir. */
  readonly userId = computed(() => this._profile()?.id ?? null);

  readonly isAuthenticated = computed(() => this._status() === 'authenticated');

  /** Resolue quand la resolution de session en cours est terminee (utilisee par les tests). */
  private pending: Promise<void> = Promise.resolve();

  /** Invalide les applySession en vol : seule la generation la plus recente ecrit l'etat. */
  private generation = 0;

  constructor() {
    this.pending = this.restoreSession();
  }

  /** Attend la fin de la resolution de session en cours. */
  ready(): Promise<void> {
    return this.pending;
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
      return error ? { ok: false, error: toFrenchAuthMessage(error) } : { ok: true };
    } catch (e) {
      return { ok: false, error: toFrenchAuthMessage(e as { message?: string }) };
    }
  }

  /**
   * Verifie d'abord l'unicite du pseudo : sans ce controle, Supabase remonterait une
   * violation de contrainte brute, inexploitable comme erreur de champ.
   */
  async signUp(email: string, password: string, username: string): Promise<AuthResult> {
    try {
      if (await this.isUsernameTaken(username)) {
        return { ok: false, error: USERNAME_TAKEN_MESSAGE };
      }
      const { error } = await this.supabase.client.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      return error ? { ok: false, error: toFrenchAuthMessage(error) } : { ok: true };
    } catch (e) {
      return { ok: false, error: toFrenchAuthMessage(e as { message?: string }) };
    }
  }

  async signOut(): Promise<AuthResult> {
    try {
      await this.supabase.client.auth.signOut();
      this.toAnonymous();
      return { ok: true };
    } catch (e) {
      // Meme si Supabase echoue, on veut que l'utilisateur soit deconnecte localement.
      this.toAnonymous();
      return { ok: false, error: toFrenchAuthMessage(e as { message?: string }) };
    }
  }

  async requestPasswordReset(email: string): Promise<AuthResult> {
    try {
      const { error } = await this.supabase.client.auth.resetPasswordForEmail(email);
      return error ? { ok: false, error: toFrenchAuthMessage(error) } : { ok: true };
    } catch (e) {
      return { ok: false, error: toFrenchAuthMessage(e as { message?: string }) };
    }
  }

  private async isUsernameTaken(username: string): Promise<boolean> {
    const { data } = await this.supabase.client
      .from('profiles')
      .select('id, username')
      .eq('username', username)
      .single();
    // Fail-open volontaire : une erreur (RLS, reseau) se lit comme "pseudo libre".
    // La contrainte unique en base reste le vrai garde-fou, et son erreur est traduite.
    return !!data;
  }

  private async restoreSession(): Promise<void> {
    // Abonnement AVANT toute operation faillible : si getSession() echoue, le listener
    // doit exister malgre tout, sinon une connexion ulterieure reussirait cote Supabase
    // sans jamais mettre l'UI a jour, jusqu'au prochain rechargement de la page.
    this.supabase.client.auth.onAuthStateChange((event, session) => {
      // Supabase rejoue INITIAL_SESSION a chaque nouvel abonnement : le getSession()
      // ci-dessous traite deja cet etat, le rejouer relancerait une requete profiles
      // inutile et rouvrirait une fenetre d'ecrasement par un etat obsolete.
      if (event === 'INITIAL_SESSION') {
        return;
      }
      this.pending = this.applySession(session);
    });

    try {
      const { data } = await this.supabase.client.auth.getSession();
      await this.applySession(data.session);
    } catch {
      this.toAnonymous();
    }
  }

  private async applySession(session: { user?: { id: string } } | null): Promise<void> {
    const userId = session?.user?.id;
    if (!userId) {
      this.toAnonymous();
      return;
    }

    const generation = ++this.generation;
    const profile = await this.loadProfile(userId);

    // Un evenement plus recent a pris la main pendant le chargement du profil
    // (ex. signOut) : ne pas ecraser son etat avec le notre, devenu obsolete.
    if (generation !== this.generation) {
      return;
    }
    this._profile.set(profile);
    this._status.set('authenticated');
  }

  private toAnonymous(): void {
    this.generation++;
    this._profile.set(null);
    this._status.set('anonymous');
  }

  private async loadProfile(userId: string): Promise<Profile | null> {
    try {
      const { data } = await this.supabase.client
        .from('profiles')
        .select('id, username')
        .eq('id', userId)
        .single();
      return (data as Profile) ?? null;
    } catch {
      // Le profil est accessoire : mieux vaut un utilisateur connecte sans pseudo
      // affiche qu'une session cassee.
      return null;
    }
  }
}
