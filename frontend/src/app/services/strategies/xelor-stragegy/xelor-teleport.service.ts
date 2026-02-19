import {inject, Injectable} from '@angular/core';
import {Spell} from '../../../models/spell.model';
import {Position, TimelineAction} from '../../../models/timeline.model';
import {SimulationContext, SimulationActionResult} from '../../calculators/simulation-engine.service';
import {BoardService} from '../../board.service';
import {ResourceRegenerationService} from '../../processors/resource-regeneration.service';
import {XelorPassivesService} from './xelor-passives.service';
import {XelorMovementService} from './xelor-movement.service';
import {XelorDialService} from './xelor-dial.service';

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
    // Récupérer la variante appropriée
    const variant = spell.variants.find(v => v.kind === 'NORMAL');
    if (!variant) return;

    // Chercher les effets TELEPORT
    const teleportEffects = variant.effects.filter(e => e.effect === 'TELEPORT');
    if (teleportEffects.length === 0) return;

    for (const effect of teleportEffects) {
      // Extraire les paramètres du teleport
      const cells = effect.extendedData?.cells || 2;
      const direction = effect.extendedData?.direction || 'BACK';

      console.log(`[XELOR TELEPORT] 🌀 Processing TELEPORT effect: ${cells} cells, direction: ${direction}`);

      // Position du lanceur (joueur)
      const playerEntity = this.boardService.player();
      const casterPosition = playerEntity?.position || context.playerPosition;
      if (!casterPosition) {
        console.warn(`[XELOR TELEPORT] ⚠️ No caster position found`);
        continue;
      }

      // Position de la cible
      const targetPosition = action.targetPosition;
      if (!targetPosition) {
        console.warn(`[XELOR TELEPORT] ⚠️ No target position found`);
        continue;
      }

      // Trouver l'entité cible à la position
      const targetEntity = this.boardService.getEntityAtPosition(targetPosition);

      // Si pas d'entité, vérifier s'il y a un mécanisme à la position cible
      const targetMechanism = !targetEntity ? this.boardService.getMechanismAtPosition(targetPosition) : null;

      if (!targetEntity && !targetMechanism) {
        console.warn(`[XELOR TELEPORT] ⚠️ No entity or mechanism found at target position (${targetPosition.x}, ${targetPosition.y})`);
        continue;
      }

      if (targetEntity) {
        console.log(`[XELOR TELEPORT] 🎯 Target entity: ${targetEntity.name} at (${targetPosition.x}, ${targetPosition.y})`);
      } else if (targetMechanism) {
        console.log(`[XELOR TELEPORT] 🎯 Target mechanism: ${targetMechanism.type} (${targetMechanism.id}) at (${targetPosition.x}, ${targetPosition.y})`);
      }

      // Calculer la direction de téléportation (du lanceur vers la cible)
      const dx = targetPosition.x - casterPosition.x;
      const dy = targetPosition.y - casterPosition.y;

      // Normaliser la direction
      let dirX = 0, dirY = 0;
      if (Math.abs(dx) > Math.abs(dy)) {
        dirX = dx > 0 ? 1 : -1;
      } else if (Math.abs(dy) > Math.abs(dx)) {
        dirY = dy > 0 ? 1 : -1;
      } else {
        // Diagonale : on priorise X par convention
        dirX = dx !== 0 ? (dx > 0 ? 1 : -1) : 0;
        dirY = dy !== 0 ? (dy > 0 ? 1 : -1) : 0;
      }

      // Direction BACK signifie "pousser la cible loin du lanceur"
      // Direction FRONT signifie "tirer la cible vers le lanceur"
      const pushMultiplier = direction === 'BACK' ? 1 : -1;

      // Calculer la position de destination
      const destinationPosition: Position = {
        x: targetPosition.x + (dirX * cells * pushMultiplier),
        y: targetPosition.y + (dirY * cells * pushMultiplier)
      };

      console.log(`[XELOR TELEPORT] 📍 Destination calculated: (${destinationPosition.x}, ${destinationPosition.y})`);

      // Vérifier les limites du plateau
      const state = this.boardService.state();
      if (destinationPosition.x < 0 || destinationPosition.x >= state.cols ||
        destinationPosition.y < 0 || destinationPosition.y >= state.rows) {
        console.warn(`[XELOR TELEPORT] ⚠️ Destination out of bounds: (${destinationPosition.x}, ${destinationPosition.y})`);
        continue;
      }

      // Vérifier si la position de destination est occupée par une ENTITÉ
      const entityAtDestination = this.boardService.getEntityAtPosition(destinationPosition);

      // Vérifier si la position de destination est occupée par un MÉCANISME
      const mechanismAtDestination = this.boardService.getMechanismAtPosition(destinationPosition);

      console.log(`[XELOR TELEPORT] 🔍 Checking destination (${destinationPosition.x}, ${destinationPosition.y}):`);
      console.log(`[XELOR TELEPORT]    - Entity: ${entityAtDestination?.name || 'none'}`);
      console.log(`[XELOR TELEPORT]    - Mechanism: ${mechanismAtDestination?.type || 'none'}`);

      // === CAS 1: La cible est une ENTITÉ ===
      if (targetEntity) {
        if (entityAtDestination) {
          // Échange de position avec une autre entité !
          console.log(`[XELOR TELEPORT] 🔄 Position occupied by entity ${entityAtDestination.name} - SWAP!`);

          const swapSuccess = this.boardService.swapEntityPositions(targetEntity.id, entityAtDestination.id);

          if (swapSuccess) {
            console.log(`[XELOR TELEPORT] ✅ Swap successful!`);

            // Regain de 1 PA pour le lanceur
            this.regenerationService.regeneratePA(
              context,
              1,
              'POINTE_HEURE',
              'Pointe-heure: +1 PA (échange de position)',
              { spellId: spell.id, trigger: 'ON_SWAP' }
            );

            console.log(`[XELOR TELEPORT] 💰 +1 PA granted (swap bonus)`);

            // 🆕 Passif "Cours du temps" : +1 PA si Distorsion actif, sinon +1 PW
            this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'entity_entity_swap');

            // Mettre à jour le contexte avec les nouvelles positions
            this.xelorMovementService.updateEntityPositionInContext(context, targetEntity.id, destinationPosition);
            this.xelorMovementService.updateEntityPositionInContext(context, entityAtDestination.id, targetPosition);

            // Mettre à jour playerPosition/currentPosition si nécessaire
            if (targetEntity.type === 'player') {
              context.playerPosition = destinationPosition;
              context.currentPosition = destinationPosition;
            }
            if (entityAtDestination.type === 'player') {
              context.playerPosition = targetPosition;
              context.currentPosition = targetPosition;
            }

            // Ajouter les détails de l'échange au résultat
            if (!actionResult.details) actionResult.details = {};
            actionResult.details.teleport = {
              type: 'swap',
              targetEntity: targetEntity.name,
              swappedWith: entityAtDestination.name,
              from: targetPosition,
              to: destinationPosition,
              paGained: 1
            };

            // 🆕 Enregistrer le mouvement pour "Retour Spontané"
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
          // Échange de position avec un mécanisme !
          console.log(`[XELOR TELEPORT] 🔄 Position occupied by mechanism ${mechanismAtDestination.type} (${mechanismAtDestination.id}) - SWAP!`);

          const swapSuccess = this.boardService.swapEntityWithMechanism(targetEntity.id, mechanismAtDestination.id);

          if (swapSuccess) {
            console.log(`[XELOR TELEPORT] ✅ Entity/Mechanism swap successful!`);

            // 🆕 Si le mécanisme est un cadran, mettre à jour les heures
            if (mechanismAtDestination.type === 'dial') {
              this.xelorDialService.updateDialHoursAfterSwap(mechanismAtDestination.id, context);
            }

            // Regain de 1 PA pour le lanceur
            this.regenerationService.regeneratePA(
              context,
              1,
              'POINTE_HEURE',
              'Pointe-heure: +1 PA (échange de position avec mécanisme)',
              { spellId: spell.id, trigger: 'ON_SWAP_MECHANISM' }
            );

            console.log(`[XELOR TELEPORT] 💰 +1 PA granted (swap with mechanism bonus)`);

            // 🆕 Passif "Cours du temps" : +1 PA si Distorsion actif, sinon +1 PW
            this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'entity_mechanism_swap');

            // Mettre à jour le contexte avec la nouvelle position de l'entité
            this.xelorMovementService.updateEntityPositionInContext(context, targetEntity.id, destinationPosition);

            // Mettre à jour playerPosition/currentPosition si c'est le joueur qui est échangé
            if (targetEntity.type === 'player') {
              context.playerPosition = destinationPosition;
              context.currentPosition = destinationPosition;
            }

            // Ajouter les détails de l'échange au résultat
            if (!actionResult.details) actionResult.details = {};
            actionResult.details.teleport = {
              type: 'swap_mechanism',
              targetEntity: targetEntity.name,
              swappedWith: `${mechanismAtDestination.type} (${mechanismAtDestination.id})`,
              from: targetPosition,
              to: destinationPosition,
              paGained: 1
            };

            // 🆕 Enregistrer le mouvement pour "Retour Spontané"
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
          // Téléportation simple
          console.log(`[XELOR TELEPORT] 🌀 Simple teleport to (${destinationPosition.x}, ${destinationPosition.y})`);

          this.boardService.updateEntityPosition(targetEntity.id, destinationPosition);

          // Mettre à jour le contexte avec la nouvelle position de l'entité
          this.xelorMovementService.updateEntityPositionInContext(context, targetEntity.id, destinationPosition);

          // Mettre à jour playerPosition/currentPosition si c'est le joueur qui est téléporté
          if (targetEntity.type === 'player') {
            context.playerPosition = destinationPosition;
            context.currentPosition = destinationPosition;
          }

          // Ajouter les détails au résultat
          if (!actionResult.details) actionResult.details = {};
          actionResult.details.teleport = {
            type: 'simple',
            targetEntity: targetEntity.name,
            from: targetPosition,
            to: destinationPosition
          };

          // 🆕 Enregistrer le mouvement pour "Retour Spontané"
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
          // Échange mécanisme <-> entité
          console.log(`[XELOR TELEPORT] 🔄 Mechanism target, destination occupied by entity ${entityAtDestination.name} - SWAP!`);

          const swapSuccess = this.boardService.swapEntityWithMechanism(entityAtDestination.id, targetMechanism.id);

          if (swapSuccess) {
            console.log(`[XELOR TELEPORT] ✅ Mechanism/Entity swap successful!`);

            // 🆕 Si le mécanisme est un cadran, mettre à jour les heures
            if (targetMechanism.type === 'dial') {
              this.xelorDialService.updateDialHoursAfterSwap(targetMechanism.id, context);
            }

            // Regain de 1 PA pour le lanceur
            this.regenerationService.regeneratePA(
              context,
              1,
              'POINTE_HEURE',
              'Pointe-heure: +1 PA (échange mécanisme avec entité)',
              { spellId: spell.id, trigger: 'ON_SWAP_MECHANISM' }
            );

            console.log(`[XELOR TELEPORT] 💰 +1 PA granted (mechanism swap bonus)`);

            // 🆕 Passif "Cours du temps" : +1 PA si Distorsion actif, sinon +1 PW
            this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'mechanism_entity_swap');

            // Mettre à jour le contexte avec la nouvelle position de l'entité
            this.xelorMovementService.updateEntityPositionInContext(context, entityAtDestination.id, targetPosition);

            // Mettre à jour playerPosition/currentPosition si c'est le joueur qui est échangé
            if (entityAtDestination.type === 'player') {
              context.playerPosition = targetPosition;
              context.currentPosition = targetPosition;
            }

            // Ajouter les détails de l'échange au résultat
            if (!actionResult.details) actionResult.details = {};
            actionResult.details.teleport = {
              type: 'swap_mechanism',
              targetMechanism: `${targetMechanism.type} (${targetMechanism.id})`,
              swappedWith: entityAtDestination.name,
              from: targetPosition,
              to: destinationPosition,
              paGained: 1
            };

            // 🆕 Enregistrer le mouvement pour "Retour Spontané"
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
          // Échange mécanisme <-> mécanisme
          console.log(`[XELOR TELEPORT] 🔄 Mechanism target, destination occupied by mechanism ${mechanismAtDestination.type} - SWAP!`);

          const swapSuccess = this.boardService.swapMechanismPositions(targetMechanism.id, mechanismAtDestination.id);

          if (swapSuccess) {
            console.log(`[XELOR TELEPORT] ✅ Mechanism/Mechanism swap successful!`);

            // 🆕 Si l'un des mécanismes est un cadran, mettre à jour les heures
            if (targetMechanism.type === 'dial') {
              this.xelorDialService.updateDialHoursAfterSwap(targetMechanism.id, context);
            }
            if (mechanismAtDestination.type === 'dial') {
              this.xelorDialService.updateDialHoursAfterSwap(mechanismAtDestination.id, context);
            }

            // Regain de 1 PA pour le lanceur
            this.regenerationService.regeneratePA(
              context,
              1,
              'POINTE_HEURE',
              'Pointe-heure: +1 PA (échange de mécanismes)',
              { spellId: spell.id, trigger: 'ON_SWAP_MECHANISM' }
            );

            console.log(`[XELOR TELEPORT] 💰 +1 PA granted (mechanism swap bonus)`);

            // 🆕 Passif "Cours du temps" : +1 PA si Distorsion actif, sinon +1 PW
            this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'mechanism_mechanism_swap');

            // Ajouter les détails de l'échange au résultat
            if (!actionResult.details) actionResult.details = {};
            actionResult.details.teleport = {
              type: 'swap_mechanisms',
              targetMechanism: `${targetMechanism.type} (${targetMechanism.id})`,
              swappedWith: `${mechanismAtDestination.type} (${mechanismAtDestination.id})`,
              from: targetPosition,
              to: destinationPosition,
              paGained: 1
            };

            // 🆕 Enregistrer le mouvement pour "Retour Spontané"
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
          // Téléportation simple du mécanisme
          console.log(`[XELOR TELEPORT] 🌀 Simple mechanism teleport to (${destinationPosition.x}, ${destinationPosition.y})`);

          this.boardService.updateMechanismPosition(targetMechanism.id, destinationPosition);

          // 🆕 Si le mécanisme est un cadran, mettre à jour les heures après la téléportation
          if (targetMechanism.type === 'dial') {
            this.xelorDialService.updateDialHoursAfterSwap(targetMechanism.id, context);
          }

          // Ajouter les détails au résultat
          if (!actionResult.details) actionResult.details = {};
          actionResult.details.teleport = {
            type: 'simple_mechanism',
            targetMechanism: `${targetMechanism.type} (${targetMechanism.id})`,
            from: targetPosition,
            to: destinationPosition
          };

          // 🆕 Enregistrer le mouvement pour "Retour Spontané"
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
}
