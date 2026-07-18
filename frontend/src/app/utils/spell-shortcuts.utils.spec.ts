import {
  parseSpellShortcut,
  shortcutLabel,
  deckSlotSpells,
  resolveShortcutSpell,
} from './spell-shortcuts.utils';

/**
 * Fabrique un faux KeyboardEvent a partir du CODE physique de la touche.
 *
 * On lit `event.code` et jamais `event.key` : sur un AZERTY francais, la rangee du haut
 * sans Shift produit `&é"'(§` et non `1..6`, et sur un QWERTY `Shift+1` produit `!`.
 * `code` ('Digit1') identifie la touche physique quelle que soit la disposition.
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
  it('mappe 1..6 sur les emplacements 0..5 du deck', () => {
    expect(parseSpellShortcut(key('1'))).toEqual({ kind: 'deck', index: 0 });
    expect(parseSpellShortcut(key('6'))).toEqual({ kind: 'deck', index: 5 });
  });

  it('mappe alt+1..6 sur les emplacements 6..11 du deck', () => {
    expect(parseSpellShortcut(key('1', { alt: true }))).toEqual({ kind: 'deck', index: 6 });
    expect(parseSpellShortcut(key('6', { alt: true }))).toEqual({ kind: 'deck', index: 11 });
  });

  it('mappe ctrl+1..3 sur les sorts innes', () => {
    expect(parseSpellShortcut(key('1', { ctrl: true }))).toEqual({ kind: 'innate', index: 0 });
    expect(parseSpellShortcut(key('3', { ctrl: true }))).toEqual({ kind: 'innate', index: 2 });
  });

  // Ctrl+1..8 est confisque par Chrome/Firefox sous Windows et Linux : sans ce repli,
  // les sorts innes seraient injouables au clavier pour la majorite des joueurs.
  it('mappe aussi shift+1..3 sur les sorts innes', () => {
    expect(parseSpellShortcut(key('1', { shift: true }))).toEqual({ kind: 'innate', index: 0 });
    expect(parseSpellShortcut(key('3', { shift: true }))).toEqual({ kind: 'innate', index: 2 });
  });

  it('ignore les chiffres hors 1..6 pour le deck', () => {
    expect(parseSpellShortcut(key('7'))).toBeNull();
    expect(parseSpellShortcut(key('0'))).toBeNull();
  });

  it('ignore ctrl/shift au-dela de 3 (le Xelor n a que 3 innes)', () => {
    expect(parseSpellShortcut(key('4', { ctrl: true }))).toBeNull();
    expect(parseSpellShortcut(key('4', { shift: true }))).toBeNull();
  });

  it('ignore toute frappe avec Cmd, pour ne pas marcher sur les raccourcis systeme', () => {
    expect(parseSpellShortcut(key('1', { meta: true }))).toBeNull();
    expect(parseSpellShortcut(key('1', { meta: true, alt: true }))).toBeNull();
  });

  it('ignore les touches non numeriques', () => {
    expect(parseSpellShortcut(code('KeyA'))).toBeNull();
    expect(parseSpellShortcut(code('Enter'))).toBeNull();
  });

  // Sur AZERTY, la touche physique 1 tape '&' : lire event.key casserait tout.
  it('fonctionne quel que soit le caractere produit par la disposition', () => {
    const azerty = { code: 'Digit1', key: '&', altKey: false, ctrlKey: false,
      shiftKey: false, metaKey: false, target: document.createElement('div') };
    expect(parseSpellShortcut(azerty as unknown as KeyboardEvent))
      .toEqual({ kind: 'deck', index: 0 });
  });

  // Sur QWERTY, Shift+1 tape '!' : la aussi, seul le code physique est fiable.
  it('reconnait shift+1 meme quand la frappe produit un symbole', () => {
    const qwerty = { code: 'Digit1', key: '!', altKey: false, ctrlKey: false,
      shiftKey: true, metaKey: false, target: document.createElement('div') };
    expect(parseSpellShortcut(qwerty as unknown as KeyboardEvent))
      .toEqual({ kind: 'innate', index: 0 });
  });

  it('accepte aussi le pave numerique', () => {
    expect(parseSpellShortcut(code('Numpad1'))).toEqual({ kind: 'deck', index: 0 });
  });

  // Sans ca, renommer une timeline lancerait des selections a chaque chiffre tape.
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

describe('shortcutLabel', () => {
  it('libelle les 6 premiers emplacements sans modificateur', () => {
    expect(shortcutLabel({ kind: 'deck', index: 0 })).toBe('1');
    expect(shortcutLabel({ kind: 'deck', index: 5 })).toBe('6');
  });

  it('libelle les emplacements 7..12 avec alt', () => {
    expect(shortcutLabel({ kind: 'deck', index: 6 })).toBe('alt+1');
    expect(shortcutLabel({ kind: 'deck', index: 11 })).toBe('alt+6');
  });

  it('libelle les innes avec ctrl', () => {
    expect(shortcutLabel({ kind: 'innate', index: 0 })).toBe('ctrl+1');
  });

  it('ne libelle rien au-dela du deck', () => {
    expect(shortcutLabel({ kind: 'deck', index: 12 })).toBe('');
  });
});

interface FakeSpell { id: string; name: string; }

const ref = (spellId: string) => ({ spellId }) as { spellId: string };
const spell = (id: string): FakeSpell => ({ id, name: `sort ${id}` });

/** Resolveur : rend le sort si connu du cache, sinon undefined. */
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
    expect(result[0]?.id).toBe('a');
    expect(result[1]).toBeNull();
    expect(result[2]?.id).toBe('c');
  });

  it('retire les emplacements vides de fin', () => {
    const deck = [ref('a'), null, null, null];
    expect(deckSlotSpells(deck, resolverFor(['a'])).length).toBe(1);
  });

  it('rend une liste vide pour un deck entierement vide', () => {
    expect(deckSlotSpells([null, null], resolverFor([]))).toEqual([]);
  });

  it('traite un sort introuvable dans le cache comme un emplacement vide', () => {
    const deck = [ref('a'), ref('inconnu'), ref('c')];
    const result = deckSlotSpells(deck, resolverFor(['a', 'c']));
    expect(result[1]).toBeNull();
    expect(result[2]?.id).toBe('c');
  });

  it('ne depasse jamais 12 emplacements', () => {
    const deck = Array.from({ length: 20 }, (_, i) => ref(`s${i}`));
    const ids = deck.map(d => d.spellId);
    expect(deckSlotSpells(deck, resolverFor(ids)).length).toBe(12);
  });
});

describe('resolveShortcutSpell', () => {
  const deck = [spell('a'), null, spell('c')];
  const innates = [spell('i1'), spell('i2')];

  it('resout un emplacement de deck', () => {
    expect(resolveShortcutSpell({ kind: 'deck', index: 2 }, deck, innates)?.id).toBe('c');
  });

  it('rend null sur un emplacement vide', () => {
    expect(resolveShortcutSpell({ kind: 'deck', index: 1 }, deck, innates)).toBeNull();
  });

  it('rend null hors des bornes', () => {
    expect(resolveShortcutSpell({ kind: 'deck', index: 9 }, deck, innates)).toBeNull();
  });

  it('resout un sort inne', () => {
    expect(resolveShortcutSpell({ kind: 'innate', index: 1 }, deck, innates)?.id).toBe('i2');
  });

  it('rend null si l inne n existe pas pour cette classe', () => {
    expect(resolveShortcutSpell({ kind: 'innate', index: 2 }, deck, innates)).toBeNull();
  });
});
