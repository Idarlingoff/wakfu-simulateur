import {inject, Injectable} from '@angular/core';
import {DelayedEffect, SimulationContext} from '../../calculators/simulation-engine.service';
import {Spell} from '../../../models/spell.model';
import {TimelineAction} from '../../../models/timeline.model';
import {BoardService} from '../../board.service';
import {XelorPassivesService} from './xelor-passives.service';
import {XelorExecuteEffectService} from './xelor-execute-effect.service';
import { getXelorState } from './xelor-state.utils';

@Injectable({ providedIn: 'root' })
export class XelorDelayedEffectsService {

  private readonly boardService = inject(BoardService);
  private readonly xelorPassivesService = inject(XelorPassivesService);
  private readonly xelorExecuteEffectService = inject(XelorExecuteEffectService);
  /**
   * Enregistre les effets différés d'un sort
   * Les effets avec phase ON_END_TURN, ON_TARGET_TURN_START, ON_TARGET_TURN_END
   * sont enregistrés comme effets différés pour être résolus plus tard
   * (ou immédiatement lors d'un tour de cadran avec le passif "Maître du Cadran")
   */
  registerSpellDelayedEffects(
    spell: Spell,
    action: TimelineAction,
    context: SimulationContext
  ): void {
    const delayedPhases = ['ON_END_TURN', 'ON_TARGET_TURN_START', 'ON_TARGET_TURN_END'];

    // TODO: gérer les crits pour sablier et horloge
    const variant = spell.variants.find(v => v.kind === 'NORMAL');
    if (!variant) {
      console.log(`[XELOR DELAYED] ⚠️ No NORMAL variant found for spell ${spell.name}`);
      return;
    }

    const delayedEffects = variant.effects.filter(effect =>
      effect.phase && delayedPhases.includes(effect.phase)
    );

    if (delayedEffects.length === 0) {
      console.log(`[XELOR DELAYED] ℹ️ No delayed effects for spell ${spell.name}`);
      return;
    }

    console.log(`[XELOR DELAYED] Found ${delayedEffects.length} delayed effect(s) for spell ${spell.name}`);

    const playerEntity = this.boardService.player();
    const casterPosition = playerEntity?.position || context.playerPosition || { x: 0, y: 0 };
    const targetPosition = action.targetPosition || casterPosition;

    for (const effect of delayedEffects) {
      const amount = effect.extendedData?.amount || effect.minValue || effect.maxValue || 0;

      const delayedEffect: DelayedEffect = {
        id: `delayed_${spell.id}_${effect.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        spellId: spell.id,
        spellName: spell.name,
        originalPhase: effect.phase as any,
        effectType: effect.effect,
        targetScope: effect.targetScope,
        targetPosition: targetPosition,
        casterPosition: casterPosition,
        params: {
          amount: amount,
          element: effect.element,
          duration: effect.extendedData?.duration || effect.duration,
          durationType: effect.durationType,
          extendedData: effect.extendedData,
          minValue: effect.minValue,
          maxValue: effect.maxValue
        },
        registeredOnTurn: context.turn || 1
      };

      console.log(`[XELOR DELAYED] 📝 Creating delayed effect with amount: ${amount} (from extendedData: ${effect.extendedData?.amount}, minValue: ${effect.minValue}, maxValue: ${effect.maxValue})`);
      this.registerDelayedEffect(delayedEffect, context);
    }
  }

  /**
   * Enregistre un effet différé qui sera résolu lors du prochain tour de cadran
   *
   * Les effets différés sont des effets de sort avec une phase comme:
   * - ON_END_TURN (fin de tour du lanceur)
   * - ON_TARGET_TURN_START (début de tour de la cible)
   * - ON_TARGET_TURN_END (fin de tour de la cible)
   *
   * Avec le passif Maître du Cadran, ces effets se résolvent AUSSI sur ON_HOUR_WRAPPED
   *
   * @param effect L'effet différé à enregistrer (correspond à un spell_effect avec phase différée)
   * @param context Le contexte de simulation
   * @returns true si l'effet a été enregistré, false sinon
   */
  public registerDelayedEffect(effect: DelayedEffect, context: SimulationContext): boolean {
    if (!getXelorState(context, true).delayedEffects) {
      getXelorState(context, true).delayedEffects = [];
    }

    if (!effect.id) {
      effect.id = `delayed_${effect.spellId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    if (!effect.registeredOnTurn) {
      effect.registeredOnTurn = context.turn || 1;
    }

    getXelorState(context, true).delayedEffects.push(effect);

    const willResolveOnHourWrap = this.xelorPassivesService.hasMaitreDuCadranPassive(context);
    console.log(`[XELOR DELAYED] ✅ Registered delayed effect: ${effect.spellName}`);
    console.log(`[XELOR DELAYED]    Effect type: ${effect.effectType}, Phase: ${effect.originalPhase}`);
    console.log(`[XELOR DELAYED]    Target scope: ${effect.targetScope}`);
    console.log(`[XELOR DELAYED]    Will resolve on hour wrap: ${willResolveOnHourWrap ? 'YES (Maître du Cadran active)' : 'NO'}`);
    console.log(`[XELOR DELAYED] 📋 Total delayed effects: ${getXelorState(context, true).delayedEffects.length}`);

    return true;
  }

  /**
   * Résout tous les effets différés enregistrés
   * Appelé lors d'un tour de cadran si le passif "Maître du Cadran" est actif
   *
   * Correspond à l'effet 'RESOLVE_DELAYED_EFFECTS' avec params: {"owner":"CASTER"}
   */
  public resolveDelayedEffects(context: SimulationContext): void {
    if (!getXelorState(context, true).delayedEffects || getXelorState(context, true).delayedEffects.length === 0) {
      console.log(`[XELOR MAITRE_CADRAN] 📭 No delayed effects to resolve`);
      return;
    }

    console.log(`[XELOR MAITRE_CADRAN] ⚡ RESOLVE_DELAYED_EFFECTS triggered on ON_HOUR_WRAPPED`);
    console.log(`[XELOR MAITRE_CADRAN] 📋 Resolving ${getXelorState(context, true).delayedEffects.length} delayed effect(s)...`);

    const effectsToResolve = [...getXelorState(context, true).delayedEffects];

    getXelorState(context, true).delayedEffects = [];

    effectsToResolve.forEach((effect, index) => {
      console.log(`[XELOR MAITRE_CADRAN] 🎯 Resolving effect ${index + 1}/${effectsToResolve.length}:`);
      console.log(`[XELOR MAITRE_CADRAN]    Spell: ${effect.spellName}`);
      console.log(`[XELOR MAITRE_CADRAN]    Effect type: ${effect.effectType}`);
      console.log(`[XELOR MAITRE_CADRAN]    Original phase: ${effect.originalPhase}`);
      console.log(`[XELOR MAITRE_CADRAN]    Target: (${effect.targetPosition.x}, ${effect.targetPosition.y})`);

      this.xelorExecuteEffectService.executeEffect(effect, context);
    });

    console.log(`[XELOR MAITRE_CADRAN] ✅ All delayed effects resolved!`);
  }
}
