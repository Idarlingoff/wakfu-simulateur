import {Injectable} from '@angular/core';
import {Position} from '../../../models/timeline.model';
import {MovementRecord, SimulationContext} from '../../calculators/simulation-engine.service';

@Injectable({ providedIn: 'root' })
export class XelorMovementService {

  /**
   * Enregistre un mouvement (téléportation, poussée, attirance, échange)
   * Utilisé pour le sort "Retour Spontané"
   *
   * @param context Contexte de simulation
   * @param type Type de mouvement
   * @param targetId ID de l'entité/mécanisme déplacé
   * @param targetType Type de cible
   * @param targetName Nom de la cible
   * @param fromPosition Position avant le mouvement
   * @param toPosition Position après le mouvement
   * @param sourceSpellId ID du sort source (optionnel)
   * @param swapPartner Informations sur le partenaire de swap (optionnel)
   */
  public recordMovement(
    context: SimulationContext,
    type: 'teleport' | 'push' | 'pull' | 'swap' | 'swap_mechanism',
    targetId: string,
    targetType: 'entity' | 'mechanism',
    targetName: string,
    fromPosition: Position,
    toPosition: Position,
    sourceSpellId?: string,
    swapPartner?: {
      id: string;
      type: 'entity' | 'mechanism';
      name: string;
      fromPosition: Position;
      toPosition: Position;
    }
  ): void {
    this.initMovementHistory(context);

    const movement: MovementRecord = {
      id: `movement_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      targetId,
      targetType,
      targetName,
      fromPosition: { ...fromPosition },
      toPosition: { ...toPosition },
      sourceSpellId,
      timestamp: Date.now(),
      swapPartner: swapPartner ? {
        ...swapPartner,
        fromPosition: { ...swapPartner.fromPosition },
        toPosition: { ...swapPartner.toPosition }
      } : undefined
    };

    context.movementHistory!.push(movement);
    console.log(`[XELOR MOVEMENT] 📝 Recorded ${type} movement: ${targetName} (${fromPosition.x}, ${fromPosition.y}) → (${toPosition.x}, ${toPosition.y})`);

    if (swapPartner) {
      console.log(`[XELOR MOVEMENT]    Swap partner: ${swapPartner.name} (${swapPartner.fromPosition.x}, ${swapPartner.fromPosition.y}) → (${swapPartner.toPosition.x}, ${swapPartner.toPosition.y})`);
    }
  }

  /**
   * Met à jour la position d'une entité dans le contexte de simulation (context.entities)
   * Cette méthode est importante pour maintenir la cohérence entre BoardService et le contexte
   *
   * @param context Le contexte de simulation
   * @param entityId L'ID de l'entité à mettre à jour
   * @param newPosition La nouvelle position
   */
  public updateEntityPositionInContext(context: SimulationContext, entityId: string, newPosition: Position): void {
    if (!context.entities) {
      console.warn(`[XELOR] ⚠️ context.entities is undefined, cannot update position for entity ${entityId}`);
      return;
    }

    const entityInContext = context.entities.find(e => e.id === entityId);
    if (entityInContext) {
      const oldPosition = entityInContext.position;
      entityInContext.position = { ...newPosition };
      console.log(`[XELOR] 📍 Updated entity ${entityId} position in context: (${oldPosition.x}, ${oldPosition.y}) → (${newPosition.x}, ${newPosition.y})`);
    } else {
      console.warn(`[XELOR] ⚠️ Entity ${entityId} not found in context.entities`);
    }
  }

  // ============ MOUVEMENT TRACKING (pour Retour Spontané) ============

  /**
   * Initialise l'historique des mouvements si nécessaire
   */
  private initMovementHistory(context: SimulationContext): void {
    if (!context.movementHistory) {
      context.movementHistory = [];
    }
  }
}
