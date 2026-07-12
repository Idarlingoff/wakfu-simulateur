import { TestBed } from '@angular/core/testing';
import { SpellCastingValidatorService } from './spell-casting-validator.service';
import { BoardService } from '../board.service';
import { SimulationContext } from '../calculators/simulation-engine.service';
import { Spell } from '../../models/spell.model';

/**
 * Régressions du patch Xélor (bugs 5 & 6) :
 * - zone AREA = ciblage libre (plus de restriction "ligne droite")
 * - flag selfCastable = autorise le lancer sur soi (distance 0) malgré poMin > 0
 *
 * NB: nécessite un navigateur (ng test / karma) pour s'exécuter.
 */
function makeSpell(p: Partial<Spell>): Spell {
  return {
    id: 'TEST', classId: 'XEL', name: 'Test', element: 'AIR', spellType: 'ELEMENTAL',
    paCost: 3, pwCost: 0, poMin: 1, poMax: 6, poModifiable: true, lineOfSight: false,
    cooldown: 0, usePerTurn: 99, usePerTarget: 99, direction: 'AREA', ratioEvalMode: 'STEP',
    variants: [], breakpoints: [], isAoe: false, ...p,
  };
}

function makeContext(p: Partial<SimulationContext> = {}): SimulationContext {
  return {
    availablePa: 6, availablePw: 6, availableMp: 3,
    currentPosition: { x: 5, y: 5 }, playerPosition: { x: 5, y: 5 }, range: 0,
    entities: [], mechanisms: [], turn: 1, freeplay: false,
    spellUsageThisTurn: new Map(), spellUsagePerTarget: new Map(), ...p,
  };
}

describe('SpellCastingValidatorService (régressions patch Xélor)', () => {
  let svc: SpellCastingValidatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SpellCastingValidatorService,
        { provide: BoardService, useValue: {} },
      ],
    });
    svc = TestBed.inject(SpellCastingValidatorService);
  });

  it('AREA autorise une cible en diagonale dans la portée', () => {
    const spell = makeSpell({ direction: 'AREA', poMin: 1, poMax: 6 });
    const r = svc.validateSpellCast(spell, { x: 5, y: 5 }, { x: 7, y: 7 }, makeContext());
    expect(r.canCast).toBeTrue();
  });

  it('LINE rejette une cible en diagonale', () => {
    const spell = makeSpell({ direction: 'LINE', poMin: 1, poMax: 6 });
    const r = svc.validateSpellCast(spell, { x: 5, y: 5 }, { x: 7, y: 7 }, makeContext());
    expect(r.canCast).toBeFalse();
  });

  it('selfCastable autorise le lancer sur soi (distance 0) malgré poMin = 1', () => {
    const spell = makeSpell({ direction: 'AREA', poMin: 1, poMax: 6, selfCastable: true });
    const r = svc.validateSpellCast(spell, { x: 5, y: 5 }, { x: 5, y: 5 }, makeContext());
    expect(r.canCast).toBeTrue();
  });

  it('sans selfCastable, le lancer sur soi (distance 0) est refusé avec poMin = 1', () => {
    const spell = makeSpell({ direction: 'AREA', poMin: 1, poMax: 6, selfCastable: false });
    const r = svc.validateSpellCast(spell, { x: 5, y: 5 }, { x: 5, y: 5 }, makeContext());
    expect(r.canCast).toBeFalse();
  });

  it('rejette une cible hors de portée (au-delà de poMax)', () => {
    const spell = makeSpell({ direction: 'AREA', poMin: 1, poMax: 6, poModifiable: false });
    const r = svc.validateSpellCast(spell, { x: 0, y: 0 }, { x: 0, y: 8 }, makeContext({ range: 0 }));
    expect(r.canCast).toBeFalse();
  });
});
