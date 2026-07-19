import {
  DECK_CODE_SEGMENT_COUNT,
  DeckCodeFormatError,
  formatDeckCode,
  parseDeckCode,
} from './deck-code.utils';

/** Code de reference fourni par le jeu : 12 sorts, 5 passifs, 1 slot de passif vide. */
const REFERENCE =
  '2839-5344-767-771-765-772-777-766-1417-763-775-757-758-785-7190-7191-7192-0';

describe('deck-code.utils', () => {
  it('expose 18 segments : 12 sorts + 6 passifs', () => {
    expect(DECK_CODE_SEGMENT_COUNT).toBe(18);
    const slots = parseDeckCode(REFERENCE);
    expect(slots.spells.length).toBe(12);
    expect(slots.passives.length).toBe(6);
  });

  it('parse le code de reference en sorts et passifs', () => {
    const slots = parseDeckCode(REFERENCE);
    expect(slots.spells).toEqual([2839, 5344, 767, 771, 765, 772, 777, 766, 1417, 763, 775, 757]);
    expect(slots.passives).toEqual([758, 785, 7190, 7191, 7192, null]);
  });

  it('fait un aller-retour sans perte', () => {
    expect(formatDeckCode(parseDeckCode(REFERENCE))).toBe(REFERENCE);
  });

  it('preserve un trou en milieu de rangee sur un aller-retour', () => {
    const withHole = '2839-0-767-771-765-772-777-766-1417-763-775-757-758-785-7190-7191-7192-0';
    expect(formatDeckCode(parseDeckCode(withHole))).toBe(withHole);
  });

  it('traite 0 comme un slot vide, en tete comme au milieu', () => {
    const slots = parseDeckCode('0-5344-0-771-765-772-777-766-1417-763-775-757-758-785-7190-7191-7192-0');
    expect(slots.spells[0]).toBeNull();
    expect(slots.spells[2]).toBeNull();
    expect(slots.spells[1]).toBe(5344);
  });

  it('tolere les espaces et les tirets en trop', () => {
    const messy = '  2839 - 5344--767-771-765-772-777-766-1417-763-775-757-758-785-7190-7191-7192-0  ';
    expect(formatDeckCode(parseDeckCode(messy))).toBe(REFERENCE);
  });

  it('rejette un nombre de segments incorrect', () => {
    expect(() => parseDeckCode('1-2-3')).toThrowError(DeckCodeFormatError);
    expect(() => parseDeckCode('')).toThrowError(DeckCodeFormatError);
    expect(() => parseDeckCode(`${REFERENCE}-42`)).toThrowError(DeckCodeFormatError);
  });

  // Pas de test du negatif : le separateur etant `-`, un segment negatif est
  // structurellement inexprimable. `a--5-b` se lit `a`, `5`, `b`.
  it('rejette un segment non entier', () => {
    expect(() => parseDeckCode(REFERENCE.replace('767', 'abc'))).toThrowError(DeckCodeFormatError);
    expect(() => parseDeckCode(REFERENCE.replace('767', '7.5'))).toThrowError(DeckCodeFormatError);
  });

  it('formatDeckCode complete les rangees trop courtes avec des 0', () => {
    expect(formatDeckCode({ spells: [763], passives: [] })).toBe('763-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0');
  });

  it('tronque une rangee trop longue : le code est a largeur fixe', () => {
    const spells = new Array(14).fill(763);
    expect(formatDeckCode({ spells, passives: [] }).split('-').length).toBe(18);
  });
});
