/**
 * Code deck du jeu : 18 entiers separes par des tirets.
 *
 * Positions 0-5   : sorts des raccourcis 1..6
 * Positions 6-11  : sorts des raccourcis alt+1..alt+6
 * Positions 12-17 : passifs
 *
 * Chaque valeur est l'ID de jeu de l'entite, qui vaut exactement le champ `iconId` des
 * donnees locales et le nom du fichier dans assets/images/spells. `0` = slot vide.
 *
 * Les sorts innes n'apparaissent JAMAIS dans un code deck : le jeu ne les place pas dans
 * le deck, et l'export ne doit pas les emettre.
 */

import { SpellReference, PassiveReference } from '../models/build.model';
import { DECK_SLOT_COUNT } from './spell-shortcuts.utils';

/** Emplacements de passifs d'un build. */
export const DECK_PASSIVE_SLOT_COUNT = 6;

/** Nombre total de segments attendus dans un code deck. */
export const DECK_CODE_SEGMENT_COUNT = DECK_SLOT_COUNT + DECK_PASSIVE_SLOT_COUNT;

/** Slots bruts d'un code deck : iconId de jeu, ou null si le slot est vide. */
export interface DeckCodeSlots {
  spells: (number | null)[];
  passives: (number | null)[];
}

/** Resultat d'un import, avec le detail de ce qui n'a pas pu etre place. */
export interface DeckCodeImportResult {
  spells: (SpellReference | null)[];
  passives: (PassiveReference | null)[];
  unresolvedSpellIcons: number[];
  unresolvedPassiveIcons: number[];
  duplicateSpellIcons: number[];
  duplicatePassiveIcons: number[];
}

export interface DeckCodeReport {
  tone: 'ok' | 'warn' | 'error';
  message: string;
}

export class DeckCodeFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeckCodeFormatError';
  }
}

function slotFromSegment(segment: number): number | null {
  return segment === 0 ? null : segment;
}

/**
 * Decoupe un code deck en slots bruts.
 *
 * Tolere les espaces et les tirets consecutifs : un code copie depuis un forum ou un chat
 * arrive souvent avec du bruit, et refuser sur cette base serait gratuitement penible.
 *
 * @throws DeckCodeFormatError si le nombre de segments differe de 18, ou si un segment
 *         n'est pas un entier positif.
 */
export function parseDeckCode(raw: string): DeckCodeSlots {
  const segments = raw
    .trim()
    .split('-')
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);

  if (segments.length !== DECK_CODE_SEGMENT_COUNT) {
    throw new DeckCodeFormatError(
      `Code deck invalide : ${segments.length} valeur(s) au lieu de ${DECK_CODE_SEGMENT_COUNT}.`,
    );
  }

  const iconIds = segments.map(segment => {
    // Rejette du meme coup les negatifs, les decimaux et le texte.
    if (!/^\d+$/.test(segment)) {
      throw new DeckCodeFormatError(
        `Code deck invalide : « ${segment} » n'est pas un identifiant numérique.`,
      );
    }
    return Number(segment);
  });

  return {
    spells: iconIds.slice(0, DECK_SLOT_COUNT).map(slotFromSegment),
    passives: iconIds.slice(DECK_SLOT_COUNT).map(slotFromSegment),
  };
}

/**
 * Ramene une rangee a exactement `size` slots.
 *
 * La troncature est VOLONTAIRE : un build a 12 sorts et 6 passifs, pas un de plus, et le
 * code deck est a largeur fixe. Tout ce qui depasse est une entree malformee, pas une
 * donnee a preserver.
 */
function padToLength(slots: ReadonlyArray<number | null>, size: number): (number | null)[] {
  const row = slots.slice(0, size);
  while (row.length < size) {
    row.push(null);
  }
  return row;
}

/** Produit toujours 18 segments, `0` pour chaque slot vide, y compris ceux de fin. */
export function formatDeckCode(slots: DeckCodeSlots): string {
  return [
    ...padToLength(slots.spells, DECK_SLOT_COUNT),
    ...padToLength(slots.passives, DECK_PASSIVE_SLOT_COUNT),
  ]
    .map(iconId => String(iconId ?? 0))
    .join('-');
}

function placedCount(slots: ReadonlyArray<unknown | null>): number {
  return slots.filter(slot => slot !== null).length;
}

/**
 * Redige le rapport affiche apres un import.
 *
 * Le denominateur est le nombre de slots NON VIDES du code, pas 12 et 6 : un `0` est un
 * slot volontairement vide, pas un echec. Le code de reference doit lire « 12/12 sorts et
 * 5/5 passifs » en vert, sans avertissement pour son dernier slot vide.
 */
export function describeImportResult(result: DeckCodeImportResult): DeckCodeReport {
  const spellsPlaced = placedCount(result.spells);
  const spellsTotal =
    spellsPlaced + result.unresolvedSpellIcons.length + result.duplicateSpellIcons.length;
  const passivesPlaced = placedCount(result.passives);
  const passivesTotal =
    passivesPlaced + result.unresolvedPassiveIcons.length + result.duplicatePassiveIcons.length;

  const counts = `${spellsPlaced}/${spellsTotal} sorts et ${passivesPlaced}/${passivesTotal} passifs importés`;

  // Les listes affichees sont dedupliquees, pas les compteurs : si un meme ID inconnu
  // occupe deux slots, deux slots ont bien echoue (le denominateur le dit), mais l'usager
  // n'a qu'un seul identifiant a corriger, et le lire deux fois n'aide pas.
  const problems: string[] = [];
  const unknown = [...new Set([...result.unresolvedSpellIcons, ...result.unresolvedPassiveIcons])];
  if (unknown.length > 0) {
    problems.push(`inconnus : ${unknown.join(', ')}`);
  }
  const duplicates = [...new Set([...result.duplicateSpellIcons, ...result.duplicatePassiveIcons])];
  if (duplicates.length > 0) {
    problems.push(`en double : ${duplicates.join(', ')}`);
  }

  if (problems.length === 0) {
    return { tone: 'ok', message: counts };
  }
  return { tone: 'warn', message: `${counts} — identifiants ignorés (${problems.join(' ; ')})` };
}
