import {inject, Injectable, Injector} from '@angular/core';
import {DelayedEffect, SimulationContext, SimulationActionResult} from '../../calculators/simulation-engine.service';
import {ResourceRegenerationService} from '../../processors/resource-regeneration.service';
import {BoardService} from '../../board.service';
import {Spell} from '../../../models/spell.model';
import {TimelineAction} from '../../../models/timeline.model';
import {XelorMovementService} from './xelor-movement.service';
import {XelorDialService} from './xelor-dial.service';
import {XelorPassivesService} from './xelor-passives.service';
import { getXelorState } from './xelor-state.utils';


@Injectable({ providedIn: 'root' })
export class XelorExecuteEffectService {

  private readonly boardService = inject(BoardService);
  private readonly regenerationService = inject(ResourceRegenerationService);
  private readonly xelorMovementService = inject(XelorMovementService);
  private readonly injector = inject(Injector);
  private readonly xelorPassivesService = inject(XelorPassivesService);

  private get dial(): XelorDialService {
    return this.injector.get(XelorDialService);
  }

  private static readonly DESYNCHRO_SPELL_ID = 'XEL_DESYNCHRO';
  private static readonly DESYNCHRO_DIAL_BONUS_USAGE_KEY = 'XEL_DESYNCHRO_DIAL_BONUS';

  /**
   * Exécute un effet selon son type (correspond à effect_type dans la table spell_effect)
   */
  public executeEffect(effect: DelayedEffect, context: SimulationContext): void {
    switch (effect.effectType) {
      case 'DEAL_DAMAGE':
        this.executeDealDamage(effect);
        break;

      case 'HEAL':
      case 'HEAL_AROUND_MECHANISM':
        this.executeHeal(effect);
        break;

      case 'TELEPORT':
      case 'TELEPORT_SAVED_POS':
      case 'TELEPORT_TO_DIAL_HOUR':
        this.executeTeleport(effect);
        break;

      case 'APPLY_STATUS':
      case 'APPLY_STATUS_IF':
        this.executeApplyStatus(effect);
        break;

      case 'ADD_AP':
      case 'ADD_AP_AROUND_MECHANISM':
        this.executeAddAp(effect, context);
        break;

      case 'SUB_AP':
        this.executeSubAp(effect);
        break;

      case 'ADVANCE_DIAL':
      case 'ADVANCE_DIAL_HOUR':
        this.executeAdvanceDial(effect, context);
        break;

      case 'DEAL_AROUND_MECHANISM':
        this.executeDealAroundMechanism(effect, context);
        break;

      default:
        console.warn(`[XELOR MAITRE_CADRAN] ⚠️ Unknown effect type: ${effect.effectType}`);
        console.warn(`[XELOR MAITRE_CADRAN]    Params: ${JSON.stringify(effect.params)}`);
    }
  }

  /**
   * Exécute un effet DEAL_DAMAGE
   */
  private executeDealDamage(effect: DelayedEffect): void {
    const amount = effect.params['amount'] || 0;
    const element = effect.params['element'] || 'LIGHT';

    console.log(`[XELOR MAITRE_CADRAN] ⚔️ DEAL_DAMAGE: ${amount} ${element}`);
    console.log(`[XELOR MAITRE_CADRAN]    Target: ${effect.targetScope} at (${effect.targetPosition.x}, ${effect.targetPosition.y})`);

    // TODO: Appliquer les dégâts via DamageCalculatorService
  }

  /**
   * Exécute un effet HEAL
   */
  private executeHeal(effect: DelayedEffect): void {
    const amount = effect.params['amount'] || 0;
    const percentMissing = effect.params['percentMissingPerCharge'] || 0;

    console.log(`[XELOR MAITRE_CADRAN] 💚 HEAL: ${amount > 0 ? amount : percentMissing + '% missing HP per charge'}`);
    console.log(`[XELOR MAITRE_CADRAN]    Target: ${effect.targetScope}`);

    // TODO: Appliquer les soins
  }

  /**
   * Exécute un effet TELEPORT
   */
  private executeTeleport(effect: DelayedEffect): void {
    const to = effect.params['to'] || 'CAST_POS';

    console.log(`[XELOR MAITRE_CADRAN] 🌀 TELEPORT: to ${to}`);
    console.log(`[XELOR MAITRE_CADRAN]    Target: ${effect.targetScope}`);

    // TODO: Effectuer la téléportation
  }

