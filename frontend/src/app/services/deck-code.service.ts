/**
 * Traduit un code deck du jeu en references de sorts et de passifs, et inversement.
 *
 * La cle de correspondance est `iconId`, l'ID de jeu present dans nos donnees. Il est
 * unique dans la table des sorts comme dans celle des passifs, ce qui rend l'index sur.
 */

import { Injectable, inject } from '@angular/core';
import { DataCacheService } from './data-cache.service';
import { PassiveReference, SpellReference } from '../models/build.model';
import { DeckCodeImportResult, parseDeckCode } from '../utils/deck-code.utils';

/** Vue minimale commune aux sorts et aux passifs, seul ce qui sert a la resolution. */
interface IconEntry {
  id: string;
  iconId?: number;
}

function indexByIcon(entries: ReadonlyArray<IconEntry>): Map<number, IconEntry> {
  const index = new Map<number, IconEntry>();
  for (const entry of entries) {
    if (typeof entry.iconId === 'number') {
      index.set(entry.iconId, entry);
    }
  }
  return index;
}

/**
 * Resout une rangee de slots.
 *
 * `used` est partage entre sorts et passifs : un meme iconId ne peut etre place qu'une
 * seule fois dans tout le deck, comme le selecteur de sorts l'impose deja.
 */
function resolveRow(
  row: ReadonlyArray<number | null>,
  index: Map<number, IconEntry>,
  used: Set<number>,
  unresolved: number[],
  duplicates: number[],
): (IconEntry | null)[] {
  return row.map(iconId => {
    if (iconId === null) {
      return null;
    }
    if (used.has(iconId)) {
      duplicates.push(iconId);
      return null;
    }
    const entry = index.get(iconId);
    if (!entry) {
      unresolved.push(iconId);
      return null;
    }
    used.add(iconId);
    return entry;
  });
}

@Injectable({ providedIn: 'root' })
export class DeckCodeService {
  private readonly dataCache = inject(DataCacheService);

  /**
   * @throws DeckCodeFormatError si la chaine n'est pas un code deck valide.
   */
  async decode(code: string, classId: string): Promise<DeckCodeImportResult> {
    const slots = parseDeckCode(code);
    const [allSpells, allPassives] = await Promise.all([
      this.dataCache.getSpells(classId),
      this.dataCache.getPassives(classId),
    ]);

    const unresolvedSpellIcons: number[] = [];
    const unresolvedPassiveIcons: number[] = [];
    const duplicateSpellIcons: number[] = [];
    const duplicatePassiveIcons: number[] = [];
    const used = new Set<number>();

    const spellEntries = resolveRow(
      slots.spells, indexByIcon(allSpells), used, unresolvedSpellIcons, duplicateSpellIcons,
    );
    const passiveEntries = resolveRow(
      slots.passives, indexByIcon(allPassives), used, unresolvedPassiveIcons, duplicatePassiveIcons,
    );

    return {
      spells: spellEntries.map(entry =>
        entry ? ({ spellId: entry.id, iconId: entry.iconId } as SpellReference) : null,
      ),
      passives: passiveEntries.map(entry =>
        entry ? ({ passiveId: entry.id, iconId: entry.iconId } as PassiveReference) : null,
      ),
      unresolvedSpellIcons,
      unresolvedPassiveIcons,
      duplicateSpellIcons,
      duplicatePassiveIcons,
    };
  }
}
