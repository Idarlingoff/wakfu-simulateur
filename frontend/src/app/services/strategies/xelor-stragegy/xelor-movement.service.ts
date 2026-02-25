import {inject, Injectable, Injector} from '@angular/core';
import {Position} from '../../../models/timeline.model';
import {MovementRecord, SimulationContext} from '../../calculators/simulation-engine.service';
import {BoardService} from '../../board.service';
import {XelorDialService} from './xelor-dial.service';

@Injectable({ providedIn: 'root' })
export class XelorMovementService {

  private readonly boardService = inject(BoardService);
  private readonly injector = inject(Injector);

  private get dial(): XelorDialService {
    return this.injector.get(XelorDialService);
  }

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
    },
    sourceActionId?: string
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
      sourceActionId: sourceActionId || context.currentActionId,
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

  /**
   * Récupère le dernier mouvement enregistré
   */
  public getLastMovement(context: SimulationContext): MovementRecord | null {
    if (!context.movementHistory || context.movementHistory.length === 0) {
      return null;
    }
    return context.movementHistory[context.movementHistory.length - 1];
  }

  /**
   * Annule un échange de position (swap)
   */
  public revertSwapMovement(movement: MovementRecord, context: SimulationContext): boolean {
    console.log(`[XELOR RETOUR_SPONTANE] 🔄 Reverting swap movement`);

    if (!movement.swapPartner) {
      console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ Swap movement has no partner info`);
      return false;
    }

    const partner = movement.swapPartner;

    // Cas 1: Swap entre deux entités
    if (movement.targetType === 'entity' && partner.type === 'entity') {
      const entity1 = this.boardService.getEntity(movement.targetId);
      const entity2 = this.boardService.getEntity(partner.id);

      if (!entity1 || !entity2) {
        console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ One or both entities not found`);
        return false;
      }

      // Ré-échanger les positions
      this.boardService.swapEntityPositions(movement.targetId, partner.id);

      // Mettre à jour le contexte si l'un est le joueur
      if (entity1.type === 'player') {
        context.playerPosition = { ...movement.fromPosition };
        context.currentPosition = { ...movement.fromPosition };
      }
      if (entity2.type === 'player') {
        context.playerPosition = { ...partner.fromPosition };
        context.currentPosition = { ...partner.fromPosition };
      }

      // Mettre à jour context.entities
      this.updateEntityPositionInContext(context, movement.targetId, movement.fromPosition);
      this.updateEntityPositionInContext(context, partner.id, partner.fromPosition);

      console.log(`[XELOR RETOUR_SPONTANE] ✅ Swap reverted: ${entity1.name} ↔ ${entity2.name}`);
      return true;
    }

    // Cas 2: Swap entre entité et mécanisme
    if ((movement.targetType === 'entity' && partner.type === 'mechanism') ||
      (movement.targetType === 'mechanism' && partner.type === 'entity')) {

      const entityId = movement.targetType === 'entity' ? movement.targetId : partner.id;
      const mechanismId = movement.targetType === 'mechanism' ? movement.targetId : partner.id;

      const entity = this.boardService.getEntity(entityId);
      const mechanism = this.boardService.getMechanism(mechanismId);

      if (!entity || !mechanism) {
        console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ Entity or mechanism not found`);
        return false;
      }

      // Ré-échanger les positions
      this.boardService.swapEntityWithMechanism(entityId, mechanismId);

      // Si c'est un cadran, mettre à jour les heures
      if (mechanism.type === 'dial') {
        this.dial.updateDialHoursAfterSwap(mechanismId, context);
      }

      // Déterminer les positions d'origine
      const entityOriginalPos = movement.targetType === 'entity' ? movement.fromPosition : partner.fromPosition;

      // Mettre à jour le contexte si c'est le joueur
      if (entity.type === 'player') {
        context.playerPosition = { ...entityOriginalPos };
        context.currentPosition = { ...entityOriginalPos };
      }

      // Mettre à jour context.entities
      this.updateEntityPositionInContext(context, entityId, entityOriginalPos);

      console.log(`[XELOR RETOUR_SPONTANE] ✅ Entity/Mechanism swap reverted: ${entity.name} ↔ ${mechanism.type}`);
      return true;
    }

    // Cas 3: Swap entre deux mécanismes
    if (movement.targetType === 'mechanism' && partner.type === 'mechanism') {
      const mechanism1 = this.boardService.getMechanism(movement.targetId);
      const mechanism2 = this.boardService.getMechanism(partner.id);

      if (!mechanism1 || !mechanism2) {
        console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ One or both mechanisms not found`);
        return false;
      }

      // Ré-échanger les positions
      this.boardService.swapMechanismPositions(movement.targetId, partner.id);

      // Mettre à jour les heures des cadrans si nécessaire
      if (mechanism1.type === 'dial') {
        this.dial.updateDialHoursAfterSwap(movement.targetId, context);
      }
      if (mechanism2.type === 'dial') {
        this.dial.updateDialHoursAfterSwap(partner.id, context);
      }

      console.log(`[XELOR RETOUR_SPONTANE] ✅ Mechanism swap reverted: ${mechanism1.type} ↔ ${mechanism2.type}`);
      return true;
    }

    return false;
  }

  /**
   * Annule un mouvement simple (téléportation, poussée, attirance)
   */
  public revertSimpleMovement(movement: MovementRecord, context: SimulationContext): boolean {
    console.log(`[XELOR RETOUR_SPONTANE] 🔄 Reverting simple ${movement.type} movement`);

    if (movement.targetType === 'entity') {
      // Trouver l'entité
      const entity = this.boardService.getEntity(movement.targetId);
      if (!entity) {
        console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ Entity ${movement.targetId} not found`);
        return false;
      }

      // Vérifier que l'entité est bien à la position "toPosition"
      if (entity.position.x !== movement.toPosition.x || entity.position.y !== movement.toPosition.y) {
        console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ Entity position mismatch: expected (${movement.toPosition.x}, ${movement.toPosition.y}), found (${entity.position.x}, ${entity.position.y})`);
        // On continue quand même, l'entité a peut-être bougé entre temps
      }

      // Remettre l'entité à sa position d'origine
      this.boardService.updateEntityPosition(movement.targetId, movement.fromPosition);

      // Mettre à jour le contexte si c'est le joueur
      if (entity.type === 'player') {
        context.playerPosition = { ...movement.fromPosition };
        context.currentPosition = { ...movement.fromPosition };
      }

      // Mettre à jour context.entities
      this.updateEntityPositionInContext(context, movement.targetId, movement.fromPosition);

      console.log(`[XELOR RETOUR_SPONTANE] ✅ Entity ${entity.name} returned to (${movement.fromPosition.x}, ${movement.fromPosition.y})`);
      return true;

    } else if (movement.targetType === 'mechanism') {
      // Trouver le mécanisme
      const mechanism = this.boardService.getMechanism(movement.targetId);
      if (!mechanism) {
        console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ Mechanism ${movement.targetId} not found`);
        return false;
      }

      // Remettre le mécanisme à sa position d'origine
      this.boardService.updateMechanismPosition(movement.targetId, movement.fromPosition);

      // Si c'est un cadran, mettre à jour les heures
      if (mechanism.type === 'dial') {
        this.dial.updateDialHoursAfterSwap(movement.targetId, context);
      }

      console.log(`[XELOR RETOUR_SPONTANE] ✅ Mechanism ${mechanism.type} returned to (${movement.fromPosition.x}, ${movement.fromPosition.y})`);
      return true;
    }

    return false;
  }
}