  /**
   * Exécute un effet APPLY_STATUS
   */
  private executeApplyStatus(effect: DelayedEffect): void {
    const status = effect.params['status'];
    const duration = effect.params['duration'];

    console.log(`[XELOR MAITRE_CADRAN] 📌 APPLY_STATUS: ${status} (duration: ${duration || 'infinite'})`);
    console.log(`[XELOR MAITRE_CADRAN]    Target: ${effect.targetScope}`);

    // TODO: Appliquer le statut
  }

  /**
   * Exécute un effet ADD_AP
   * Utilise le service centralisé ResourceRegenerationService
   */
  private executeAddAp(effect: DelayedEffect, context: SimulationContext): void {
    const amount = effect.params['amount'] || effect.params['amountPerStep'] || 1;

    console.log(`[XELOR MAITRE_CADRAN] ➕ ADD_AP: +${amount} AP`);
    console.log(`[XELOR MAITRE_CADRAN]    Target scope: ${effect.targetScope}`);
    console.log(`[XELOR MAITRE_CADRAN]    Target position: (${effect.targetPosition.x}, ${effect.targetPosition.y})`);
    console.log(`[XELOR MAITRE_CADRAN]    Caster position at cast time: (${effect.casterPosition.x}, ${effect.casterPosition.y})`);

    const wasAutocast = effect.targetPosition.x === effect.casterPosition.x &&
      effect.targetPosition.y === effect.casterPosition.y;

    console.log(`[XELOR MAITRE_CADRAN]    Was autocast (self-targeted)? ${wasAutocast}`);

    const regenerationSource = this.getRegenerationSourceForSpell(effect.spellId, effect.spellName);

    if (effect.targetScope === 'SELF' || (effect.targetScope === 'TARGET' && wasAutocast)) {
      console.log(`[XELOR MAITRE_CADRAN] ✅ Applying +${amount} AP to player (from ${effect.spellName}, source: ${regenerationSource})`);
      this.regenerationService.regeneratePA(
        context,
        amount,
        regenerationSource,
        `${effect.spellName}: +${amount} PA`,
        { spellId: effect.spellId, spellName: effect.spellName, trigger: 'ON_HOUR_WRAPPED' }
      );
    } else if (effect.targetScope === 'TARGET') {
      const playerEntity = this.boardService.player();
      const playerPositionFromBoard = playerEntity?.position;
      const playerPositionFromContext = context.playerPosition;

      const isTargetPlayerNow =
        (effect.targetPosition.x === playerPositionFromBoard?.x &&
          effect.targetPosition.y === playerPositionFromBoard.y) ||
        (effect.targetPosition.x === playerPositionFromContext?.x &&
          effect.targetPosition.y === playerPositionFromContext.y);

      if (isTargetPlayerNow) {
        console.log(`[XELOR MAITRE_CADRAN] ✅ Target is now player position, applying +${amount} AP (source: ${regenerationSource})`);
        this.regenerationService.regeneratePA(
          context,
          amount,
          regenerationSource,
          `${effect.spellName}: +${amount} PA`,
          { spellId: effect.spellId, spellName: effect.spellName, trigger: 'ON_HOUR_WRAPPED' }
        );
      } else {
        console.log(`[XELOR MAITRE_CADRAN] ℹ️ ADD_AP to non-player TARGET at (${effect.targetPosition.x}, ${effect.targetPosition.y}) - effect logged but not applied to context`);
      }
    }
  }

  /**
   * Exécute un effet SUB_AP
   */
  private executeSubAp(effect: DelayedEffect): void {
    const amount = effect.params['amount'] || 1;

    console.log(`[XELOR MAITRE_CADRAN] ➖ SUB_AP: -${amount} AP`);
    console.log(`[XELOR MAITRE_CADRAN]    Target: ${effect.targetScope}`);

    // TODO: Retirer les PA à la cible
  }

