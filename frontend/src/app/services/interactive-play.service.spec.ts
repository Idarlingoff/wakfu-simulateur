import { TestBed } from '@angular/core/testing';
import { InteractivePlayService } from './interactive-play.service';
import { BoardService } from './board.service';
import { SimulationService } from './simulation.service';
import { StatsCalculatorService } from './calculators/stats-calculator.service';
import { SimulationEngineService } from './calculators/simulation-engine.service';

/**
 * Freeplay Xel Rouage – sélection des passifs.
 * Les passifs obligatoires (Maître du Cadran, Mécanisme spécialisé, Cours du temps)
 * sont toujours actifs ; les optionnels (Rémanence, Horlogerie, Permutation momentanée)
 * dépendent du menu. Connaissance du passé a été retiré du freeplay.
 *
 * NB: nécessite un navigateur (ng test / karma) pour s'exécuter.
 */
describe('InteractivePlayService – Freeplay Xel Rouage passifs', () => {
  let service: InteractivePlayService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InteractivePlayService,
        {
          provide: BoardService,
          useValue: {
            player: () => ({ id: 'p', type: 'player', position: { x: 0, y: 0 } }),
            state: () => ({ entities: [], mechanisms: [] }),
            mechanisms: () => [],
          },
        },
        { provide: SimulationService, useValue: { clearInteractiveSteps: () => {} } },
        { provide: StatsCalculatorService, useValue: {} },
        { provide: SimulationEngineService, useValue: {} },
      ],
    });
    service = TestBed.inject(InteractivePlayService);
  });

  function activeIds(): string[] {
    return service.context()?.activePassiveIds ?? [];
  }

  it('inclut toujours les passifs obligatoires', () => {
    service.startSessionXelorFreeplay([]);
    for (const id of InteractivePlayService.XELOR_FREEPLAY_MANDATORY_PASSIVES) {
      expect(activeIds()).toContain(id);
    }
  });

  it("n'inclut jamais Connaissance du passé", () => {
    service.startSessionXelorFreeplay([
      'XEL_REMANENCE',
      'XEL_HORLOGERIE',
      'XEL_PERMUTATION_MOMENTANEE',
    ]);
    expect(activeIds()).not.toContain('XEL_CONNAISSANCE_PASSE');
  });

  it('reflète uniquement les passifs optionnels fournis', () => {
    service.startSessionXelorFreeplay(['XEL_HORLOGERIE']);
    expect(activeIds()).toContain('XEL_HORLOGERIE');
    expect(activeIds()).not.toContain('XEL_REMANENCE');
    expect(activeIds()).not.toContain('XEL_PERMUTATION_MOMENTANEE');
  });

  it('sans optionnel, ne garde que les obligatoires', () => {
    service.startSessionXelorFreeplay([]);
    expect(activeIds().slice().sort()).toEqual(
      [...InteractivePlayService.XELOR_FREEPLAY_MANDATORY_PASSIVES].sort()
    );
  });

  it('dédoublonne si un optionnel recoupe un obligatoire', () => {
    service.startSessionXelorFreeplay(['XEL_MAITRE_CADRAN', 'XEL_REMANENCE']);
    const ids = activeIds();
    expect(ids.filter(id => id === 'XEL_MAITRE_CADRAN').length).toBe(1);
    expect(ids).toContain('XEL_REMANENCE');
  });
});
