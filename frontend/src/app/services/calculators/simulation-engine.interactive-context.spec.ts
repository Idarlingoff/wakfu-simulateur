import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SimulationEngineService, SimulationContext } from './simulation-engine.service';
import { BoardService } from '../board.service';
import { getXelorState } from '../strategies/xelor-stragegy/xelor-state.utils';
import { Build } from '../../models/build.model';
import { Mechanism } from '../../models/board.model';

/**
 * Jeu interactif : le contexte de classe doit être initialisé depuis le board au
 * démarrage d'une session, comme le fait runSimulation via initializeClassContext.
 *
 * Sans cela, un mécanisme DÉJÀ posé sur le board (ex: Rouage laissé par une session
 * précédente) n'a aucune aura enregistrée : l'explosion, gardée par ROUAGE_AURA,
 * ne se déclenche jamais — même après un vrai tour de cadran.
 */
describe('SimulationEngineService — contexte de classe en jeu interactif', () => {
  let engine: SimulationEngineService;

  const rouage: Mechanism = {
    id: 'cog_1',
    type: 'cog',
    position: { x: 5, y: 5 },
    charges: 3,
    spellId: 'XEL_ROUAGE',
  };

  const xelBuild = {
    id: 'build_xel',
    name: 'Xelor',
    classId: 'XEL',
    characterLevel: 230,
    spellBar: { spells: [] },
    passiveBar: { passives: [] },
    sublimationBar: { sublimations: [] },
    stats: {
      level: 230,
      masteryFire: 1, masteryWater: 2000, masteryEarth: 1, masteryAir: 1,
      masterySecondary: 0, backMastery: 0,
      masteryMelee: 0, masteryDistance: 0, masteryHealing: 0,
      dommageInflict: 0, critRate: 0, critMastery: 0,
      resistance: 0, ap: 12, mp: 4, wp: 6, range: 4,
    },
  } as unknown as Build;

  beforeEach(() => {
    const board = {
      mechanisms: () => [rouage],
      getMechanismsByType: (type: string) => (type === 'cog' ? [rouage] : []),
      player: () => ({ id: 'p1', type: 'player', position: { x: 0, y: 0 } }),
      state: () => ({ entities: [], mechanisms: [rouage] }),
      enemies: () => [],
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BoardService, useValue: board },
      ],
    });

    engine = TestBed.inject(SimulationEngineService);
  });

  it('enregistre ROUAGE_AURA pour un Rouage déjà présent sur le board', () => {
    const context = {} as SimulationContext;

    engine.initializeInteractiveContext(context, xelBuild);

    expect(getXelorState(context).activeAuras.has('ROUAGE_AURA')).toBe(true);
  });

  it('charge les charges du Rouage présent sur le board', () => {
    const context = {} as SimulationContext;

    engine.initializeInteractiveContext(context, xelBuild);

    expect(getXelorState(context).mechanismCharges.get('cog_1')).toBe(3);
  });
});
