import { resolveApplicableMasterySum, ApplicableMasteryStats } from './applicable-mastery';

const baseStats: ApplicableMasteryStats = {
  masteryFire: 100, masteryWater: 200, masteryEarth: 300, masteryAir: 400,
  masteryMelee: 50, masteryDistance: 70, backMastery: 30, critMastery: 40, masteryHealing: 60,
};

describe('resolveApplicableMasterySum — maitrise secondaire (heritee)', () => {
  const s: ApplicableMasteryStats = {
    masteryFire: 100, masteryWater: 0, masteryEarth: 0, masteryAir: 0,
    masteryMelee: 0, masteryDistance: 0, masterySecondary: 25, masteryHealing: 0,
  };
  it('ajoute la maitrise secondaire aux degats', () => {
    expect(resolveApplicableMasterySum({ element: 'FIRE', stats: s, distanceCases: 1, orientation: 'front', isCritical: false, isHeal: false }))
      .toBe(100 + 25);
  });
  it('n ajoute PAS la maitrise secondaire aux soins', () => {
    expect(resolveApplicableMasterySum({ element: 'FIRE', stats: s, distanceCases: 1, orientation: 'front', isCritical: false, isHeal: true }))
      .toBe(100);
  });
});

describe('resolveApplicableMasterySum', () => {
  it('prend la maitrise elementaire de l element du sort', () => {
    expect(resolveApplicableMasterySum({ element: 'FIRE', stats: baseStats, distanceCases: 1, orientation: 'front', isCritical: false, isHeal: false }))
      .toBe(100 + 50); // feu + melee (distance 1)
  });

  it('prend la plus haute elementaire pour LIGHT', () => {
    expect(resolveApplicableMasterySum({ element: 'LIGHT', stats: baseStats, distanceCases: 3, orientation: 'front', isCritical: false, isHeal: false }))
      .toBe(400 + 70); // plus haute (air) + distance (distance 3)
  });

  it('applique melee si distance <= 2 et distance si >= 3', () => {
    const meleeSum = resolveApplicableMasterySum({ element: 'AIR', stats: baseStats, distanceCases: 2, orientation: 'front', isCritical: false, isHeal: false });
    const distSum = resolveApplicableMasterySum({ element: 'AIR', stats: baseStats, distanceCases: 3, orientation: 'front', isCritical: false, isHeal: false });
    expect(meleeSum).toBe(400 + 50);
    expect(distSum).toBe(400 + 70);
  });

  it('ajoute la maitrise dos si orientation back', () => {
    expect(resolveApplicableMasterySum({ element: 'FIRE', stats: baseStats, distanceCases: 1, orientation: 'back', isCritical: false, isHeal: false }))
      .toBe(100 + 50 + 30);
  });

  it('ajoute la maitrise critique si isCritical', () => {
    expect(resolveApplicableMasterySum({ element: 'FIRE', stats: baseStats, distanceCases: 1, orientation: 'front', isCritical: true, isHeal: false }))
      .toBe(100 + 50 + 40);
  });

  it('ajoute la maitrise soin si isHeal', () => {
    expect(resolveApplicableMasterySum({ element: 'FIRE', stats: baseStats, distanceCases: 1, orientation: 'front', isCritical: false, isHeal: true }))
      .toBe(100 + 50 + 60);
  });
});
