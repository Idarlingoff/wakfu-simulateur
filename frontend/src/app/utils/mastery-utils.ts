export interface ElementalMasteries {
  masteryFire: number;
  masteryWater: number;
  masteryEarth: number;
  masteryAir: number;
}

/**
 * Résout la maîtrise élémentaire applicable en fonction de l'élément du sort.
 */
export function resolveElementalMastery(
  stats: ElementalMasteries,
  element?: string
): number {
  const normalizedElement = element?.toLowerCase()?.trim();

  switch (normalizedElement) {
    case 'fire':
    case 'feu':
      return stats.masteryFire;
    case 'water':
    case 'eau':
      return stats.masteryWater;
    case 'earth':
    case 'terre':
      return stats.masteryEarth;
    case 'air':
      return stats.masteryAir;
    default:
      return Math.max(
        stats.masteryFire,
        stats.masteryWater,
        stats.masteryEarth,
        stats.masteryAir
      );
  }
}

export function getHighestElementalMastery(stats: ElementalMasteries): number {
  return Math.max(
    stats.masteryFire,
    stats.masteryWater,
    stats.masteryEarth,
    stats.masteryAir
  );
}

