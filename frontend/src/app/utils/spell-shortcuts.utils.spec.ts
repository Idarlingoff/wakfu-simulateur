import {
  parseSpellShortcut,
  shortcutRowSize,
  spellIndexForShortcut,
  shortcutLabelForIndex,
  deckSlotSpells,
  resolveShortcutSpell,
  DECK_ROW_SIZE,
} from './spell-shortcuts.utils';

/**
 * Fabrique un faux KeyboardEvent a partir du CODE physique de la touche.
 *
 * `code` est prioritaire : sur un AZERTY francais, la rangee du haut sans Shift produit
 * `&é"'(§` et non `1..6`, et sur un QWERTY `Shift+1` produit `!`.
 */
function code(
  c: string,
  mods: { alt?: boolean; ctrl?: boolean; shift?: boolean; meta?: boolean } = {},
  target: unknown = document.createElement('div'),
): KeyboardEvent {
  return {
    code: c,
    key: 'peu importe',
    altKey: !!mods.alt,
    ctrlKey: !!mods.ctrl,
    shiftKey: !!mods.shift,
    metaKey: !!mods.meta,
    target,
  } as unknown as KeyboardEvent;
}

/** Raccourci de lecture : `key('1')` vise la touche physique Digit1. */
function key(
  digit: string,
  mods: { alt?: boolean; ctrl?: boolean; shift?: boolean; meta?: boolean } = {},
  target: unknown = document.createElement('div'),
): KeyboardEvent {
  return code(`Digit${digit}`, mods, target);
}

describe('parseSpellShortcut', () => {
  it('rend le chiffre et l etat de alt, sans decider de la disposition', () => {
    expect(parseSpellShortcut(key('1'))).toEqual({ kind: 'spell', digit: 1, alt: false });
    expect(parseSpellShortcut(key('8'))).toEqual({ kind: 'spell', digit: 8, alt: false });
  });

  it('marque alt sans interpreter le numero de rangee', () => {
    expect(parseSpellShortcut(key('1', { alt: true }))).toEqual({ kind: 'spell', digit: 1, alt: true });
    expect(parseSpellShortcut(key('7', { alt: true }))).toEqual({ kind: 'spell', digit: 7, alt: true });
  });

  it('accepte les chiffres 1..9 (le plafond depend du contexte, pas du parsing)', () => {
    expect(parseSpellShortcut(key('9'))).toEqual({ kind: 'spell', digit: 9, alt: false });
  });

  it('mappe ctrl sur les sorts innes', () => {
    expect(parseSpellShortcut(key('1', { ctrl: true }))).toEqual({ kind: 'innate', index: 0 });
    expect(parseSpellShortcut(key('3', { ctrl: true }))).toEqual({ kind: 'innate', index: 2 });
  });

  // Ctrl+1..8 est confisque par Chrome/Firefox sous Windows et Linux : sans ce repli,
  // les sorts innes seraient injouables au clavier pour la majorite des joueurs.
  it('mappe aussi shift sur les sorts innes', () => {
    expect(parseSpellShortcut(key('2', { shift: true }))).toEqual({ kind: 'innate', index: 1 });
  });

  it('ignore le 0 et les touches non numeriques', () => {
    expect(parseSpellShortcut(key('0'))).toBeNull();
    expect(parseSpellShortcut(code('KeyA'))).toBeNull();
    expect(parseSpellShortcut(code('Enter'))).toBeNull();
  });

  it('ignore toute frappe avec Cmd, pour ne pas marcher sur les raccourcis systeme', () => {
    expect(parseSpellShortcut(key('1', { meta: true }))).toBeNull();
  });

  // Sur AZERTY, la touche physique 1 tape '&' : lire event.key casserait tout.
  it('fonctionne quel que soit le caractere produit par la disposition', () => {
    const azerty = { code: 'Digit1', key: '&', altKey: false, ctrlKey: false,
      shiftKey: false, metaKey: false, target: document.createElement('div') };
    expect(parseSpellShortcut(azerty as unknown as KeyboardEvent))
      .toEqual({ kind: 'spell', digit: 1, alt: false });
  });

  it('accepte aussi le pave numerique', () => {
    expect(parseSpellShortcut(code('Numpad3'))).toEqual({ kind: 'spell', digit: 3, alt: false });
  });

  // Claviers virtuels, outils d'accessibilite, IME : pas de `code`.
  it('retombe sur key quand le code physique est absent', () => {
    const sansCode = { code: '', key: '4', altKey: false, ctrlKey: false,
      shiftKey: false, metaKey: false, target: document.createElement('div') };
    expect(parseSpellShortcut(sansCode as unknown as KeyboardEvent))
      .toEqual({ kind: 'spell', digit: 4, alt: false });
  });

  // Sans ce garde, renommer une timeline lancerait des selections a chaque chiffre tape.
  it('ignore les frappes dans un champ de saisie', () => {
    expect(parseSpellShortcut(key('1', {}, document.createElement('input')))).toBeNull();
    expect(parseSpellShortcut(key('1', {}, document.createElement('textarea')))).toBeNull();
    expect(parseSpellShortcut(key('1', {}, document.createElement('select')))).toBeNull();
  });

  it('ignore les frappes dans un element contenteditable', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    expect(parseSpellShortcut(key('1', {}, editable))).toBeNull();
  });
});

