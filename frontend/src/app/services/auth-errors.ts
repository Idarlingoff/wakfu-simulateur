/**
 * Traduit une erreur Supabase en message francais affichable.
 *
 * Aucun message brut ne doit atteindre l'utilisateur : tout ce qui n'est pas
 * explicitement reconnu retombe sur un message generique.
 */
export interface AuthErrorLike {
  message?: string;
}

const FALLBACK = 'Une erreur est survenue, reessaie.';

/** Partage avec AuthService, qui refuse un pseudo pris avant meme d'appeler Supabase. */
export const USERNAME_TAKEN_MESSAGE = 'Ce pseudo est deja utilise.';

const RULES: ReadonlyArray<{ match: RegExp; message: string }> = [
  { match: /invalid login credentials/i, message: 'Email ou mot de passe incorrect.' },
  { match: /already registered|already exists/i, message: 'Un compte existe deja avec cet email.' },
  { match: /email not confirmed/i, message: 'Confirme ton email avant de te connecter.' },
  { match: /password should be at least/i, message: 'Le mot de passe doit faire au moins 8 caracteres.' },
  { match: /failed to fetch|network|fetch error/i, message: 'Service indisponible, tu peux continuer sans compte.' },
  { match: /profiles_username_key|duplicate key/i, message: USERNAME_TAKEN_MESSAGE },
];

export function toFrenchAuthMessage(error: AuthErrorLike | null | undefined): string {
  const raw = error?.message;
  if (!raw) {
    return FALLBACK;
  }
  return RULES.find(rule => rule.match.test(raw))?.message ?? FALLBACK;
}
