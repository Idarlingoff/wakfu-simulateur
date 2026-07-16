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
        { provide: SimulationEngineService, useValue: { initializeInteractiveContext: () => {} } },
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

  it('isXelorFreeplay est vrai apres startSessionXelorFreeplay', () => {
    service.startSessionXelorFreeplay(['XEL_HORLOGERIE']);
    expect(service.isXelorFreeplay()).toBe(true);
    expect(service.getXelorOptionalPassiveIds()).toContain('XEL_HORLOGERIE');
  });

  it('isXelorFreeplay est faux en freeplay classique', () => {
    service.startSessionFreeplay();
    expect(service.isXelorFreeplay()).toBe(false);
    expect(service.getXelorOptionalPassiveIds()).toEqual([]);
  });

  it('isXelorFreeplay repasse a faux apres stopSession', () => {
    service.startSessionXelorFreeplay(['XEL_HORLOGERIE']);
    service.stopSession();
    expect(service.isXelorFreeplay()).toBe(false);
    expect(service.getXelorOptionalPassiveIds()).toEqual([]);
  });
});

describe('InteractivePlayService — enregistrement', () => {
  let service: InteractivePlayService;

  beforeEach(() => {
    const engine = {
      initializeInteractiveContext: jasmine.createSpy('initializeInteractiveContext'),
      executeSingleStep: jasmine.createSpy('executeSingleStep').and.returnValue(
        Promise.resolve({ success: true, contextAfter: { playerPosition: { x: 3, y: 4 }, mechanisms: [], entities: [] }, actions: [] })
      ),
    };
    const simSvc = {
      appendInteractiveStep: jasmine.createSpy('appendInteractiveStep'),
      clearInteractiveSteps: jasmine.createSpy('clearInteractiveSteps'),
    };
    const stats = { calculateTotalStats: jasmine.createSpy('calc').and.returnValue({ ap: 12, mp: 3, wp: 6 }) };
    const board = {
      player: () => undefined,
      players: () => [],
      enemies: () => [],
      mechanisms: () => [],
      state: () => ({ entities: [], mechanisms: [] }),
      updateEntityPosition: jasmine.createSpy('updateEntityPosition'),
      updateEntity: jasmine.createSpy('updateEntity'),
      addEntity: jasmine.createSpy('addEntity'),
      removeEntity: jasmine.createSpy('removeEntity'),
      getEntity: () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        InteractivePlayService,
        { provide: SimulationEngineService, useValue: engine },
        { provide: SimulationService, useValue: simSvc },
        { provide: StatsCalculatorService, useValue: stats },
        { provide: BoardService, useValue: board },
      ],
    });
    service = TestBed.inject(InteractivePlayService);
  });

  it('démarre avec une séquence vide', () => {
    expect(service.recordedSteps()).toEqual([]);
  });

  it('enregistre un sort joué dans recordedSteps', async () => {
    service.startSessionFreeplay();
    await service.castSpell('spell_x', { x: 3, y: 4 });
    const steps = service.recordedSteps();
    expect(steps.length).toBe(1);
    expect(steps[0].actions[0].type).toBe('CastSpell');
    expect(steps[0].actions[0].spellId).toBe('spell_x');
    expect(steps[0].actions[0].targetPosition).toEqual({ x: 3, y: 4 });
  });

  it('clearRecording vide la séquence', async () => {
    service.startSessionFreeplay();
    await service.castSpell('spell_x', { x: 3, y: 4 });
    service.clearRecording();
    expect(service.recordedSteps()).toEqual([]);
  });

  it('un nouveau démarrage de session repart d une séquence vide', async () => {
    service.startSessionFreeplay();
    await service.castSpell('spell_x', { x: 3, y: 4 });
    service.startSessionFreeplay();
    expect(service.recordedSteps()).toEqual([]);
  });
});
