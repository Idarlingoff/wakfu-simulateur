import { TestBed } from '@angular/core/testing';
import { DeckCodeService } from './deck-code.service';
import { DataCacheService } from './data-cache.service';
import { DeckCodeFormatError } from '../utils/deck-code.utils';
import { Spell } from '../models/spell.model';
import { Passive } from '../models/passive.model';

const REFERENCE =
  '2839-5344-767-771-765-772-777-766-1417-763-775-757-758-785-7190-7191-7192-0';

/**
 * Sorts Xélor minimaux : seuls `id` et `iconId` comptent pour la resolution.
 *
 * `XEL_SANS_ICONE` n'a pas d'iconId : `Spell.iconId` est optionnel, donc c'est une forme
 * de donnee reelle, et l'index doit l'ignorer sans perturber le reste.
 */
const SPELL_ICONS: ReadonlyArray<[string, number | undefined]> = [
  ['XEL_DEVOUEMENT', 2839], ['XEL_REGULATEUR', 5344], ['XEL_POINTE_HEURE', 767],
  ['XEL_RETOUR_SPONTANE', 771], ['XEL_TEMPUS_FUGIT', 765], ['XEL_SYMETRIE', 772],
  ['XEL_SINISTRO', 777], ['XEL_ROUAGE', 766], ['XEL_DESYNCHRO', 1417],
  ['XEL_HORLOGE', 763], ['XEL_RALENTISSEMENT', 775], ['XEL_PREMONITION', 757],
  ['XEL_DIAL', 5345], ['XEL_DISTO', 7794], ['XEL_VDT', 3909],
  ['XEL_SANS_ICONE', undefined],
];

const PASSIVE_ICONS: ReadonlyArray<[string, number | undefined]> = [
  ['XEL_MAITRE_HORLOGER', 758], ['XEL_COURS_TEMPS', 785], ['XEL_TEMPORISATION', 7190],
  ['XEL_ACCELERATION', 7191], ['XEL_REMONTOIR', 7192], ['XEL_CONNAISSANCE_PASSE', 7186],
];

function spells(): Spell[] {
  return SPELL_ICONS.map(([id, iconId]) => ({ id, iconId, classId: 'XEL' } as unknown as Spell));
}

function passives(): Passive[] {
  return PASSIVE_ICONS.map(([id, iconId]) => ({ id, iconId, classId: 'XEL' } as unknown as Passive));
}

class StubDataCache {
  getSpells = jasmine.createSpy('getSpells').and.resolveTo(spells());
  getPassives = jasmine.createSpy('getPassives').and.resolveTo(passives());
}

let cache: StubDataCache;

function service(): DeckCodeService {
  cache = new StubDataCache();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [DeckCodeService, { provide: DataCacheService, useValue: cache }],
  });
  return TestBed.inject(DeckCodeService);
}

describe('DeckCodeService.decode', () => {
  it('resout le code de reference en entier', async () => {
    const result = await service().decode(REFERENCE, 'XEL');

    expect(cache.getSpells).toHaveBeenCalledWith('XEL');
    expect(cache.getPassives).toHaveBeenCalledWith('XEL');
    expect(result.spells.length).toBe(12);
    expect(result.spells[0]).toEqual({ spellId: 'XEL_DEVOUEMENT', iconId: 2839 });
    expect(result.spells[8]).toEqual({ spellId: 'XEL_DESYNCHRO', iconId: 1417 });
    expect(result.passives.length).toBe(6);
    expect(result.passives[1]).toEqual({ passiveId: 'XEL_COURS_TEMPS', iconId: 785 });
    expect(result.passives[5]).toBeNull();
    expect(result.unresolvedSpellIcons).toEqual([]);
    expect(result.unresolvedPassiveIcons).toEqual([]);
  });

  it('laisse vide et signale un identifiant inconnu', async () => {
    const code = REFERENCE.replace('767', '99999');
    const result = await service().decode(code, 'XEL');

    expect(result.spells[2]).toBeNull();
    expect(result.unresolvedSpellIcons).toEqual([99999]);
  });

  it('garde la premiere occurrence d un doublon et signale la suivante', async () => {
    // 771 (slot 3) devient un second 767, deja place au slot 2.
    const code = REFERENCE.replace('767-771', '767-767');
    const result = await service().decode(code, 'XEL');

    expect(result.spells[2]).toEqual({ spellId: 'XEL_POINTE_HEURE', iconId: 767 });
    expect(result.spells[3]).toBeNull();
    expect(result.duplicateSpellIcons).toEqual([767]);
  });

  it('partage le registre des doublons entre sorts et passifs', async () => {
    // 757 (XEL_PREMONITION) occupe deja le slot de sort 11. Reutilise en case de passif,
    // il doit etre signale comme DOUBLON, pas comme inconnu : c'est ce qui prouve que le
    // registre `used` couvre les deux rangees. Documente aussi l'ordre garanti : les
    // sorts sont resolus en premier, donc ils gagnent toute collision inter-rangees.
    const code = REFERENCE.replace('-758-785-', '-757-785-');
    const result = await service().decode(code, 'XEL');

    expect(result.spells[11]).toEqual({ spellId: 'XEL_PREMONITION', iconId: 757 });
    expect(result.passives[0]).toBeNull();
    expect(result.duplicatePassiveIcons).toEqual([757]);
    expect(result.unresolvedPassiveIcons).toEqual([]);
  });

  it('ignore une entree sans iconId sans perturber la resolution', async () => {
    // `iconId` est optionnel sur Spell/Passive : une entree sans icone ne doit ni entrer
    // dans l'index ni empecher le code de reference de se resoudre entierement.
    const result = await service().decode(REFERENCE, 'XEL');

    expect(result.spells.every(s => s !== null)).toBeTrue();
    expect(result.spells.map(s => s?.spellId)).not.toContain('XEL_SANS_ICONE');
    expect(result.unresolvedSpellIcons).toEqual([]);
  });

  it('ne fait pas de repli croise : un ID de passif dans une case de sort est inconnu', async () => {
    const code = REFERENCE.replace('2839', '785');
    const result = await service().decode(code, 'XEL');

    expect(result.spells[0]).toBeNull();
    expect(result.unresolvedSpellIcons).toEqual([785]);
  });

  it('ne resout rien pour une classe sans donnees', async () => {
    const svc = service();
    cache.getSpells.and.resolveTo([]);
    cache.getPassives.and.resolveTo([]);

    const result = await svc.decode(REFERENCE, 'ecaflip');

    expect(result.spells.every(s => s === null)).toBeTrue();
    expect(result.unresolvedSpellIcons.length).toBe(12);
    expect(result.unresolvedPassiveIcons.length).toBe(5);
  });

  it('propage DeckCodeFormatError sur un code malforme', async () => {
    await expectAsync(service().decode('1-2-3', 'XEL')).toBeRejectedWithError(DeckCodeFormatError);
  });
});