  /**
   * Exécute un effet ADVANCE_DIAL
   */
  private executeAdvanceDial(effect: DelayedEffect, context: SimulationContext): void {
    const hours = effect.params['hours'] || effect.params['by'] || 1;

    console.log(`[XELOR MAITRE_CADRAN] ⏰ ADVANCE_DIAL: +${hours} hour(s)`);

    if (!getXelorState(context, true).dialId || getXelorState(context, true).currentDialHour === undefined) {
      console.log('[XELOR MAITRE_CADRAN]    ℹ️ No active dial in context - ADVANCE_DIAL ignored');
      return;
    }

    const oldHour = getXelorState(context, true).currentDialHour;

    this.dial.setDialHourOffset(context, hours);

    const newHour = getXelorState(context, true).currentDialHour;

    if (newHour !== undefined) {
      this.boardService.setCurrentDialHour(newHour, getXelorState(context, true).dialId);
      console.log(`[XELOR MAITRE_CADRAN]    ✅ Dial hour: ${oldHour} → ${newHour}`);
    }
  }

  /**
   * Exécute un effet DEAL_AROUND_MECHANISM
   */
  private executeDealAroundMechanism(effect: DelayedEffect, context: SimulationContext): void {
    const kind = effect.params['kind'];
    const element = effect.params['element'];
    const perChargeAmount = effect.params['perChargeAmount'] || 0;
    const area = effect.params['area'];

    console.log(`[XELOR MAITRE_CADRAN] 💥 DEAL_AROUND_MECHANISM: ${kind}`);
    console.log(`[XELOR MAITRE_CADRAN]    Element: ${element}, Area: ${area}`);
    console.log(`[XELOR MAITRE_CADRAN]    Damage per charge: ${perChargeAmount}`);

    const mechanisms = this.boardService.getMechanismsByType(kind.toLowerCase());
    mechanisms.forEach(mechanism => {
      const charges = getXelorState(context, true).mechanismCharges?.get(mechanism.id) || 0;
      const damage = charges * perChargeAmount;
      console.log(`[XELOR MAITRE_CADRAN]    ${kind} at (${mechanism.position.x}, ${mechanism.position.y}): ${charges} charges → ${damage} ${element} damage`);
    });
  }

  /**
   * Détermine la source de régénération appropriée pour un sort donné
   */
  private getRegenerationSourceForSpell(spellId: string, spellName: string): any {
    const spellIdLower = spellId.toLowerCase();

    if (spellIdLower.includes('devouement') || spellName.toLowerCase().includes('dévouement')) {
      return 'DEVOUEMENT';
    }
    if (spellIdLower.includes('pointe_heure') || spellName.toLowerCase().includes('pointe-heure')) {
      return 'POINTE_HEURE';
    }

    return 'SPELL_EFFECT';
  }

  /**
   * Exécute le sort "Retour Spontané"
   * Annule le dernier mouvement non-PM ayant eu lieu pendant le tour du Xélor
   *
   * @param spell Le sort Retour Spontané
   * @param action L'action de timeline
   * @param context Le contexte de simulation
   * @returns Le résultat de l'action
   */
  public executeRetourSpontane(
    spell: Spell,
    action: TimelineAction,
    context: SimulationContext
  ): SimulationActionResult {
    console.log(`[XELOR RETOUR_SPONTANE] 🔄 Executing Retour Spontané`);

    const lastMovement = this.xelorMovementService.getLastMovement(context);

    if (!lastMovement) {
      console.log(`[XELOR RETOUR_SPONTANE] ❌ No movement to revert`);
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: spell.id,
        spellName: spell.name,
        paCost: 0,
        pwCost: 0,
        mpCost: 0,
        message: 'Retour Spontané: Aucun mouvement à annuler ce tour'
      };
    }

    console.log(`[XELOR RETOUR_SPONTANE] Last movement: ${lastMovement.type} - ${lastMovement.targetName}`);
    console.log(`[XELOR RETOUR_SPONTANE] From: (${lastMovement.toPosition.x}, ${lastMovement.toPosition.y}) → To: (${lastMovement.fromPosition.x}, ${lastMovement.fromPosition.y})`);

    const paCost = spell.paCost || 3;
    const pwCost = spell.pwCost || 0;

