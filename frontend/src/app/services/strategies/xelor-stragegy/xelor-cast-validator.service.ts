import {inject, Injectable} from '@angular/core';
import { Spell } from '../../../models/spell.model';
import { Position } from '../../../models/timeline.model';
import { SimulationContext } from "../../calculators/simulation-engine.service";
import {BoardService} from '../../board.service';
import {ClassValidationResult} from '../class-simulation-strategy.interface';
import {getSpellMechanismType} from '../../../utils/mechanism-utils';

@Injectable({ providedIn: 'root' })
export class XelorCastValidatorService {

  private static readonly RETOUR_SPONTANE = 'XEL_RETOUR_SPONTANE';
  private readonly boardService = inject(BoardService);

  /**
   * Vérifie les conditions de lancement spécifiques au Xelor
   */
  validateClassSpecificCasting(
    spell: Spell,
    casterPosition: Position,
    targetPosition: Position,
    context: SimulationContext
  ): ClassValidationResult {
    const mechanismType = getSpellMechanismType(spell.id);

    // Validation: 1 cadran par tour maximum
    if (mechanismType === 'dial') {
      const dialsPlacedThisTurn = context.mechanismsPlacedThisTurn?.get('dial') || 0;
      if (dialsPlacedThisTurn >= 1) {
        console.log(`[XELOR] ❌ Cadran déjà posé ce tour (${dialsPlacedThisTurn}/1)`);
        return {
          canCast: false,
          reason: 'Un seul Cadran peut être posé par tour'
        };
      }
    }

    // Validation spécifique pour le Régulateur
    if (mechanismType === 'regulateur') {
      // Le régulateur ne peut être posé QUE sur les cases heures du cadran
      const isOnDialHour = this.boardService.isPositionOnDialHour(targetPosition);

      if (!isOnDialHour) {
        console.log(`[XELOR] ❌ Régulateur cannot be placed: target position (${targetPosition.x}, ${targetPosition.y}) is not on a dial hour`);
        return {
          canCast: false,
          reason: 'Le Régulateur ne peut être posé que sur les heures du cadran'
        };
      }

      // Vérifier qu'il y a un cadran actif
      const dials = this.boardService.getMechanismsByType('dial');
      if (dials.length === 0) {
        console.log(`[XELOR] ❌ Régulateur cannot be placed: no active dial on board`);
        return {
          canCast: false,
          reason: 'Le Régulateur nécessite un Cadran actif sur le plateau'
        };
      }

      console.log(`[XELOR] ✅ Régulateur can be placed on dial hour at (${targetPosition.x}, ${targetPosition.y})`);
    }

    if (spell.id === 'XEL_PARADOXE') {
      const targetEntity = this.boardService.getEntityAtPosition(targetPosition);
      const targetMechanism = this.boardService.getMechanismAtPosition(targetPosition);

      if (!targetEntity && !targetMechanism) {
        console.log(`[XELOR] ❌ Paradoxe cannot be cast on empty cell (${targetPosition.x}, ${targetPosition.y})`);
        return {
          canCast: false,
          reason: 'Paradoxe doit cibler une entité ou un mécanisme'
        };
      }
    }

    // TODO: Ajouter d'autres validations spécifiques
    // - Certains sorts ont des conditions basées sur les heures du cadran

    return {
      canCast: true
    };
  }

  /**
   * Vérifie si Distorsion est actuellement active
   */
  public isDistorsionActive(context: SimulationContext): boolean {
    return context.distorsionActive === true;
  }

  /**
   * Vérifie si un spell ID correspond au sort "Retour Spontané"
   */
  public isRetourSpontaneSpell(spellId: string): boolean {
    const lowerSpellId = spellId.toLowerCase();
    return lowerSpellId === XelorCastValidatorService.RETOUR_SPONTANE.toLowerCase();
  }
}
