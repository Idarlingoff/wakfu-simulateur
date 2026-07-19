/**
 * Traduit un code deck du jeu en references de sorts et de passifs, et inversement.
 *
 * La cle de correspondance est `iconId`, l'ID de jeu present dans nos donnees. Son
 * unicite n'est pas qu'une observation sur les donnees actuelles : elle est garantie
 * en base par les contraintes `uq_spell_class_icon` et `uq_passive_class_icon`
 * (backend/src/main/resources/sql/creation_tables_{spells,passifs}.sql), ce qui rend
 * l'index sur. La portee est `(class_id, icon_id)` et non `icon_id` seul, ce qui suffit
 * ici puisque `decode` et `encode` ne chargent qu'une classe a la fois : un doublon
 * intra-classe est rejete a l'insertion plutot que de degenerer silencieusement en une
 * selection arbitraire (dernier ecrit gagne dans la Map).
 */

import { Injectable, inject } from '@angular/core';
import { DataCacheService } from './data-cache.service';
import { Passive } from '../models/passive.model';
import { Spell } from '../models/spell.model';
import { PassiveReference, SpellReference } from '../models/build.model';
import { DeckCodeImportResult, formatDeckCode, parseDeckCode } from '../utils/deck-code.utils';
import { areEquivalentSpellIds, canonicalizeInnateSpellId, getInnateSpellIdsForClass } from '../utils/innate-spells.utils';

/**
 * Vue minimale commune aux sorts et aux passifs, seul ce qui sert a la resolution.
 *
 * Derive des modeles reels plutot que redeclare : si `Spell.iconId` etait renomme, la
 * compilation casserait ici au lieu de laisser le decodage echouer silencieusement.
 */
type IconEntry = Pick<Spell, 'id' | 'iconId'> | Pick<Passive, 'id' | 'iconId'>;

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
        entry ? { spellId: entry.id, iconId: entry.iconId } : null,
      ),
      passives: passiveEntries.map(entry =>
        entry ? { passiveId: entry.id, iconId: entry.iconId } : null,
      ),
      unresolvedSpellIcons,
      unresolvedPassiveIcons,
      duplicateSpellIcons,
      duplicatePassiveIcons,
    };
  }

  /**
   * Produit le code deck de la selection courante.
   *
   * Une reference introuvable devient `0` plutot que de disparaitre : decaler les slots
   * changerait les raccourcis de tous les sorts suivants.
   */
  async encode(
    spells: ReadonlyArray<SpellReference | null>,
    passives: ReadonlyArray<PassiveReference | null>,
    classId: string,
  ): Promise<string> {
    const [allSpells, allPassives] = await Promise.all([
      this.dataCache.getSpells(classId),
      this.dataCache.getPassives(classId),
    ]);

    const spellIcons = new Map(
      allSpells.map(spell => [canonicalizeInnateSpellId(spell.id), spell.iconId ?? null]),
    );
    const passiveIcons = new Map(allPassives.map(passive => [passive.id, passive.iconId ?? null]));

    const innateIds = getInnateSpellIdsForClass(classId);
    const isInnate = (spellId: string): boolean =>
      innateIds.some(innateId => areEquivalentSpellIds(innateId, spellId));

    return formatDeckCode({
      spells: spells.map(ref =>
        ref && !isInnate(ref.spellId)
          ? spellIcons.get(canonicalizeInnateSpellId(ref.spellId)) ?? null
          : null,
      ),
      passives: passives.map(ref => (ref ? passiveIcons.get(ref.passiveId) ?? null : null)),
    });
  }
}
