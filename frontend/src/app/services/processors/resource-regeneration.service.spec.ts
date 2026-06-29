import { TestBed } from '@angular/core/testing';
import { ResourceRegenerationService } from './resource-regeneration.service';
import { BoardService } from '../board.service';
import { SimulationContext } from '../calculators/simulation-engine.service';

/**
 * Régénération de ressources :
 * - les PW ne peuvent PAS dépasser leur maximum (context.maxPw) — bug "Cours du temps / Cadran
 *   rend des PW au-dessus du max" ;
 * - les PA n'ont PAS de plafond (ils peuvent dépasser la limite).
 *
 * NB: nécessite un navigateur (ng test / karma) pour s'exécuter.
 */
function makeContext(p: Partial<SimulationContext> = {}): SimulationContext {
  return {
    availablePa: 6, availablePw: 6, availableMp: 3,
    currentPosition: { x: 0, y: 0 }, playerPosition: { x: 0, y: 0 }, range: 0,
    entities: [], mechanisms: [], turn: 1,
    spellUsageThisTurn: new Map(), spellUsagePerTarget: new Map(), ...p,
  };
}

describe('ResourceRegenerationService – plafond des PW', () => {
  let service: ResourceRegenerationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ResourceRegenerationService,
        { provide: BoardService, useValue: { getMechanismsByType: () => [] } },
      ],
    });
    service = TestBed.inject(ResourceRegenerationService);
  });

  it('plafonne les PW au maximum (déjà au max → +0)', () => {
    const ctx = makeContext({ availablePw: 6, maxPw: 6 });
    service.regeneratePW(ctx, 2, 'COURS_DU_TEMPS', 'test');
    expect(ctx.availablePw).toBe(6);
  });

  it('accorde seulement la part qui tient sous le max', () => {
    const ctx = makeContext({ availablePw: 5, maxPw: 6 });
    service.regeneratePW(ctx, 2, 'HOUR_WRAP', 'test');
    expect(ctx.availablePw).toBe(6);
  });

  it('régénère normalement quand on est sous le max', () => {
    const ctx = makeContext({ availablePw: 2, maxPw: 6 });
    service.regeneratePW(ctx, 2, 'REGULATEUR', 'test');
    expect(ctx.availablePw).toBe(4);
  });

  it('ne plafonne pas si maxPw est absent', () => {
    const ctx = makeContext({ availablePw: 6, maxPw: undefined });
    service.regeneratePW(ctx, 5, 'COURS_DU_TEMPS', 'test');
    expect(ctx.availablePw).toBe(11);
  });

  it('ne plafonne PAS les PA (ils peuvent dépasser)', () => {
    const ctx = makeContext({ availablePa: 12, maxPw: 6 });
    service.regeneratePA(ctx, 2, 'COURS_DU_TEMPS', 'test');
    expect(ctx.availablePa).toBe(14);
  });
});