    if (context.availablePa < paCost) {
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: spell.id,
        spellName: spell.name,
        paCost: 0,
        pwCost: 0,
        mpCost: 0,
        message: `Retour Spontané: PA insuffisants (${context.availablePa}/${paCost})`
      };
    }

    let revertSuccess: boolean;
    let revertMessage: string;

    if (lastMovement.type === 'swap' || lastMovement.type === 'swap_mechanism') {
      revertSuccess = this.xelorMovementService.revertSwapMovement(lastMovement, context);
      revertMessage = revertSuccess
        ? `Échange annulé: ${lastMovement.targetName} et ${lastMovement.swapPartner?.name} retournent à leurs positions`
        : `Échec de l'annulation de l'échange`;
    } else {
      revertSuccess = this.xelorMovementService.revertSimpleMovement(lastMovement, context);
      revertMessage = revertSuccess
        ? `${lastMovement.targetName} retourne à sa position précédente (${lastMovement.fromPosition.x}, ${lastMovement.fromPosition.y})`
        : `Échec de l'annulation du mouvement`;
    }

    if (revertSuccess) {
      if (lastMovement.type === 'swap' || lastMovement.type === 'swap_mechanism') {
        this.xelorPassivesService.applyCoursduTempsOnTransposition(context, 'retour_spontane_swap');
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
        message: `Retour Spontané: ${revertMessage}`,
        details: {
          revertedMovement: lastMovement,
          targetReturned: lastMovement.targetName,
          fromPosition: lastMovement.toPosition,
          toPosition: lastMovement.fromPosition
        }
      };
    } else {
      console.log(`[XELOR RETOUR_SPONTANE] ❌ Failed to revert movement`);
      return {
        success: false,
        actionId: action.id || '',
        actionType: 'CastSpell',
        spellId: spell.id,
        spellName: spell.name,
        paCost: 0,
        pwCost: 0,
        mpCost: 0,
        message: `Retour Spontané: ${revertMessage}`
      };
    }
  }

  /**
   * Exécute les effets conditionnels ON_CAST d'un sort quand leurs conditions sont remplies.
   * Cas géré ici: Désynchronisation sur cadran (centre/heure), limité à 1 fois par tour.
   */
  public processConditionalOnCastEffects(
    spell: Spell,
    action: TimelineAction,
    context: SimulationContext
  ): void {
    if (spell.id !== XelorExecuteEffectService.DESYNCHRO_SPELL_ID || !action.targetPosition) {
      return;
    }

    const targetMechanism = this.boardService.getMechanismAtPosition(action.targetPosition);
    const isDialCenter = targetMechanism?.type === 'dial';
    const isDialHour = this.boardService.isPositionOnDialHour(action.targetPosition, getXelorState(context, true).dialId);
    if (!isDialCenter && !isDialHour) {
      return;
    }

    context.spellUsageThisTurn ??= new Map<string, number>();

    const bonusUsage = context.spellUsageThisTurn.get(XelorExecuteEffectService.DESYNCHRO_DIAL_BONUS_USAGE_KEY) || 0;
    if (bonusUsage >= 1) {
      console.log('[XELOR DESYNCHRO] ℹ️ Bonus cadran déjà déclenché ce tour (1/1)');
      return;
    }

    const normalVariant = spell.variants.find(v => v.kind === 'NORMAL');
    if (!normalVariant) {
      return;
    }

    const conditionalEffects = normalVariant.effects
      .filter(effect => effect.phase === 'ON_CAST')
      .filter(effect => effect.condGroup?.conditions?.some(cond => cond.code === 'ON_DIAL_CELL'))
      .sort((a, b) => a.ordinal - b.ordinal);

    if (conditionalEffects.length === 0) {
      return;
    }

    const casterPosition = context.playerPosition || context.currentPosition;

    conditionalEffects.forEach(effect => {
      const params = (effect.extendedData && typeof effect.extendedData === 'object')
        ? { ...(effect.extendedData as Record<string, any>) }
        : {};

      if (effect.minValue !== undefined && params['minValue'] === undefined) {
        params['minValue'] = effect.minValue;
      }
      if (effect.maxValue !== undefined && params['maxValue'] === undefined) {
        params['maxValue'] = effect.maxValue;
      }

      this.executeEffect({
        id: `desynchro_dial_${spell.id}_${effect.id}_${Date.now()}`,
        spellId: spell.id,
        spellName: spell.name,
        originalPhase: 'ON_CAST',
        effectType: effect.effect,
        targetScope: effect.targetScope,
        targetPosition: action.targetPosition!,
        casterPosition,
        params,
        registeredOnTurn: context.turn || 1
      }, context);
    });

    context.spellUsageThisTurn.set(XelorExecuteEffectService.DESYNCHRO_DIAL_BONUS_USAGE_KEY, bonusUsage + 1);
    console.log('[XELOR DESYNCHRO] ✅ Bonus cadran appliqué (avance +6h, +2 PA)');
  }
}
