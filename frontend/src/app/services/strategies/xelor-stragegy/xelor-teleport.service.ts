import {inject, Injectable} from '@angular/core';
import {Spell} from '../../../models/spell.model';
import {Position, TimelineAction} from '../../../models/timeline.model';
import {SimulationActionResult, SimulationContext} from '../../calculators/simulation-engine.service';
import {BoardService} from '../../board.service';
import {BoardEntity, Mechanism} from '../../../models/board.model';
import {ResourceRegenerationService} from '../../processors/resource-regeneration.service';
import {XelorPassivesService} from './xelor-passives.service';
import {XelorMovementService} from './xelor-movement.service';
import {XelorDialService} from './xelor-dial.service';
import {getXelorState} from './xelor-state.utils';

type TeleportUnit =
  | { kind: 'entity'; id: string; name: string; entityType: string; position: Position }
  | { kind: 'mechanism'; id: string; name: string; mechType: string; position: Position };

@Injectable({ providedIn: 'root'})
export class XelorTeleportService {

  private readonly boardService = inject(BoardService);
  private readonly regenerationService = inject(ResourceRegenerationService);
  private readonly xelorPassivesService = inject(XelorPassivesService);
  private readonly xelorMovementService = inject(XelorMovementService);

  private entityToUnit(entity: BoardEntity): TeleportUnit {
    return { kind: 'entity', id: entity.id, name: entity.name, entityType: entity.type, position: { ...entity.position } };
  }

  private mechanismToUnit(mechanism: Mechanism): TeleportUnit {
    return { kind: 'mechanism', id: mechanism.id, name: mechanism.type, mechType: mechanism.type, position: { ...mechanism.position } };
  }

  private unitDisplayName(unit: TeleportUnit): string {
    return unit.kind === 'entity' ? unit.name : `${unit.name} (${unit.id})`;
  }

