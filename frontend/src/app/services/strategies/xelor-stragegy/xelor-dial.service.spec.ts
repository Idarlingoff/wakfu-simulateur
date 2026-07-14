import { TestBed } from '@angular/core/testing';
import { XelorDialService } from './xelor-dial.service';
import { XelorPassivesService } from './xelor-passives.service';
import { XelorMechanismsService } from './xelor-mechanisms.service';
import { XelorDelayedEffectsService } from './xelor-delayed-effects.service';
import { XelorTeleportService } from './xelor-teleport.service';
import { getXelorState } from './xelor-state.utils';
import { SimulationContext } from '../../calculators/simulation-engine.service';

/**
 * Vérifie que les effets de "tour de cadran" (explosion Rouage, soin Sinistro)
 * ne se déclenchent PAS au tout premier wrap (pose du cadran à 12h -> 1h au 1er PW),
 * mais uniquement lors d'un vrai tour de cadran.
 */
describe('XelorDialService — processHourWrap (Rouage/Sinistro & tour de cadran)', () => {
  let service: XelorDialService;
  let mechanisms: jasmine.SpyObj<XelorMechanismsService>;

  beforeEach(() => {
    const passives = jasmine.createSpyObj('XelorPassivesService', [
      'applyPermutationMomentanee',
      'applyHorlogerie',
      'applyDialDefaultRegeneration',
      'hasMaitreDuCadranPassive',
    ]);
    passives.hasMaitreDuCadranPassive.and.returnValue(false);

    mechanisms = jasmine.createSpyObj('XelorMechanismsService', [
      'applyRouageDamage',
      'applySinistroHealing',
    ]);

    const delayed = jasmine.createSpyObj('XelorDelayedEffectsService', ['resolveDelayedEffects']);
    const teleport = jasmine.createSpyObj('XelorTeleportService', ['resolvePremonitionDeferredTeleport']);

    TestBed.configureTestingModule({
      providers: [
        XelorDialService,
        { provide: XelorPassivesService, useValue: passives },
        { provide: XelorMechanismsService, useValue: mechanisms },
        { provide: XelorDelayedEffectsService, useValue: delayed },
        { provide: XelorTeleportService, useValue: teleport },
      ],
    });
    service = TestBed.inject(XelorDialService);
  });

  function makeContext(auras: string[], firstLoopCompleted: boolean): SimulationContext {
    const ctx = {} as SimulationContext;
    const state = getXelorState(ctx, true);
    state.activeAuras = new Set(auras);
    state.dialFirstLoopCompleted = firstLoopCompleted;
    return ctx;
  }

  it("ne declenche PAS l'explosion Rouage au premier tour (pose)", () => {
    const ctx = makeContext(['ROUAGE_AURA'], false);
    service.processHourWrap(ctx);
    expect(mechanisms.applyRouageDamage).not.toHaveBeenCalled();
    expect(getXelorState(ctx).dialFirstLoopCompleted).toBe(true);
  });

  it("declenche l'explosion Rouage sur un tour de cadran reel", () => {
    const ctx = makeContext(['ROUAGE_AURA'], true);
    service.processHourWrap(ctx);
    expect(mechanisms.applyRouageDamage).toHaveBeenCalledTimes(1);
  });

  it('ne declenche PAS le soin Sinistro au premier tour (pose)', () => {
    const ctx = makeContext(['SINISTRO_AURA'], false);
    service.processHourWrap(ctx);
    expect(mechanisms.applySinistroHealing).not.toHaveBeenCalled();
  });

  it('declenche le soin Sinistro sur un tour de cadran reel', () => {
    const ctx = makeContext(['SINISTRO_AURA'], true);
    service.processHourWrap(ctx);
    expect(mechanisms.applySinistroHealing).toHaveBeenCalledTimes(1);
  });
});
