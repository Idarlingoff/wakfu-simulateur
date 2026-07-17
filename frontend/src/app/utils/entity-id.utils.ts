/**
 * Genere l'identifiant d'un build ou d'une timeline.
 *
 * DOIT etre un uuid : des qu'un utilisateur est connecte, ces ids sont inseres dans
 * des colonnes Postgres `uuid` (cf. supabase/migrations/0002_builds_timelines.sql).
 * Un id maison du type `build_<timestamp>` y est rejete a l'insertion, et l'echec
 * remonte a l'utilisateur en "Sauvegarde impossible : service indisponible" — message
 * mensonger, puisqu'il s'agit d'un bug permanent et non d'une panne passagere.
 *
 * L'id est genere ici, cote appelant, et non dans le repository Supabase : une timeline
 * reference son build par `buildId`, donc l'id doit etre connu et stable avant meme
 * d'atteindre la couche de stockage.
 */
export function newEntityId(): string {
  return crypto.randomUUID();
}
