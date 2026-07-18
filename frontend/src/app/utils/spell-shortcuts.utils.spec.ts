import { parseSpellShortcut, shortcutLabel } from './spell-shortcuts.utils';

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
