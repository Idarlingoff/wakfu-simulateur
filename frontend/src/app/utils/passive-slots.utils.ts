/**
 * Deverrouillage des emplacements de passifs par niveau de personnage.
 *
 * Partage entre le selecteur de passifs et l'import de code deck : les deux doivent
 * s'accorder sur ce qui est verrouille, sinon un import peut placer un passif dans un
 * emplacement que l'interface refuse d'afficher.
 */

export const PASSIVE_UNLOCK_LEVELS: ReadonlyArray<number> = [20, 35, 50, 100, 150, 200];

export function isPassiveSlotUnlocked(index: number, characterLevel: number): boolean {
  const required = PASSIVE_UNLOCK_LEVELS[index];
  return required !== undefined && required <= characterLevel;
}