describe('shortcutRowSize', () => {
  // Sans build, on repartit les sorts en deux rangees egales : 15 sorts -> 8 puis 7.
  it('coupe la liste en deux, en arrondissant la premiere rangee au superieur', () => {
    expect(shortcutRowSize(15)).toBe(8);
    expect(shortcutRowSize(14)).toBe(7);
    expect(shortcutRowSize(18)).toBe(9);
  });

  it('evolue quand le nombre de sorts change', () => {
    expect(shortcutRowSize(16)).toBe(8);
    expect(shortcutRowSize(21)).toBe(9);
  });

  it('ne depasse jamais 9, faute de touches au-dela', () => {
    expect(shortcutRowSize(30)).toBe(9);
  });

  it('rend 0 quand il n y a aucun sort', () => {
    expect(shortcutRowSize(0)).toBe(0);
  });
});

describe('spellIndexForShortcut', () => {
  it('mappe la premiere rangee sur les premiers sorts', () => {
    expect(spellIndexForShortcut({ digit: 1, alt: false }, 8)).toBe(0);
    expect(spellIndexForShortcut({ digit: 8, alt: false }, 8)).toBe(7);
  });

  it('mappe alt sur la seconde rangee', () => {
    expect(spellIndexForShortcut({ digit: 1, alt: true }, 8)).toBe(8);
    expect(spellIndexForShortcut({ digit: 7, alt: true }, 8)).toBe(14);
  });

  it('refuse un chiffre au-dela de la rangee', () => {
    expect(spellIndexForShortcut({ digit: 9, alt: false }, 8)).toBeNull();
  });

  // Le deck garde ses 6 par rangee, quelle que soit sa taille.
  it('respecte la rangee de 6 du deck', () => {
    expect(spellIndexForShortcut({ digit: 6, alt: false }, DECK_ROW_SIZE)).toBe(5);
    expect(spellIndexForShortcut({ digit: 1, alt: true }, DECK_ROW_SIZE)).toBe(6);
    expect(spellIndexForShortcut({ digit: 7, alt: false }, DECK_ROW_SIZE)).toBeNull();
  });

  it('rend null quand il n y a aucune rangee', () => {
    expect(spellIndexForShortcut({ digit: 1, alt: false }, 0)).toBeNull();
  });
});

