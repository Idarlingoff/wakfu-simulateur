import { DamageCalculatorService } from './damage-calculator.service';

describe('DamageCalculatorService.computeEffectValues', () => {
  let svc: DamageCalculatorService;
  beforeEach(() => { svc = new DamageCalculatorService(); });

  const stats = {
    masteryFire: 100, masteryWater: 0, masteryEarth: 0, masteryAir: 0,
    masteryMelee: 0, masteryDistance: 0, backMastery: 0, critMastery: 0, masteryHealing: 0,
    dommageInflict: 0, critRate: 0,
  };

  it('degats: base normale, pas de resistance, mastery 100% double la base', () => {
    const r = svc.computeEffectValues({
      effectType: 'DEAL_DAMAGE', normalBase: 100, critBase: 125,
      element: 'FIRE', stats, distanceCases: 1, orientation: 'front',
    });
    // normal: 100 * (1 + 100/100) = 200
    expect(r.normal).toBe(200);
  });

  it('degats crit: utilise critBase SANS reappliquer x1.25 (critBase inclut deja le x1.25)', () => {
    const r = svc.computeEffectValues({
      effectType: 'DEAL_DAMAGE', normalBase: 100, critBase: 125,
      element: 'FIRE', stats, distanceCases: 1, orientation: 'front',
    });
    // crit: 125 * (1 + 100/100) = 250  (et NON 125 * 2 * 1.25)
    expect(r.crit).toBe(250);
  });

  it('moyenne ponderee par critRate', () => {
    const r = svc.computeEffectValues({
      effectType: 'DEAL_DAMAGE', normalBase: 100, critBase: 125,
      element: 'FIRE', stats: { ...stats, critRate: 50 }, distanceCases: 1, orientation: 'front',
    });
    // normal 200, crit 250 -> moyenne = 200*0.5 + 250*0.5 = 225
    expect(r.average).toBe(225);
  });

  it('soin: applique la maitrise elementaire (comme les degats) + x1.25 en crit', () => {
    // element FIRE, masteryFire 100, masteryHealing 0 -> maitrise applicable = 100
    const r = svc.computeEffectValues({
      effectType: 'HEAL', normalBase: 100,
      element: 'FIRE', stats, distanceCases: 1, orientation: 'front',
    });
    // normal: 100 * (1 + 100/100) = 200 ; crit (pas de critBase): 200 * 1.25 = 250
    expect(r.normal).toBe(200);
    expect(r.crit).toBe(250);
  });

  it('soin: la maitrise soin s ajoute a l elementaire', () => {
    // masteryFire 100 + masteryHealing 50 -> maitrise applicable = 150
    const r = svc.computeEffectValues({
      effectType: 'HEAL', normalBase: 100,
      element: 'FIRE', stats: { ...stats, masteryHealing: 50 }, distanceCases: 1, orientation: 'front',
    });
    // normal: 100 * (1 + 150/100) = 250
    expect(r.normal).toBe(250);
  });

  it('bouclier: aucune maitrise, seul le crit x1.25', () => {
    const r = svc.computeEffectValues({
      effectType: 'GIVE_ARMOR', normalBase: 100,
      element: 'FIRE', stats, distanceCases: 1, orientation: 'front',
    });
    expect(r.normal).toBe(100);
    expect(r.crit).toBe(125);
  });
});
