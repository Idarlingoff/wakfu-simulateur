import { resolveElementalMastery } from '../../utils/mastery-utils';

export interface ApplicableMasteryStats {
  masteryFire: number;
  masteryWater: number;
  masteryEarth: number;
  masteryAir: number;
  masteryMelee?: number;
  masteryDistance?: number;
  /** Maîtrise « secondaire » (fourre-tout hérité) : additive sur les dégâts, comme l'ancien calcul. */
  masterySecondary?: number;
  backMastery?: number;
  critMastery?: number;
  masteryHealing?: number;
}

export interface ApplicableMasteryInput {
  element?: string;
  stats: ApplicableMasteryStats;
  distanceCases: number;
  orientation: 'front' | 'side' | 'back';
  isCritical: boolean;
  isHeal: boolean;
}

/**
 * Somme des maîtrises applicables (formule Wakfu), stats du lanceur uniquement.
 * - élémentaire de l'élément du sort (la plus haute pour Lumière/Stasis via resolveElementalMastery) ;
 * - mêlée si distance <= 2, distance si >= 3 ;
 * - maîtrise secondaire (héritée) : additive sur les dégâts uniquement (pas sur les soins) ;
 * - dos si orientation 'back' ; critique si coup critique ; soin si effet de soin.
 * Berserk non appliqué (pas de PV disponible).
 */
export function resolveApplicableMasterySum(input: ApplicableMasteryInput): number {
  const { stats } = input;
  let sum = resolveElementalMastery(stats, input.element);

  sum += input.distanceCases <= 2 ? (stats.masteryMelee ?? 0) : (stats.masteryDistance ?? 0);
  if (!input.isHeal) sum += stats.masterySecondary ?? 0;
  if (input.orientation === 'back') sum += stats.backMastery ?? 0;
  if (input.isCritical) sum += stats.critMastery ?? 0;
  if (input.isHeal) sum += stats.masteryHealing ?? 0;

  return sum;
}