describe('shortcutLabelForIndex', () => {
  it('libelle la premiere rangee sans modificateur', () => {
    expect(shortcutLabelForIndex(0, 8)).toBe('1');
    expect(shortcutLabelForIndex(7, 8)).toBe('8');
  });

  it('libelle la seconde rangee avec alt', () => {
    expect(shortcutLabelForIndex(8, 8)).toBe('alt+1');
    expect(shortcutLabelForIndex(14, 8)).toBe('alt+7');
  });

  it('suit la rangee de 6 pour le deck', () => {
    expect(shortcutLabelForIndex(5, DECK_ROW_SIZE)).toBe('6');
    expect(shortcutLabelForIndex(6, DECK_ROW_SIZE)).toBe('alt+1');
    expect(shortcutLabelForIndex(11, DECK_ROW_SIZE)).toBe('alt+6');
  });

  it('ne libelle rien au-dela des deux rangees', () => {
    expect(shortcutLabelForIndex(16, 8)).toBe('');
    expect(shortcutLabelForIndex(12, DECK_ROW_SIZE)).toBe('');
  });
});

interface FakeSpell { id: string; name: string; }

const ref = (spellId: string) => ({ spellId }) as { spellId: string };
const spell = (id: string): FakeSpell => ({ id, name: `sort ${id}` });

function resolverFor(ids: string[]) {
  const cache = new Map(ids.map(id => [id, spell(id)]));
  return (id: string) => cache.get(id);
}

describe('deckSlotSpells', () => {
  it('rend les sorts dans l ordre des emplacements', () => {
    const deck = [ref('a'), ref('b'), ref('c')];
    const result = deckSlotSpells(deck, resolverFor(['a', 'b', 'c'])) as FakeSpell[];
    expect(result.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  // Sans ca, la touche 3 ne viserait plus l'emplacement 3.
  it('preserve un trou au milieu du deck', () => {
    const deck = [ref('a'), null, ref('c')];
    const result = deckSlotSpells(deck, resolverFor(['a', 'c']));
    expect(result.length).toBe(3);
    expect(result[1]).toBeNull();
    expect(result[2]?.id).toBe('c');
  });

  it('retire les emplacements vides de fin', () => {
    expect(deckSlotSpells([ref('a'), null, null], resolverFor(['a'])).length).toBe(1);
  });

  it('rend une liste vide pour un deck entierement vide', () => {
    expect(deckSlotSpells([null, null], resolverFor([]))).toEqual([]);
  });

  it('traite un sort introuvable dans le cache comme un emplacement vide', () => {
    expect(deckSlotSpells([ref('a'), ref('inconnu')], resolverFor(['a'])).length).toBe(1);
  });

  it('ne depasse jamais 12 emplacements', () => {
    const deck = Array.from({ length: 20 }, (_, i) => ref(`s${i}`));
    expect(deckSlotSpells(deck, resolverFor(deck.map(d => d.spellId))).length).toBe(12);
  });
});

describe('resolveShortcutSpell', () => {
  const spells = [spell('a'), null, spell('c'), spell('d')];
  const innates = [spell('i1'), spell('i2')];

  it('resout un sort de la premiere rangee', () => {
    expect(resolveShortcutSpell({ kind: 'spell', digit: 3, alt: false }, spells, innates, 6)?.id).toBe('c');
  });

  it('resout un sort de la seconde rangee', () => {
    expect(resolveShortcutSpell({ kind: 'spell', digit: 1, alt: true }, spells, innates, 2)?.id).toBe('c');
  });

  it('rend null sur un emplacement vide', () => {
    expect(resolveShortcutSpell({ kind: 'spell', digit: 2, alt: false }, spells, innates, 6)).toBeNull();
  });

  it('rend null hors des bornes', () => {
    expect(resolveShortcutSpell({ kind: 'spell', digit: 9, alt: false }, spells, innates, 6)).toBeNull();
  });

  it('resout un sort inne', () => {
    expect(resolveShortcutSpell({ kind: 'innate', index: 1 }, spells, innates, 6)?.id).toBe('i2');
  });

  it('rend null si l inne n existe pas pour cette classe', () => {
    expect(resolveShortcutSpell({ kind: 'innate', index: 5 }, spells, innates, 6)).toBeNull();
  });
});
