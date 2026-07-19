/**
 * Raccourcis clavier de selection de sort, calques sur Wakfu.
 *
 * Deux dispositions, selon le contexte :
 * - AVEC un build : le deck, 12 emplacements en 2 rangees de 6 -> 1..6 puis alt+1..6.
 *   La rangee est FIXE a 6, comme en jeu, pour que la touche corresponde a l'emplacement.
 * - SANS build : tous les sorts de la classe, coupes en deux rangees egales. 15 sorts
 *   donnent 8 touches simples (1..8) puis 7 en alt (alt+1..alt+7), et cela evolue
 *   automatiquement avec le nombre de sorts.
 *
 * Sorts innes : ctrl+1..n ET shift+1..n. Le repli shift n'est pas cosmetique : Ctrl+1..8
 * est reserve par Chrome et Firefox sous Windows et Linux pour changer d'onglet, et une
 * page web ne peut pas l'intercepter. Sans shift, les innes seraient injouables hors macOS.
 *
 * Le parsing ne decide JAMAIS de la disposition : il rend le chiffre et l'etat de alt,
 * et c'est l'appelant qui fournit la taille de rangee de son contexte.
 */

/** Emplacements du deck (2 rangees de 6). */
export const DECK_SLOT_COUNT = 12;

/** Sorts par rangee dans la barre de deck. Fixe, comme en jeu. */
export const DECK_ROW_SIZE = 6;

/** Chiffres adressables au clavier : 1..9 (le 0 n'est pas utilise). */
const MAX_ROW_SIZE = 9;

export type SpellShortcut =
  | { kind: 'innate'; index: number }
  | { kind: 'spell'; digit: number; alt: boolean };

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') {
    return false;
  }
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }
  return el.isContentEditable === true || el.getAttribute?.('contenteditable') === 'true';
}

/**
 * Extrait le chiffre de la touche PHYSIQUE ('Digit1' / 'Numpad1' -> 1), ou null.
 *
 * `event.code` est PRIORITAIRE : sur un AZERTY francais la rangee du haut sans Shift
 * produit `&é"'(§`, et sur un QWERTY `Shift+1` produit `!`. Se fier au caractere tape
 * rendrait les raccourcis inoperants hors QWERTY, et le repli shift inoperant partout.
 *
 * Mais `code` peut etre absent : claviers virtuels, outils d'accessibilite, IME,
 * automatisation de test emettent des evenements sans lui. On retombe alors sur `key`,
 * qui vaut mieux que rien — sans jamais primer sur le code physique.
 */
function physicalDigit(event: KeyboardEvent): number | null {
  const fromCode = /^(?:Digit|Numpad)([0-9])$/.exec(event.code ?? '');
  if (fromCode) {
    return Number(fromCode[1]);
  }
  const fromKey = /^[0-9]$/.exec(event.key ?? '');
  return fromKey ? Number(fromKey[0]) : null;
}

/**
 * Traduit une frappe en intention, ou null si elle ne nous concerne pas.
 *
 * Ne borne PAS le chiffre : le plafond depend de la disposition courante (rangee de 6
 * pour le deck, moitie du total sans build), que seul l'appelant connait.
 */
export function parseSpellShortcut(event: KeyboardEvent): SpellShortcut | null {
  // Cmd : on ne marche jamais sur les raccourcis systeme / navigateur.
  if (event.metaKey) {
    return null;
  }
  if (isTextEntry(event.target)) {
    return null;
  }

  const digit = physicalDigit(event);
  if (digit === null || digit < 1) {
    return null;
  }

  if (event.ctrlKey || event.shiftKey) {
    // Pas de plafond ici : le nombre d'innes depend de la classe, la resolution borne.
    return { kind: 'innate', index: digit - 1 };
  }

  return { kind: 'spell', digit, alt: event.altKey };
}

/**
 * Sorts sur la premiere rangee quand il n'y a pas de deck : la moitie du total, arrondie
 * au superieur. 15 sorts -> 8 en 1..8 puis 7 en alt+1..alt+7. Evolue avec le total.
 *
 * Plafonne a 9 : au-dela il n'y a plus de chiffre libre, les sorts excedentaires restent
 * cliquables mais sans raccourci.
 */
export function shortcutRowSize(totalSpells: number): number {
  if (totalSpells <= 0) {
    return 0;
  }
  return Math.min(Math.ceil(totalSpells / 2), MAX_ROW_SIZE);
}

/** Index du sort vise par une frappe, ou null si hors de la disposition. */
export function spellIndexForShortcut(
  shortcut: { digit: number; alt: boolean },
  rowSize: number,
): number | null {
  if (rowSize <= 0 || shortcut.digit < 1 || shortcut.digit > rowSize) {
    return null;
  }
  return shortcut.alt ? rowSize + shortcut.digit - 1 : shortcut.digit - 1;
}

/** Libelle affiche sur la carte ('1', 'alt+4'). Vide au-dela des deux rangees. */
export function shortcutLabelForIndex(index: number, rowSize: number): string {
  if (rowSize <= 0 || index < 0) {
    return '';
  }
  if (index < rowSize) {
    return `${index + 1}`;
  }
  if (index < rowSize * 2) {
    return `alt+${index - rowSize + 1}`;
  }
  return '';
}

/** Libelle d'un sort inne ('ctrl+1'). */
export function innateShortcutLabel(index: number): string {
  return index >= 0 ? `ctrl+${index + 1}` : '';
}

/** Reference minimale d'un emplacement de deck (compatible avec SpellReference). */
interface DeckSlotRef {
  spellId: string;
}

/**
 * Convertit les emplacements du deck en sorts, EN PRESERVANT LES TROUS.
 *
 * Indispensable : la liste habituelle des sorts du build ecrase les emplacements vides,
 * si bien que l'index du tableau ne correspond plus au numero d'emplacement. Ici,
 * result[i] est le sort de l'emplacement i, ou null. Les emplacements vides de FIN sont
 * retires, pour ne pas afficher de cases vides inutiles.
 */
export function deckSlotSpells<T>(
  deck: ReadonlyArray<DeckSlotRef | null | undefined>,
  resolve: (spellId: string) => T | undefined,
): (T | null)[] {
  const slots: (T | null)[] = [];
  for (let i = 0; i < Math.min(deck.length, DECK_SLOT_COUNT); i++) {
    const entry = deck[i];
    slots.push(entry ? resolve(entry.spellId) ?? null : null);
  }
  while (slots.length > 0 && slots[slots.length - 1] === null) {
    slots.pop();
  }
  return slots;
}

/** Resout l'intention en sort concret, ou null si l'emplacement est vide/inexistant. */
export function resolveShortcutSpell<T>(
  shortcut: SpellShortcut,
  spells: ReadonlyArray<T | null>,
  innateSpells: ReadonlyArray<T>,
  rowSize: number,
): T | null {
  if (shortcut.kind === 'innate') {
    return innateSpells[shortcut.index] ?? null;
  }
  const index = spellIndexForShortcut(shortcut, rowSize);
  return index === null ? null : spells[index] ?? null;
}
