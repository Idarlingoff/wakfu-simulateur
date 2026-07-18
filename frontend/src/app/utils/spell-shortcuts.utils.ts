/**
 * Raccourcis clavier de selection de sort, calques sur Wakfu.
 *
 * Deck (12 emplacements) : 1..6 puis alt+1..6.
 * Sorts innes : ctrl+1..3 ET shift+1..3.
 *
 * Le repli shift n'est pas cosmetique : Ctrl+1..8 est reserve par Chrome et Firefox
 * sous Windows et Linux pour changer d'onglet, et une page web ne peut pas
 * l'intercepter. Sans shift, les innes seraient injouables au clavier hors macOS.
 */

/** Nombre d'emplacements du deck (6 sans modificateur + 6 avec alt). */
export const DECK_SLOT_COUNT = 12;

/** Nombre maximum de sorts innes adressables au clavier (3 pour le Xelor). */
export const INNATE_SHORTCUT_COUNT = 3;

export type SpellShortcut =
  | { kind: 'deck'; index: number }
  | { kind: 'innate'; index: number };

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
 * On lit `event.code` et jamais `event.key` : sur un AZERTY francais la rangee du haut
 * sans Shift produit `&é"'(§`, et sur un QWERTY `Shift+1` produit `!`. Se fier au
 * caractere tape rendrait les raccourcis inoperants hors QWERTY, et le repli shift
 * inoperant partout.
 */
function physicalDigit(code: string | undefined): number | null {
  const match = /^(?:Digit|Numpad)([0-9])$/.exec(code ?? '');
  return match ? Number(match[1]) : null;
}

/** Traduit une frappe en intention, ou null si elle ne nous concerne pas. */
export function parseSpellShortcut(event: KeyboardEvent): SpellShortcut | null {
  // Cmd : on ne marche jamais sur les raccourcis systeme / navigateur.
  if (event.metaKey) {
    return null;
  }
  if (isTextEntry(event.target)) {
    return null;
  }

  const digit = physicalDigit(event.code);
  if (digit === null || digit < 1) {
    return null;
  }

  if (event.ctrlKey || event.shiftKey) {
    return digit <= INNATE_SHORTCUT_COUNT ? { kind: 'innate', index: digit - 1 } : null;
  }

  if (digit > 6) {
    return null;
  }
  return { kind: 'deck', index: event.altKey ? digit + 5 : digit - 1 };
}

/** Libelle affiche sur la carte ('1', 'alt+4', 'ctrl+2'). Vide si hors perimetre. */
export function shortcutLabel(shortcut: SpellShortcut): string {
  if (shortcut.kind === 'innate') {
    return shortcut.index < INNATE_SHORTCUT_COUNT ? `ctrl+${shortcut.index + 1}` : '';
  }
  if (shortcut.index < 6) {
    return `${shortcut.index + 1}`;
  }
  if (shortcut.index < DECK_SLOT_COUNT) {
    return `alt+${shortcut.index - 5}`;
  }
  return '';
}
