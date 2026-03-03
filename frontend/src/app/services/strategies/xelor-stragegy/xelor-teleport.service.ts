import {inject, Injectable} from '@angular/core';
import {Spell} from '../../../models/spell.model';
import {Position, TimelineAction} from '../../../models/timeline.model';
import {SimulationActionResult, SimulationContext} from '../../calculators/simulation-engine.service';
import {BoardService} from '../../board.service';
import {ResourceRegenerationService} from '../../processors/resource-regeneration.service';
import {XelorPassivesService} from './xelor-passives.service';
import {XelorMovementService} from './xelor-movement.service';
import {XelorDialService} from './xelor-dial.service';
import {getXelorState} from './xelor-state.utils';

@Injectable({ providedIn: 'root'})
export class XelorTeleportService {

  private readonly boardService = inject(BoardService);
  private readonly regenerationService = inject(ResourceRegenerationService);
  private readonly xelorPassivesService = inject(XelorPassivesService);
  private readonly xelorMovementService = inject(XelorMovementService);
  private readonly xelorDialService = inject(XelorDialService);

  /**
   * Traite les effets TELEPORT d'un sort (Pointe-heure, etc.)
   * - Téléporte la cible X cases plus loin (en fonction de la position du lanceur)
   * - Si la case est occupée -> échange de position
   * - Regagne 1 PA si un échange a lieu
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

      const playerEntity = this.boardService.player();
      const casterPosition = playerEntity?.position || context.playerPosition;
      if (!casterPosition) {
        console.warn(`[XELOR TELEPORT] ⚠️ No caster position found`);
        continue;
      }

      const targetPosition = action.targetPosition;
      if (!targetPosition) {
        console.warn(`[XELOR TELEPORT] ⚠️ No target position found`);
        continue;
      }

      const targetEntity = this.boardService.getEntityAtPosition(targetPosition);

      const targetMechanism = targetEntity ? null : this.boardService.getMechanismAtPosition(targetPosition);

      if (!targetEntity && !targetMechanism) {
        console.warn(`[XELOR TELEPORT] ⚠️ No entity or mechanism found at target position (${targetPosition.x}, ${targetPosition.y})`);
        continue;
      }

      if (targetEntity) {
        console.log(`[XELOR TELEPORT] 🎯 Target entity: ${targetEntity.name} at (${targetPosition.x}, ${targetPosition.y})`);
      } else if (targetMechanism) {
        console.log(`[XELOR TELEPORT] 🎯 Target mechanism: ${targetMechanism.type} (${targetMechanism.id}) at (${targetPosition.x}, ${targetPosition.y})`);
      }

      const dx = targetPosition.x - casterPosition.x;
      const dy = targetPosition.y - casterPosition.y;

      let dirX = 0, dirY = 0;
      if (Math.abs(dx) > Math.abs(dy)) {
        dirX = dx > 0 ? 1 : -1;
      } else if (Math.abs(dy) > Math.abs(dx)) {
        dirY = dy > 0 ? 1 : -1;
      } else {
        dirX = dx !== 0 ? (dx > 0 ? 1 : -1) : 0;
        dirY = dy !== 0 ? (dy > 0 ? 1 : -1) : 0;
      }

      const pushMultiplier = direction === 'BACK' ? 1 : -1;

      const destinationPosition: Position = {
        x: targetPosition.x + (dirX * cells * pushMultiplier),
        y: targetPosition.y + (dirY * cells * pushMultiplier)
      };

      console.log(`[XELOR TELEPORT] 📍 Destination calculated: (${destinationPosition.x}, ${destinationPosition.y})`);

      const state = this.boardService.state();
      if (destinationPosition.x < 0 || destinationPosition.x >= state.cols ||
        destinationPosition.y < 0 || destinationPosition.y >= state.rows) {
        console.warn(`[XELOR TELEPORT] ⚠️ Destination out of bounds: (${destinationPosition.x}, ${destinationPosition.y})`);
        continue;
      }

      const entityAtDestination = this.boardService.getEntityAtPosition(destinationPosition);

      const mechanismAtDestination = this.boardService.getMechanismAtPosition(destinationPosition);

      console.log(`[XELOR TELEPORT] 🔍 Checking destination (${destinationPosition.x}, ${destinationPosition.y}):`);
      console.log(`[XELOR TELEPORT]    - Entity: ${entityAtDestination?.name || 'none'}`);
      console.log(`[XELOR TELEPORT]    - Mechanism: ${mechanismAtDestination?.type || 'none'}`);

      // === CAS 1: La cible est une ENTITÉ ===
      if (targetEntity) {
        if (entityAtDestination) {
          console.log(`[XELOR TELEPORT] 🔄 Position occupied by entity ${entityAtDestination.name} - SWAP!`);

          const swapSuccess = this.boardService.swapEntityPositions(targetEntity.id, entityAtDestination.id);

          if (swapSuccess) {
            console.log(`[XELOR TELEPORT] ✅ Swap successful!`);

            this.regenerationService.regeneratePA(
              context,
              1,
              'POINTE_HEURE',
              'Pointe-heure: +1 PA (échange de position)',
              { spellId: spell.id, trigger: 'ON_SWAP' }
            );

            console.log(`[XELOR TELEPORT] 💰 +1 PA granted (swap bonus)`);

            this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'entity_entity_swap');

            this.xelorMovementService.updateEntityPositionInContext(context, targetEntity.id, destinationPosition);
            this.xelorMovementService.updateEntityPositionInContext(context, entityAtDestination.id, targetPosition);

            if (targetEntity.type === 'player') {
              context.playerPosition = destinationPosition;
              context.currentPosition = destinationPosition;
            }
            if (entityAtDestination.type === 'player') {
              context.playerPosition = targetPosition;
              context.currentPosition = targetPosition;
            }

            if (!actionResult.details) actionResult.details = {};
            actionResult.details.teleport = {
              type: 'swap',
              targetEntity: targetEntity.name,
              swappedWith: entityAtDestination.name,
              from: targetPosition,
              to: destinationPosition,
              paGained: 1
            };

            this.xelorMovementService.recordMovement(
              context,
              'swap',
              targetEntity.id,
              'entity',
              targetEntity.name,
              targetPosition,
              destinationPosition,
              spell.id,
              {
                id: entityAtDestination.id,
                type: 'entity',
                name: entityAtDestination.name,
                fromPosition: destinationPosition,
                toPosition: targetPosition
              }
            );
          }
        } else if (mechanismAtDestination) {
          console.log(`[XELOR TELEPORT] 🔄 Position occupied by mechanism ${mechanismAtDestination.type} (${mechanismAtDestination.id}) - SWAP!`);

          const swapSuccess = this.boardService.swapEntityWithMechanism(targetEntity.id, mechanismAtDestination.id);

          if (swapSuccess) {
            console.log(`[XELOR TELEPORT] ✅ Entity/Mechanism swap successful!`);

            if (mechanismAtDestination.type === 'dial') {
              this.xelorDialService.updateDialHoursAfterSwap(mechanismAtDestination.id);
            }

            this.regenerationService.regeneratePA(
              context,
              1,
              'POINTE_HEURE',
              'Pointe-heure: +1 PA (échange de position avec mécanisme)',
              { spellId: spell.id, trigger: 'ON_SWAP_MECHANISM' }
            );

            console.log(`[XELOR TELEPORT] 💰 +1 PA granted (swap with mechanism bonus)`);

            this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'entity_mechanism_swap');

            this.xelorMovementService.updateEntityPositionInContext(context, targetEntity.id, destinationPosition);

            if (targetEntity.type === 'player') {
              context.playerPosition = destinationPosition;
              context.currentPosition = destinationPosition;
            }

            if (!actionResult.details) actionResult.details = {};
            actionResult.details.teleport = {
              type: 'swap_mechanism',
              targetEntity: targetEntity.name,
              swappedWith: `${mechanismAtDestination.type} (${mechanismAtDestination.id})`,
              from: targetPosition,
              to: destinationPosition,
              paGained: 1
            };

            this.xelorMovementService.recordMovement(
              context,
              'swap_mechanism',
              targetEntity.id,
              'entity',
              targetEntity.name,
              targetPosition,
              destinationPosition,
              spell.id,
              {
                id: mechanismAtDestination.id,
                type: 'mechanism',
                name: mechanismAtDestination.type,
                fromPosition: destinationPosition,
                toPosition: targetPosition
              }
            );
          }
        } else {
          console.log(`[XELOR TELEPORT] 🌀 Simple teleport to (${destinationPosition.x}, ${destinationPosition.y})`);

          this.boardService.updateEntityPosition(targetEntity.id, destinationPosition);

          this.xelorMovementService.updateEntityPositionInContext(context, targetEntity.id, destinationPosition);

          if (targetEntity.type === 'player') {
            context.playerPosition = destinationPosition;
            context.currentPosition = destinationPosition;
          }

          if (!actionResult.details) actionResult.details = {};
          actionResult.details.teleport = {
            type: 'simple',
            targetEntity: targetEntity.name,
            from: targetPosition,
            to: destinationPosition
          };

          this.xelorMovementService.recordMovement(
            context,
            'teleport',
            targetEntity.id,
            'entity',
            targetEntity.name,
            targetPosition,
            destinationPosition,
            spell.id
          );

          console.log(`[XELOR TELEPORT] ✅ Teleport successful!`);
        }
      }

      // === CAS 2: La cible est un MÉCANISME ===
      else if (targetMechanism) {
        if (entityAtDestination) {
          console.log(`[XELOR TELEPORT] 🔄 Mechanism target, destination occupied by entity ${entityAtDestination.name} - SWAP!`);

          const swapSuccess = this.boardService.swapEntityWithMechanism(entityAtDestination.id, targetMechanism.id);

          if (swapSuccess) {
            console.log(`[XELOR TELEPORT] ✅ Mechanism/Entity swap successful!`);

            if (targetMechanism.type === 'dial') {
              this.xelorDialService.updateDialHoursAfterSwap(targetMechanism.id);
            }

            this.regenerationService.regeneratePA(
              context,
              1,
              'POINTE_HEURE',
              'Pointe-heure: +1 PA (échange mécanisme avec entité)',
              { spellId: spell.id, trigger: 'ON_SWAP_MECHANISM' }
            );

            console.log(`[XELOR TELEPORT] 💰 +1 PA granted (mechanism swap bonus)`);

            this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'mechanism_entity_swap');

            this.xelorMovementService.updateEntityPositionInContext(context, entityAtDestination.id, targetPosition);

            if (entityAtDestination.type === 'player') {
              context.playerPosition = targetPosition;
              context.currentPosition = targetPosition;
            }

            if (!actionResult.details) actionResult.details = {};
            actionResult.details.teleport = {
              type: 'swap_mechanism',
              targetMechanism: `${targetMechanism.type} (${targetMechanism.id})`,
              swappedWith: entityAtDestination.name,
              from: targetPosition,
              to: destinationPosition,
              paGained: 1
            };

            this.xelorMovementService.recordMovement(
              context,
              'swap_mechanism',
              targetMechanism.id,
              'mechanism',
              targetMechanism.type,
              targetPosition,
              destinationPosition,
              spell.id,
              {
                id: entityAtDestination.id,
                type: 'entity',
                name: entityAtDestination.name,
                fromPosition: destinationPosition,
                toPosition: targetPosition
              }
            );
          }
        } else if (mechanismAtDestination) {
          console.log(`[XELOR TELEPORT] 🔄 Mechanism target, destination occupied by mechanism ${mechanismAtDestination.type} - SWAP!`);

          const swapSuccess = this.boardService.swapMechanismPositions(targetMechanism.id, mechanismAtDestination.id);

          if (swapSuccess) {
            console.log(`[XELOR TELEPORT] ✅ Mechanism/Mechanism swap successful!`);

            if (targetMechanism.type === 'dial') {
              this.xelorDialService.updateDialHoursAfterSwap(targetMechanism.id);
            }
            if (mechanismAtDestination.type === 'dial') {
              this.xelorDialService.updateDialHoursAfterSwap(mechanismAtDestination.id);
            }

            this.regenerationService.regeneratePA(
              context,
              1,
              'POINTE_HEURE',
              'Pointe-heure: +1 PA (échange de mécanismes)',
              { spellId: spell.id, trigger: 'ON_SWAP_MECHANISM' }
            );

            console.log(`[XELOR TELEPORT] 💰 +1 PA granted (mechanism swap bonus)`);

            this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'mechanism_mechanism_swap');

            if (!actionResult.details) actionResult.details = {};
            actionResult.details.teleport = {
              type: 'swap_mechanisms',
              targetMechanism: `${targetMechanism.type} (${targetMechanism.id})`,
              swappedWith: `${mechanismAtDestination.type} (${mechanismAtDestination.id})`,
              from: targetPosition,
              to: destinationPosition,
              paGained: 1
            };

            this.xelorMovementService.recordMovement(
              context,
              'swap',
              targetMechanism.id,
              'mechanism',
              targetMechanism.type,
              targetPosition,
              destinationPosition,
              spell.id,
              {
                id: mechanismAtDestination.id,
                type: 'mechanism',
                name: mechanismAtDestination.type,
                fromPosition: destinationPosition,
                toPosition: targetPosition
              }
            );
          }
        } else {
          console.log(`[XELOR TELEPORT] 🌀 Simple mechanism teleport to (${destinationPosition.x}, ${destinationPosition.y})`);

          this.boardService.updateMechanismPosition(targetMechanism.id, destinationPosition);

          if (targetMechanism.type === 'dial') {
            this.xelorDialService.updateDialHoursAfterSwap(targetMechanism.id);
          }

          if (!actionResult.details) actionResult.details = {};
          actionResult.details.teleport = {
            type: 'simple_mechanism',
            targetMechanism: `${targetMechanism.type} (${targetMechanism.id})`,
            from: targetPosition,
            to: destinationPosition
          };

          this.xelorMovementService.recordMovement(
            context,
            'teleport',
            targetMechanism.id,
            'mechanism',
            targetMechanism.type,
            targetPosition,
            destinationPosition,
            spell.id
          );

          console.log(`[XELOR TELEPORT] ✅ Mechanism teleport successful!`);
        }
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
    const targetEntity = this.boardService.getEntityAtPosition(targetPosition);
    const targetMechanism = this.boardService.getMechanismAtPosition(targetPosition);

    const currentHour = getXelorState(context, true).currentDialHour ?? this.boardService.currentDialHour();
    const reverseOnOddHour = params?.reverseOnOddHour === true;
    const shouldReverse = reverseOnOddHour && typeof currentHour === 'number' && currentHour % 2 === 1;

    const movingUnit = shouldReverse
      ? (targetEntity ? { kind: 'entity' as const, value: targetEntity } : targetMechanism ? { kind: 'mechanism' as const, value: targetMechanism } : null)
      : { kind: 'entity' as const, value: casterEntity };

    if (!movingUnit) {
      console.warn('[XELOR TELEPORT] ⚠️ TELEPORT_SYMMETRIC (single) skipped: no valid entity to move');
      return;
    }

    const movingFrom: Position = { ...movingUnit.value.position };
    const anchor = shouldReverse ? casterPosition : targetPosition;
    const mirroredSource = shouldReverse ? targetPosition : casterPosition;
    const destination: Position = {
      x: anchor.x * 2 - mirroredSource.x,
      y: anchor.y * 2 - mirroredSource.y
    };

    const state = this.boardService.state();
    if (
      destination.x < 0 || destination.x >= state.cols ||
      destination.y < 0 || destination.y >= state.rows
    ) {
      console.warn(`[XELOR TELEPORT] ⚠️ TELEPORT_SYMMETRIC (single) destination out of bounds: (${destination.x}, ${destination.y})`);
      return;
    }

    const occupantEntity = this.boardService.getEntityAtPosition(destination);
    const occupantMechanism = this.boardService.getMechanismAtPosition(destination);

    if (movingUnit.kind === 'entity') {
      const movingEntity = movingUnit.value;

      if (occupantEntity && occupantEntity.id !== movingEntity.id) {
        const swapSuccess = this.boardService.swapEntityPositions(movingEntity.id, occupantEntity.id);
        if (!swapSuccess) return;

        this.xelorMovementService.updateEntityPositionInContext(context, movingEntity.id, destination);
        this.xelorMovementService.updateEntityPositionInContext(context, occupantEntity.id, movingFrom);

        if (movingEntity.type === 'player') {
          context.playerPosition = destination;
          context.currentPosition = destination;
        }
        if (occupantEntity.type === 'player') {
          context.playerPosition = movingFrom;
          context.currentPosition = movingFrom;
        }

        this.xelorMovementService.recordMovement(
          context,
          'swap',
          movingEntity.id,
          'entity',
          movingEntity.name,
          movingFrom,
          destination,
          action.spellId,
          {
            id: occupantEntity.id,
            type: 'entity',
            name: occupantEntity.name,
            fromPosition: destination,
            toPosition: movingFrom
          }
        );

        this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'symetrie_single_entity_swap');

        if (!actionResult.details) actionResult.details = {};
        actionResult.details.teleport = {
          type: 'symmetric_single_swap',
          movedEntityId: movingEntity.id,
          from: movingFrom,
          to: destination,
          swappedWith: occupantEntity.id,
          mirroredAround: shouldReverse ? 'CASTER' : 'TARGET',
          currentHour
        };
        return;
      }

      if (occupantMechanism) {
        const swapSuccess = this.boardService.swapEntityWithMechanism(movingEntity.id, occupantMechanism.id);
        if (!swapSuccess) return;

        this.xelorMovementService.updateEntityPositionInContext(context, movingEntity.id, destination);
        if (movingEntity.type === 'player') {
          context.playerPosition = destination;
          context.currentPosition = destination;
        }

        if (occupantMechanism.type === 'dial') {
          this.xelorDialService.updateDialHoursAfterSwap(occupantMechanism.id);
        }

        this.xelorMovementService.recordMovement(
          context,
          'swap_mechanism',
          movingEntity.id,
          'entity',
          movingEntity.name,
          movingFrom,
          destination,
          action.spellId,
          {
            id: occupantMechanism.id,
            type: 'mechanism',
            name: occupantMechanism.type,
            fromPosition: destination,
            toPosition: movingFrom
          }
        );

        this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'symetrie_single_entity_mechanism_swap');

        if (!actionResult.details) actionResult.details = {};
        actionResult.details.teleport = {
          type: 'symmetric_single_swap_mechanism',
          movedEntityId: movingEntity.id,
          from: movingFrom,
          to: destination,
          swappedWith: occupantMechanism.id,
          mirroredAround: shouldReverse ? 'CASTER' : 'TARGET',
          currentHour
        };
        return;
      }

      this.boardService.updateEntityPosition(movingEntity.id, destination);
      this.xelorMovementService.updateEntityPositionInContext(context, movingEntity.id, destination);

      this.xelorMovementService.recordMovement(
        context,
        'teleport',
        movingEntity.id,
        'entity',
        movingEntity.name,
        movingFrom,
        destination,
        action.spellId
      );

      if (movingEntity.type === 'player') {
        context.playerPosition = destination;
        context.currentPosition = destination;
      }
    } else {
      const movingMechanism = movingUnit.value;

      if (occupantEntity) {
        const swapSuccess = this.boardService.swapEntityWithMechanism(occupantEntity.id, movingMechanism.id);
        if (!swapSuccess) return;

        this.xelorMovementService.updateEntityPositionInContext(context, occupantEntity.id, movingFrom);
        if (occupantEntity.type === 'player') {
          context.playerPosition = movingFrom;
          context.currentPosition = movingFrom;
        }

        if (movingMechanism.type === 'dial') {
          this.xelorDialService.updateDialHoursAfterSwap(movingMechanism.id);
        }

        this.xelorMovementService.recordMovement(
          context,
          'swap_mechanism',
          occupantEntity.id,
          'entity',
          occupantEntity.name,
          destination,
          movingFrom,
          action.spellId,
          {
            id: movingMechanism.id,
            type: 'mechanism',
            name: movingMechanism.type,
            fromPosition: movingFrom,
            toPosition: destination
          }
        );

        this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'symetrie_single_mechanism_entity_swap');

        if (!actionResult.details) actionResult.details = {};
        actionResult.details.teleport = {
          type: 'symmetric_single_swap_with_entity',
          movedMechanismId: movingMechanism.id,
          from: movingFrom,
          to: destination,
          swappedWith: occupantEntity.id,
          mirroredAround: 'CASTER',
          currentHour
        };
        return;
      }

      if (occupantMechanism && occupantMechanism.id !== movingMechanism.id) {
        const swapSuccess = this.boardService.swapMechanismPositions(movingMechanism.id, occupantMechanism.id);
        if (!swapSuccess) return;

        if (movingMechanism.type === 'dial') {
          this.xelorDialService.updateDialHoursAfterSwap(movingMechanism.id);
        }
        if (occupantMechanism.type === 'dial') {
          this.xelorDialService.updateDialHoursAfterSwap(occupantMechanism.id);
        }

        this.xelorMovementService.recordMovement(
          context,
          'swap',
          movingMechanism.id,
          'mechanism',
          movingMechanism.type,
          movingFrom,
          destination,
          action.spellId,
          {
            id: occupantMechanism.id,
            type: 'mechanism',
            name: occupantMechanism.type,
            fromPosition: destination,
            toPosition: movingFrom
          }
        );

        this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'symetrie_single_mechanism_swap');

        if (!actionResult.details) actionResult.details = {};
        actionResult.details.teleport = {
          type: 'symmetric_single_swap_mechanism_mechanism',
          movedMechanismId: movingMechanism.id,
          from: movingFrom,
          to: destination,
          swappedWith: occupantMechanism.id,
          mirroredAround: 'CASTER',
          currentHour
        };
        return;
      }

      this.boardService.updateMechanismPosition(movingMechanism.id, destination);
      if (movingMechanism.type === 'dial') {
        this.xelorDialService.updateDialHoursAfterSwap(movingMechanism.id);
      }

      this.xelorMovementService.recordMovement(
        context,
        'teleport',
        movingMechanism.id,
        'mechanism',
        movingMechanism.type,
        movingFrom,
        destination,
        action.spellId
      );
    }

    if (!actionResult.details) actionResult.details = {};
    actionResult.details.teleport = {
      type: 'symmetric_single',
      movedEntityId: movingUnit.kind === 'entity' ? movingUnit.value.id : undefined,
      movedMechanismId: movingUnit.kind === 'mechanism' ? movingUnit.value.id : undefined,
      from: movingFrom,
      to: destination,
      mirroredAround: shouldReverse ? 'CASTER' : 'TARGET',
      currentHour
    };
  }
}
