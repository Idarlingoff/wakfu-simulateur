/**
 * Deverrouillage des emplacements de passifs par niveau de personnage.
 *
 * Partage entre le selecteur de passifs et l'import de code deck : les deux doivent
 * s'accorder sur ce qui est verrouille, sinon un import peut placer un passif dans un
 * emplacement que l'interface refuse d'afficher.
 */

import { PassiveReference } from '../models/build.model';

export const PASSIVE_UNLOCK_LEVELS: ReadonlyArray<number> = [20, 35, 50, 100, 150, 200];

export function isPassiveSlotUnlocked(index: number, characterLevel: number): boolean {
  const required = PASSIVE_UNLOCK_LEVELS[index];
  return required !== undefined && required <= characterLevel;
}

/**
 * Retourne la barre de passifs debarrassee de ceux qui occupent un emplacement verrouille
 * au niveau donne. Retourne le tableau d'origine si rien ne change, pour ne pas invalider
 * inutilement les bindings du selecteur.
 */
export function prunePassivesForLevel(
  passives: (PassiveReference | null)[],
  characterLevel: number,
): (PassiveReference | null)[] {
  const hasLocked = passives.some((p, i) => p !== null && !isPassiveSlotUnlocked(i, characterLevel));
  if (!hasLocked) {
    return passives;
  }
  return passives.map((p, i) => (isPassiveSlotUnlocked(i, characterLevel) ? p : null));
}
