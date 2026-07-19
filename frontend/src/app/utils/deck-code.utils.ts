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

function toSlot(iconId: number): number | null {
  return iconId === 0 ? null : iconId;
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
  const segments = (raw ?? '')
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
        `Code deck invalide : « ${segment} » n'est pas un identifiant numerique.`,
      );
    }
    return Number(segment);
  });

  return {
    spells: iconIds.slice(0, DECK_SLOT_COUNT).map(toSlot),
    passives: iconIds.slice(DECK_SLOT_COUNT).map(toSlot),
  };
}

function fixedLength(slots: ReadonlyArray<number | null>, size: number): (number | null)[] {
  const row = slots.slice(0, size);
  while (row.length < size) {
    row.push(null);
  }
  return row;
}

/** Produit toujours 18 segments, `0` pour chaque slot vide, y compris ceux de fin. */
export function formatDeckCode(slots: DeckCodeSlots): string {
  return [
    ...fixedLength(slots.spells, DECK_SLOT_COUNT),
    ...fixedLength(slots.passives, DECK_PASSIVE_SLOT_COUNT),
  ]
    .map(iconId => String(iconId ?? 0))
    .join('-');
}
