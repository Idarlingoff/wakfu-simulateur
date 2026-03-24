import {inject, Injectable, Injector} from '@angular/core';
import {SimulationContext, SimulationActionResult} from '../../calculators/simulation-engine.service';
import {BoardService} from '../../board.service';
import {ResourceRegenerationService} from '../../processors/resource-regeneration.service';
import {Spell} from '../../../models/spell.model';
import {TimelineAction} from '../../../models/timeline.model';
import {XelorDialService} from './xelor-dial.service';
import {Mechanism} from '../../../models/board.model';
import {XelorCastValidatorService} from './xelor-cast-validator.service';
import {getMechanismImagePath, getSpellMechanismType} from '../../../utils/mechanism-utils';
import {XelorExecuteEffectService} from './xelor-execute-effect.service';
import {XelorPassivesService} from './xelor-passives.service';
import { getXelorState } from './xelor-state.utils';

@Injectable({ providedIn: 'root' })

export class XelorMechanismsService {

  private readonly boardService = inject(BoardService);
  private readonly regenerationService = inject(ResourceRegenerationService);
  private readonly xelorCastValidator = inject(XelorCastValidatorService);
  private readonly xelorExecuteEffectService = inject(XelorExecuteEffectService);
  private readonly xelorPassiveService = inject(XelorPassivesService);
  private readonly injector = inject(Injector);

  private get dial(): XelorDialService {
    return this.injector.get(XelorDialService);
  }

  private static readonly ROUAGE_STATUS_EFFECT_CONFIG = {
    area: 'CROSS2',
    perChargeAmount: 20,
    maxCharges: 10,
    element: 'Light'
  } as const

  /**
   * Exécute un sort de mécanisme Xelor (Rouage, Cadran, Sinistro, Régulateur)
   * ou un sort spécial comme "Retour Spontané"
   */
  public executeClassMechanismSpell(
    action: TimelineAction,
    context: SimulationContext,
    spell: Spell,
    paCost: number,
    pwCost: number
  ): SimulationActionResult {
    console.log(`[XELOR MECHANISM] executeMechanismSpell for: ${spell.id} (${spell.name})`);

    if (this.xelorCastValidator.isRetourSpontaneSpell(spell.id)) {
      console.log(`[XELOR] Executing Retour Spontané spell`);
      return this.xelorExecuteEffectService.executeRetourSpontane(spell, action, context);
    }

    const mechanismType = getSpellMechanismType(spell.id);

    if (!mechanismType) {
      console.error(`[XELOR] Mechanism type not found for spell: ${spell.id}`);
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: spell.id,
        spellName: spell.name,
        paCost,
        pwCost,
        mpCost: 0,
        message: `Mechanism type not found for ${spell.name}`
      };
    }

    const imageUrl = getMechanismImagePath(mechanismType, 0);

    console.log(`[XELOR] Mechanism type found:`, {
      type: mechanismType,
      imageUrl: imageUrl
    });