  private computeDirection(from: Position, to: Position): { dirX: number; dirY: number } {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) > Math.abs(dy)) return { dirX: dx > 0 ? 1 : -1, dirY: 0 };
    if (Math.abs(dy) > Math.abs(dx)) return { dirX: 0, dirY: dy > 0 ? 1 : -1 };
    return {
      dirX: dx !== 0 ? (dx > 0 ? 1 : -1) : 0,
      dirY: dy !== 0 ? (dy > 0 ? 1 : -1) : 0
    };
  }

  private isOutOfBounds(pos: Position): boolean {
    const state = this.boardService.state();
    return pos.x < 0 || pos.x >= state.cols || pos.y < 0 || pos.y >= state.rows;
  }

  private updatePlayerPositionIfNeeded(context: SimulationContext, unit: TeleportUnit, newPosition: Position): void {
    if (unit.kind === 'entity' && unit.entityType === 'player') {
      context.playerPosition = newPosition;
      context.currentPosition = newPosition;
    }
  }

  private getUnitAtPosition(position: Position): TeleportUnit | undefined {
    const entity = this.boardService.getEntityAtPosition(position);
    if (entity) return this.entityToUnit(entity);
    const mechanism = this.boardService.getMechanismAtPosition(position);
    if (mechanism) return this.mechanismToUnit(mechanism);
    return undefined;
  }
  private isStabilized(unit: TeleportUnit): boolean {
    return unit.kind === 'mechanism' && unit.mechType === 'dial';
  }

  /**
   * Exécute un swap sur le plateau entre deux unités.
   * @param a Première unité (entity ou mechanism)
   * @param b Deuxième unité (entity ou mechanism)
   * @returns boolean indiquant si le swap a réussi
   */
  private performBoardSwap(a: TeleportUnit, b: TeleportUnit): boolean {
    if (a.kind === 'entity' && b.kind === 'entity') {
      return this.boardService.swapEntityPositions(a.id, b.id);
    }
    if (a.kind === 'entity' && b.kind === 'mechanism') {
      return this.boardService.swapEntityWithMechanism(a.id, b.id);
    }
    if (a.kind === 'mechanism' && b.kind === 'entity') {
      return this.boardService.swapEntityWithMechanism(b.id, a.id);
    }
    return this.boardService.swapMechanismPositions(a.id, b.id);
  }

  /**
   * Applique tous les effets de bord d'un swap réussi :
   * @param target L'unité ciblée par le téléport
   * @param occupant L'unité occupant la case de destination (swappée)
   * @param sourcePosition La position d'origine de la cible
   * @param destinationPosition La position de destination de la cible (et d'origine de l'occupant)
   * @param context Le contexte de simulation
   * @param spellId L'ID du sort qui a déclenché le téléport
   * @param actionResult L'objet de résultat de l'action, à enrichir avec les détails du swap
   */
  private applySwapSideEffects(
    target: TeleportUnit,
    occupant: TeleportUnit,
    sourcePosition: Position,
    destinationPosition: Position,
    context: SimulationContext,
    spellId: string,
    actionResult: SimulationActionResult
  ): void {

    const hasMechanism = target.kind === 'mechanism' || occupant.kind === 'mechanism';
    const trigger = hasMechanism ? 'ON_SWAP_MECHANISM' : 'ON_SWAP';
    this.regenerationService.regeneratePA(
      context, 1, 'POINTE_HEURE',
      `Pointe-heure: +1 PA (échange de position)`,
      { spellId, trigger }
    );
    console.log(`[XELOR TELEPORT] 💰 +1 PA granted (swap bonus)`);

    const swapType = `${target.kind}_${occupant.kind}_swap`;
    this.xelorPassivesService.applyCoursduTempsOnTransposition(context, swapType);

    if (target.kind === 'entity') {
      this.xelorMovementService.updateEntityPositionInContext(context, target.id, destinationPosition);
    }
    if (occupant.kind === 'entity') {
      this.xelorMovementService.updateEntityPositionInContext(context, occupant.id, sourcePosition);
    }

    this.updatePlayerPositionIfNeeded(context, target, destinationPosition);
    this.updatePlayerPositionIfNeeded(context, occupant, sourcePosition);

    const bothMechanisms = target.kind === 'mechanism' && occupant.kind === 'mechanism';
    const movementType = hasMechanism && !bothMechanisms ? 'swap_mechanism' : 'swap';
    this.xelorMovementService.recordMovement(
      context, movementType,
      target.id, target.kind, target.name,
      sourcePosition, destinationPosition, spellId,
      {
        id: occupant.id,
        type: occupant.kind,
        name: occupant.name,
        fromPosition: destinationPosition,
        toPosition: sourcePosition
      }
    );

    const detailType = bothMechanisms ? 'swap_mechanisms'
      : hasMechanism ? 'swap_mechanism' : 'swap';
    if (!actionResult.details) actionResult.details = {};
    actionResult.details.teleport = {
      type: detailType,
      ...(target.kind === 'entity' ? { targetEntity: target.name } : { targetMechanism: this.unitDisplayName(target) }),
      swappedWith: this.unitDisplayName(occupant),
      from: sourcePosition,
      to: destinationPosition,
      paGained: 1
    };

    console.log(`[XELOR TELEPORT] ✅ Swap successful!`);
  }

  /**
   * Applique un téléport simple (case de destination vide) :
   * @param target L'unité ciblée par le téléport
   * @param sourcePosition La position d'origine de la cible
   * @param destinationPosition La position de destination de la cible
   * @param context Le contexte de simulation
   * @param spellId L'ID du sort qui a déclenché le téléport
   * @param actionResult L'objet de résultat de l'action, à enrichir avec les détails du téléport
   */
  private applySimpleTeleport(
    target: TeleportUnit,
    sourcePosition: Position,
    destinationPosition: Position,
    context: SimulationContext,
    spellId: string,
    actionResult: SimulationActionResult
  ): void {
    if (target.kind === 'entity') {
      this.boardService.updateEntityPosition(target.id, destinationPosition);
      this.xelorMovementService.updateEntityPositionInContext(context, target.id, destinationPosition);
    } else {
      this.boardService.updateMechanismPosition(target.id, destinationPosition);
    }
    this.updatePlayerPositionIfNeeded(context, target, destinationPosition);

    this.xelorMovementService.recordMovement(
      context, 'teleport',
      target.id, target.kind, target.name,
      sourcePosition, destinationPosition, spellId
    );

    const detailType = target.kind === 'entity' ? 'simple' : 'simple_mechanism';
    if (!actionResult.details) actionResult.details = {};
    actionResult.details.teleport = {
      type: detailType,
      ...(target.kind === 'entity' ? { targetEntity: target.name } : { targetMechanism: this.unitDisplayName(target) }),
      from: sourcePosition,
      to: destinationPosition
    };

    console.log(`[XELOR TELEPORT] ✅ Teleport successful!`);
  }

  /**
   * Traite les effets TELEPORT d'un sort (Pointe-heure, etc.)
   * @param spell Le sort lancé
   * @param action L'action de timeline correspondante
   * @param context Le contexte de simulation
   * @param actionResult L'objet de résultat de l'action, à enrichir avec les détails du téléport
   */
  public processTeleportEffects(
    spell: Spell,
    action: TimelineAction,
    context: SimulationContext,
    actionResult: SimulationActionResult
  ): void {
    const variantKind = actionResult.details?.isCritical ? 'CRIT' : 'NORMAL';
    const variant = spell.variants.find(v => v.kind === variantKind)
      || spell.variants.find(v => v.kind === 'NORMAL');
    if (!variant) return;

    const teleportEffects = variant.effects.filter(
      e => e.effect === 'TELEPORT' || e.effect === 'TELEPORT_SYMMETRIC'
    );
    if (teleportEffects.length === 0) return;

    for (const effect of teleportEffects) {
      if (effect.effect === 'TELEPORT_SYMMETRIC') {
        this.processSymmetricTeleportEffect(action, context, actionResult, effect.extendedData || {}, spell.id);
        continue;
      }

      const cells = effect.extendedData?.cells || 2;
      const direction = effect.extendedData?.direction || 'BACK';
      console.log(`[XELOR TELEPORT] 🌀 Processing TELEPORT effect: ${cells} cells, direction: ${direction}`);

      const casterPosition = this.boardService.player()?.position || context.playerPosition;
      const targetPosition = action.targetPosition;
      if (!casterPosition || !targetPosition) {
        console.warn(`[XELOR TELEPORT] ⚠️ Missing caster or target position`);
        continue;
      }

      const target = this.getUnitAtPosition(targetPosition);
      if (!target) {
        console.warn(`[XELOR TELEPORT] ⚠️ No entity or mechanism at target (${targetPosition.x}, ${targetPosition.y})`);
        continue;
      }
      if (this.isStabilized(target)) {
        console.warn(`[XELOR TELEPORT] ⚠️ Target ${this.unitDisplayName(target)} is stabilized and cannot be teleported`);
        continue;
      }
      console.log(`[XELOR TELEPORT] 🎯 Target: ${target.kind} ${this.unitDisplayName(target)} at (${targetPosition.x}, ${targetPosition.y})`);

      const { dirX, dirY } = this.computeDirection(casterPosition, targetPosition);
      const pushMultiplier = direction === 'BACK' ? 1 : -1;
      const destinationPosition: Position = {
        x: targetPosition.x + (dirX * cells * pushMultiplier),
        y: targetPosition.y + (dirY * cells * pushMultiplier)
      };
      console.log(`[XELOR TELEPORT] 📍 Destination: (${destinationPosition.x}, ${destinationPosition.y})`);

      if (this.isOutOfBounds(destinationPosition)) {
        console.warn(`[XELOR TELEPORT] ⚠️ Destination out of bounds`);
        continue;
      }

      const occupant = this.getUnitAtPosition(destinationPosition);

      if (occupant) {
        if (this.isStabilized(occupant)) {
          console.warn(`[XELOR TELEPORT] ⚠️ Destination occupied by stabilized ${this.unitDisplayName(occupant)} - teleport blocked`);
          continue;
        }
        console.log(`[XELOR TELEPORT] 🔄 Destination occupied by ${occupant.kind} ${this.unitDisplayName(occupant)} - SWAP!`);
        const swapSuccess = this.performBoardSwap(target, occupant);
        if (swapSuccess) {
          this.applySwapSideEffects(target, occupant, targetPosition, destinationPosition, context, spell.id, actionResult);
        }
      } else {
        this.applySimpleTeleport(target, targetPosition, destinationPosition, context, spell.id, actionResult);
      }
    }
  }

  private processSymmetricTeleportEffect(
    action: TimelineAction,
    context: SimulationContext,
    actionResult: SimulationActionResult,
    params: any,
    sourceSpellId: string
  ): void {
    const mode = params?.mode || 'AREA_CROSS';
    if (mode === 'SINGLE_TARGET') {
      this.processSingleTargetSymmetricTeleport(action, context, actionResult, params);
      return;
    }

    const center = action.targetPosition;
    if (!center) {
      console.warn('[XELOR TELEPORT] ⚠️ TELEPORT_SYMMETRIC skipped: no center target position');
      return;
    }

    const areaRange = Number(params?.range ?? params?.radius ?? 2);
    const state = this.boardService.state();
    const entitiesInArea = state.entities.filter(entity => {
      const dx = entity.position.x - center.x;
      const dy = entity.position.y - center.y;
      return (dx === 0 && Math.abs(dy) <= areaRange)
        || (dy === 0 && Math.abs(dx) <= areaRange);
    });

    // Ordre de traitement identique au jeu: du centre vers les extrémités.
    // Ce tri est aussi important pour Retour Spontané qui annule le dernier échange enregistré.
    entitiesInArea.sort((a, b) => {
      const distanceA = Math.abs(a.position.x - center.x) + Math.abs(a.position.y - center.y);
      const distanceB = Math.abs(b.position.x - center.x) + Math.abs(b.position.y - center.y);

      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }

      if (a.position.y !== b.position.y) {
        return a.position.y - b.position.y;
      }

      return a.position.x - b.position.x;
    });

    if (entitiesInArea.length === 0) {
      console.log('[XELOR TELEPORT] ℹ️ TELEPORT_SYMMETRIC: no entity in area');
      return;
    }

    const entityByPosition = new Map<string, typeof entitiesInArea[number]>();
    for (const entity of entitiesInArea) {
      entityByPosition.set(`${entity.position.x},${entity.position.y}`, entity);
    }

    const processedEntityIds = new Set<string>();
    const movements: Array<{ entityId: string; from: Position; to: Position; swappedWith?: string }> = [];

    for (const entity of entitiesInArea) {
      if (processedEntityIds.has(entity.id)) continue;

      const from: Position = { ...entity.position };
      const symmetric: Position = {
        x: center.x * 2 - from.x,
        y: center.y * 2 - from.y
      };

      if (
        symmetric.x < 0 || symmetric.x >= state.cols ||
        symmetric.y < 0 || symmetric.y >= state.rows
      ) {
        processedEntityIds.add(entity.id);
        continue;
      }

      const oppositeEntity = entityByPosition.get(`${symmetric.x},${symmetric.y}`);
      if (oppositeEntity && oppositeEntity.id !== entity.id) {
        if (processedEntityIds.has(oppositeEntity.id)) continue;

        const oppositeFrom: Position = { ...oppositeEntity.position };
        const swapSuccess = this.boardService.swapEntityPositions(entity.id, oppositeEntity.id);
        if (swapSuccess) {
          this.xelorMovementService.updateEntityPositionInContext(context, entity.id, oppositeFrom);
          this.xelorMovementService.updateEntityPositionInContext(context, oppositeEntity.id, from);

          this.xelorMovementService.recordMovement(
            context,
            'swap',
            entity.id,
            'entity',
            entity.name,
            from,
            oppositeFrom,
            sourceSpellId,
            {
              id: oppositeEntity.id,
              type: 'entity',
              name: oppositeEntity.name,
              fromPosition: oppositeFrom,
              toPosition: from
            }
          );

          this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'symetrie_area_swap');

          if (entity.type === 'player') {
            context.playerPosition = oppositeFrom;
            context.currentPosition = oppositeFrom;
          }
          if (oppositeEntity.type === 'player') {
            context.playerPosition = from;
            context.currentPosition = from;
          }

          movements.push(
            {
              entityId: entity.id,
              from,
              to: oppositeFrom,
              swappedWith: oppositeEntity.id },
            {
            entityId: oppositeEntity.id,
            from: oppositeFrom,
            to: from,
            swappedWith: entity.id
            }
          );
        }

        processedEntityIds.add(entity.id);
        processedEntityIds.add(oppositeEntity.id);
        continue;
      }

      if (from.x === symmetric.x && from.y === symmetric.y) {
        processedEntityIds.add(entity.id);
        continue;
      }

      const occupiedByEntity = this.boardService.getEntityAtPosition(symmetric);
      const occupiedByMechanism = this.boardService.getMechanismAtPosition(symmetric);
      if (occupiedByEntity || occupiedByMechanism) {
        processedEntityIds.add(entity.id);
        continue;
      }

      this.boardService.updateEntityPosition(entity.id, symmetric);
      this.xelorMovementService.updateEntityPositionInContext(context, entity.id, symmetric);

      this.xelorMovementService.recordMovement(
        context,
        'teleport',
        entity.id,
        'entity',
        entity.name,
        from,
        symmetric,
        sourceSpellId
      );

      if (entity.type === 'player') {
        context.playerPosition = symmetric;
        context.currentPosition = symmetric;
      }

      movements.push({ entityId: entity.id, from, to: symmetric });
      processedEntityIds.add(entity.id);
    }

    if (movements.length > 0) {
      if (!actionResult.details) actionResult.details = {};
      actionResult.details.teleport = {
        type: 'symmetric_area',
        center,
        area: 'CROSS',
        range: areaRange,
        movedCount: movements.length,
        movements
      };

      console.log(`[XELOR TELEPORT] ✅ TELEPORT_SYMMETRIC applied (${movements.length} movement(s))`);
    }
  }

  private processSingleTargetSymmetricTeleport(
    action: TimelineAction,
    context: SimulationContext,
    actionResult: SimulationActionResult,
    params: any
  ): void {
    const casterEntity = this.boardService.player();
    const targetPosition = action.targetPosition;

    if (!casterEntity || !targetPosition) {
      console.warn('[XELOR TELEPORT] ⚠️ TELEPORT_SYMMETRIC (single) skipped: missing caster or target position');
      return;
    }

    const casterPosition: Position = { ...casterEntity.position };
    const currentHour = getXelorState(context, true).currentDialHour ?? this.boardService.currentDialHour() ?? 0;
    const reverseOnOddHour = params?.reverseOnOddHour === true;
    const shouldReverse = reverseOnOddHour && currentHour % 2 === 1;

    const moving: TeleportUnit | undefined = shouldReverse
      ? this.getUnitAtPosition(targetPosition)
      : this.entityToUnit(casterEntity);

    if (!moving) {
      console.warn('[XELOR TELEPORT] ⚠️ TELEPORT_SYMMETRIC (single) skipped: no valid unit to move');
      return;
    }
    if (this.isStabilized(moving)) {
      console.warn(`[XELOR TELEPORT] ⚠️ TELEPORT_SYMMETRIC (single) skipped: ${this.unitDisplayName(moving)} is stabilized`);
      return;
    }

    const movingFrom: Position = { ...moving.position };
    const anchor = shouldReverse ? casterPosition : targetPosition;
    const mirroredSource = shouldReverse ? targetPosition : casterPosition;
    const destination: Position = {
      x: anchor.x * 2 - mirroredSource.x,
      y: anchor.y * 2 - mirroredSource.y
    };

    if (this.isOutOfBounds(destination)) {
      console.warn(`[XELOR TELEPORT] ⚠️ TELEPORT_SYMMETRIC (single) destination out of bounds: (${destination.x}, ${destination.y})`);
      return;
    }

    const mirroredAround = shouldReverse ? 'CASTER' : 'TARGET';
    const symmetricDetails = { mirroredAround, currentHour };

    const occupant = this.getUnitAtPosition(destination);
    const isSameUnit = occupant?.id === moving.id;

    if (occupant && !isSameUnit) {
      if (this.isStabilized(occupant)) {
        console.warn(`[XELOR TELEPORT] ⚠️ TELEPORT_SYMMETRIC (single) blocked: destination occupied by stabilized ${this.unitDisplayName(occupant)}`);
        return;
      }
      const swapSuccess = this.performBoardSwap(moving, occupant);
      if (!swapSuccess) return;

      this.applySymmetricSwapSideEffects(moving, occupant, movingFrom, destination, context, action.spellId ?? '');

      if (!actionResult.details) actionResult.details = {};
      actionResult.details.teleport = {
        type: this.resolveSymmetricSwapDetailType(moving, occupant),
        ...(moving.kind === 'entity' ? { movedEntityId: moving.id } : { movedMechanismId: moving.id }),
        from: movingFrom,
        to: destination,
        swappedWith: occupant.id,
        ...symmetricDetails
      };
    } else {
      this.applySymmetricSimpleTeleport(moving, movingFrom, destination, context, action.spellId ?? '');

      if (!actionResult.details) actionResult.details = {};
      actionResult.details.teleport = {
        type: 'symmetric_single',
        ...(moving.kind === 'entity' ? { movedEntityId: moving.id } : { movedMechanismId: moving.id }),
        from: movingFrom,
        to: destination,
        ...symmetricDetails
      };
    }
  }

  /**
   * Applique les effets de bord d'un swap symétrique single-target :
   * Dial + positions dans le contexte + mouvement + passif Cours du Temps
   * (Pas de regeneratePA pour les swaps symétriques, contrairement à processTeleportEffects)
   */
  private applySymmetricSwapSideEffects(
    moving: TeleportUnit,
    occupant: TeleportUnit,
    movingFrom: Position,
    destination: Position,
    context: SimulationContext,
    spellId: string
  ): void {

    if (moving.kind === 'entity') {
      this.xelorMovementService.updateEntityPositionInContext(context, moving.id, destination);
    }
    if (occupant.kind === 'entity') {
      this.xelorMovementService.updateEntityPositionInContext(context, occupant.id, movingFrom);
    }

    this.updatePlayerPositionIfNeeded(context, moving, destination);
    this.updatePlayerPositionIfNeeded(context, occupant, movingFrom);

    const hasMechanism = moving.kind === 'mechanism' || occupant.kind === 'mechanism';
    const bothMechanisms = moving.kind === 'mechanism' && occupant.kind === 'mechanism';
    const movementType = hasMechanism && !bothMechanisms ? 'swap_mechanism' : 'swap';

    this.xelorMovementService.recordMovement(
      context, movementType,
      moving.id, moving.kind, moving.name,
      movingFrom, destination, spellId,
      {
        id: occupant.id,
        type: occupant.kind,
        name: occupant.name,
        fromPosition: destination,
        toPosition: movingFrom
      }
    );

    const swapType = `symetrie_single_${moving.kind}_${occupant.kind === moving.kind ? '' : occupant.kind + '_'}swap`;
    this.xelorPassivesService.applyCoursduTempsOnTransposition(context, swapType);
  }

  /**
   * Applique un téléport simple symétrique (case de destination vide)
   */
  private applySymmetricSimpleTeleport(
    moving: TeleportUnit,
    movingFrom: Position,
    destination: Position,
    context: SimulationContext,
    spellId: string
  ): void {
    if (moving.kind === 'entity') {
      this.boardService.updateEntityPosition(moving.id, destination);
      this.xelorMovementService.updateEntityPositionInContext(context, moving.id, destination);
    } else {
      this.boardService.updateMechanismPosition(moving.id, destination);
    }
    this.updatePlayerPositionIfNeeded(context, moving, destination);

    this.xelorMovementService.recordMovement(
      context, 'teleport',
      moving.id, moving.kind, moving.name,
      movingFrom, destination, spellId
    );
  }

  private resolveSymmetricSwapDetailType(moving: TeleportUnit, occupant: TeleportUnit): string {
    if (moving.kind === 'entity' && occupant.kind === 'entity') return 'symmetric_single_swap';
    if (moving.kind === 'entity' && occupant.kind === 'mechanism') return 'symmetric_single_swap_mechanism';
    if (moving.kind === 'mechanism' && occupant.kind === 'entity') return 'symmetric_single_swap_with_entity';
    return 'symmetric_single_swap_mechanism_mechanism';
  }
}