    if (!action.targetPosition) {
      console.error(`[XELOR] No target position for spell ${spell.name}`);
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: spell.id,
        spellName: spell.name,
        paCost,
        pwCost,
        mpCost: 0,
        message: `No target position for mechanism ${spell.name}`
      };
    }

    console.log(`[XELOR] Target position: (${action.targetPosition.x}, ${action.targetPosition.y})`);

    this.handleExistingMechanisms(mechanismType, context);

    const sharedCharges = this.getInitialChargesForMechanismType(mechanismType, context);

    const mechanism: Mechanism = {
      id: `${mechanismType}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: mechanismType,
      position: action.targetPosition,
      charges: sharedCharges,
      spellId: spell.id
    };

    console.log(`[XELOR] Mechanism object created:`, mechanism);

    this.boardService.addMechanism(mechanism);
    getXelorState(context, true).mechanismCharges?.set(mechanism.id, sharedCharges);

    if (!getXelorState(context, true).mechanismsPlacedThisTurn) {
      getXelorState(context, true).mechanismsPlacedThisTurn = new Map<string, number>();
    }
    const currentCount = getXelorState(context, true).mechanismsPlacedThisTurn.get(mechanismType) || 0;
    getXelorState(context, true).mechanismsPlacedThisTurn.set(mechanismType, currentCount + 1);
    console.log(`[XELOR] 📊 ${mechanismType} posé ce tour: ${currentCount + 1}`);

    console.log(`[XELOR] Mechanism ${spell.name} placed at (${action.targetPosition.x}, ${action.targetPosition.y})`);

    if (mechanismType !== 'dial') {
      this.xelorPassiveService.applyMecanismeSpecialiseSwap(
        mechanismType,
        mechanism.id,
        action.targetPosition,
        context,
        spell.id
      );
    }

    if (mechanismType === 'dial') {
      const playerEntity = this.boardService.player();
      const originalPlayerPosition = playerEntity?.position
        ? { x: playerEntity.position.x, y: playerEntity.position.y }
        : context.playerPosition
          ? { x: context.playerPosition.x, y: context.playerPosition.y }
          : { x: 6, y: 6 };

      console.log(`[XELOR DIAL] 📍 Original player position (for dial orientation): (${originalPlayerPosition.x}, ${originalPlayerPosition.y})`);
      console.log(`[XELOR DIAL] 📍 Dial target position: (${action.targetPosition.x}, ${action.targetPosition.y})`);

      this.dial.createDialHours(mechanism.id, action.targetPosition, originalPlayerPosition);

      this.boardService.setCurrentDialHour(12, mechanism.id);

      const teleported = this.boardService.teleportPlayerToDialHour(6, mechanism.id);
      if (teleported) {
        console.log(`[XELOR] 🌀 Player automatically teleported to hour 6`);

        const hour6Position = this.boardService.getDialHourPosition(6, mechanism.id);
        if (hour6Position) {
          context.playerPosition = hour6Position;
          context.currentPosition = hour6Position;

          if (context.entities) {
            const playerEntityInContext = context.entities.find(e => e.type === 'player');
            if (playerEntityInContext) {
              playerEntityInContext.position = hour6Position;
              console.log(`[XELOR] 📍 Player entity in context.entities also updated to (${hour6Position.x}, ${hour6Position.y})`);
            }
          }

          console.log(`[XELOR] 📍 Context updated with new player position: (${hour6Position.x}, ${hour6Position.y})`);
        }
      }

      getXelorState(context, true).currentDialHour = 12;
      getXelorState(context, true).dialId = mechanism.id;
      getXelorState(context, true).dialFirstLoopCompleted = false;

      const swapApplied = this.xelorPassiveService.applyMecanismeSpecialiseSwapForDial(
        mechanism.id,
        context,
        spell.id
      );

      if (swapApplied) {
        const updatedMechanism = this.boardService.getMechanism(mechanism.id);

        if (updatedMechanism) {
          console.log(`[XELOR] 🔄 Swap applied - translating dial hours to new dial position: (${updatedMechanism.position.x}, ${updatedMechanism.position.y})`);

          this.dial.updateDialHoursAfterSwap(mechanism.id);

          console.log(`[XELOR] ✅ Dial hours translated to new position (orientation preserved)`);
        }
      }
    }

    return {
      success: true,
      actionId: action.id || '',
      actionType: 'CastSpell',
      spellId: spell.id,
      spellName: spell.name,
      paCost,
      pwCost,
      mpCost: 0,
      message: `Placed ${spell.name} at (${action.targetPosition.x}, ${action.targetPosition.y})`,
      details: {
        mechanismType: mechanismType,
        mechanismId: mechanism.id
      }
    };
  }

  private getInitialChargesForMechanismType(
    mechanismType: 'cog' | 'sinistro' | 'dial' | 'regulateur',
    context: SimulationContext
  ): number {
    if (mechanismType !== 'cog' && mechanismType !== 'sinistro') {
      return 0;
    }

    return getXelorState(context, true).sharedMechanismCharges?.get(mechanismType) || 0;
  }

  /**
   * Applique les dégâts du Rouage (fin de tour)
   */
  public applyRouageDamage(context: SimulationContext): void {
    const rouages = this.boardService.getMechanismsByType('cog');

    rouages.forEach(rouage => {
      const charges = getXelorState(context, true).mechanismCharges?.get(rouage.id) || 0;
      if (charges <= 0) {
        console.log(`[XELOR] ⚙️ Rouage (${rouage.id}) has 0 charge - no explosion`);
        return;
      }

      const effectiveCharges = Math.min(charges, XelorMechanismsService.ROUAGE_STATUS_EFFECT_CONFIG.maxCharges);
      const damage = effectiveCharges * XelorMechanismsService.ROUAGE_STATUS_EFFECT_CONFIG.perChargeAmount;

      const enemiesInArea = this.boardService.enemies().filter(enemy =>
        this.isPositionInRouageExplosionArea(enemy.position, rouage.position)
      );

      if (damage > 0) {
        console.log(
          `[XELOR] 💥 Rouage (${rouage.id}) explodes at (${rouage.position.x}, ${rouage.position.y}) ` +
          `for ${damage} ${XelorMechanismsService.ROUAGE_STATUS_EFFECT_CONFIG.element} damage ` +
          `(${effectiveCharges} charges, area=${XelorMechanismsService.ROUAGE_STATUS_EFFECT_CONFIG.area})`
        );

        if (enemiesInArea.length > 0) {
          console.log(
            `[XELOR] 🎯 Rouage (${rouage.id}) affected enemies: ` +
            enemiesInArea.map(enemy => `${enemy.name}(${enemy.position.x},${enemy.position.y})`).join(', ')
          );
        } else {
          console.log(`[XELOR] 🎯 Rouage (${rouage.id}) hit no enemy in area`);
        }

        const explosionResult: SimulationActionResult = {
          success: true,
          actionId: `trigger_rouage_${rouage.id}_${Date.now()}`,
          actionType: 'TriggerExplosion',
          spellId: rouage.spellId || 'XEL_ROUAGE',
          spellName: 'Rouage',
          damage,
          paCost: 0,
          pwCost: 0,
          mpCost: 0,
          message: `Explosion Rouage (${effectiveCharges} charges): ${damage} dégâts ${XelorMechanismsService.ROUAGE_STATUS_EFFECT_CONFIG.element}`,
          details: {
            mechanismId: rouage.id,
            mechanismType: 'cog',
            area: XelorMechanismsService.ROUAGE_STATUS_EFFECT_CONFIG.area,
            element: XelorMechanismsService.ROUAGE_STATUS_EFFECT_CONFIG.element,
            chargesUsed: effectiveCharges,
            impactedEnemies: enemiesInArea.map(enemy => ({
              id: enemy.id,
              name: enemy.name,
              position: enemy.position
            }))
          }
        };

        getXelorState(context, true).triggeredActions.push(explosionResult);
        getXelorState(context, true).mechanismCharges?.set(rouage.id, 0);
        this.boardService.updateMechanismCharges(rouage.id, 0);
      }
    });

    getXelorState(context, true).sharedMechanismCharges?.set('cog', 0);
  }

  /**
   * Vérifie si une position est dans la zone d'explosion du Rouage.
   */
  private isPositionInRouageExplosionArea(target: { x: number; y: number }, rouagePosition: { x: number; y: number }): boolean {
    const deltaX = Math.abs(target.x - rouagePosition.x);
    const deltaY = Math.abs(target.y - rouagePosition.y);

    if (XelorMechanismsService.ROUAGE_STATUS_EFFECT_CONFIG.area === 'CROSS2') {
      return (deltaX === 0 && deltaY <= 2) || (deltaY === 0 && deltaX <= 2);
    }

    return deltaX + deltaY <= 2;
  }

  /**
   * Applique les soins du Sinistro
   * Utilise le service centralisé ResourceRegenerationService pour la régénération de PA
   */
  public applySinistroHealing(context: SimulationContext): void {
    const sinistros = this.boardService.getMechanismsByType('sinistro');

    sinistros.forEach(sinistro => {
      const charges = getXelorState(context, true).mechanismCharges?.get(sinistro.id) || 0;

      if (charges > 0) {
        console.log(`[XELOR] 💚 Sinistro (${sinistro.id}) heals adjacent allies (${charges} charges)`);
        // TODO: Calculer et appliquer les soins aux alliés adjacents
        // Soins = 2% PV manquant par charge
      }
    });

    const regenEvents = this.regenerationService.applySinistroRegeneration(context);

    regenEvents.forEach(event => {
      const mechanismId = event.details?.['mechanismId'];
      const sinistroMech = mechanismId ? this.boardService.getMechanism(mechanismId) : sinistros[0];
      const actualSpellId = sinistroMech?.spellId || 'XEL_SINISTRO';

      const sinistroResult: SimulationActionResult = {
        success: true,
        actionId: `trigger_sinistro_${mechanismId || 'unknown'}_${Date.now()}`,
        actionType: 'TriggerExplosion',
        spellId: actualSpellId,
        spellName: 'Sinistro',
        heal: 0,
        damage: 0,
        paCost: -(event.amount || 0),
        pwCost: 0,
        mpCost: 0,
        message: event.description || `Sinistro: régénération PA`,
        details: {
          mechanismId: event.details?.['mechanismId'],
          mechanismType: 'sinistro',
          paRegenerated: event.amount || 0,
          charges: event.details?.['charges'] || 0
        }
      };

      getXelorState(context, true).triggeredActions.push(sinistroResult);
    });
  }

  /**
   * Gère les mécanismes existants avant d'en poser un nouveau
   * Règles:
   * - Cadran: 1 seul max, remplace l'ancien (supprime aussi les heures du cadran)
   * - Régulateur: 1 seul max, remplace l'ancien
   * - Rouage: 1 max par défaut, 2 max avec passif
   * - Sinistro: 1 max par défaut, 2 max avec passif
   */
  private handleExistingMechanisms(mechanismType: 'cog' | 'sinistro' | 'dial' | 'regulateur', context: SimulationContext): void {
    const existingMechanisms = this.boardService.getMechanismsByType(mechanismType);
    const maxAllowed = this.getMaxMechanismsAllowed(mechanismType, context);

    console.log(`[XELOR] Handling existing ${mechanismType}s: ${existingMechanisms.length} existing, max allowed: ${maxAllowed}`);

    if (existingMechanisms.length >= maxAllowed) {
      const toRemove = existingMechanisms.length - maxAllowed + 1;

      for (let i = 0; i < toRemove; i++) {
        const mechanismToRemove = existingMechanisms[i];
        console.log(`[XELOR] 🗑️ Removing old ${mechanismType}: ${mechanismToRemove.id}`);

        if (mechanismType === 'dial') {
          this.boardService.removeDialHoursForDial(mechanismToRemove.id);
          this.boardService.resetDialState();
          getXelorState(context, true).dialId = undefined;
          getXelorState(context, true).currentDialHour = undefined;
          console.log(`[XELOR] 🗑️ Removed dial hours and reset dial state`);
        }

        this.boardService.removeMechanism(mechanismToRemove.id);
        getXelorState(context, true).mechanismCharges?.delete(mechanismToRemove.id);
      }
    }
  }

  /**
   * Retourne le nombre maximum de mécanismes autorisés pour un type donné
   * Prend en compte le passif "Rémanence" qui augmente la limite pour Rouage et Sinistro
   */
  private getMaxMechanismsAllowed(mechanismType: string, context: SimulationContext): number {
    const hasRemanence = context.activePassiveIds?.includes('remanence') ||
      context.activePassiveIds?.includes('XEL_REMANENCE');

    switch (mechanismType) {
      case 'dial':
        return 1;
      case 'regulateur':
        return 1;
      case 'cog':
        return hasRemanence ? 2 : 1;
      case 'sinistro':
        return hasRemanence ? 2 : 1;
      default:
        return 1;
    }
  }
}
