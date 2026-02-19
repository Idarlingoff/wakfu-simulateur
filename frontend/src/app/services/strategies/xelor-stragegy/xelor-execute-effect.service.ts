import {inject, Injectable} from '@angular/core';
import {DelayedEffect, SimulationContext} from '../../calculators/simulation-engine.service';
import {ResourceRegenerationService} from '../../processors/resource-regeneration.service';
import {BoardService} from '../../board.service';


@Injectable({ providedIn: 'root' })
export class XelorExecuteEffectService {

  private readonly boardService = inject(BoardService);
  private readonly regenerationService = inject(ResourceRegenerationService);

  /**
   * Exécute un effet selon son type (correspond à effect_type dans la table spell_effect)
   */
  public executeEffect(effect: DelayedEffect, context: SimulationContext): void {
    switch (effect.effectType) {
      case 'DEAL_DAMAGE':
        this.executeDealDamage(effect, context);
        break;

      case 'HEAL':
      case 'HEAL_AROUND_MECHANISM':
        this.executeHeal(effect, context);
        break;

      case 'TELEPORT':
      case 'TELEPORT_SAVED_POS':
      case 'TELEPORT_TO_DIAL_HOUR':
        this.executeTeleport(effect, context);
        break;

      case 'APPLY_STATUS':
      case 'APPLY_STATUS_IF':
        this.executeApplyStatus(effect, context);
        break;

      case 'ADD_AP':
      case 'ADD_AP_AROUND_MECHANISM':
        this.executeAddAp(effect, context);
        break;

      case 'SUB_AP':
        this.executeSubAp(effect, context);
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
  private executeDealDamage(effect: DelayedEffect, context: SimulationContext): void {
    const amount = effect.params['amount'] || 0;
    const element = effect.params['element'] || 'LIGHT';

    console.log(`[XELOR MAITRE_CADRAN] ⚔️ DEAL_DAMAGE: ${amount} ${element}`);
    console.log(`[XELOR MAITRE_CADRAN]    Target: ${effect.targetScope} at (${effect.targetPosition.x}, ${effect.targetPosition.y})`);

    // TODO: Appliquer les dégâts via DamageCalculatorService
  }

  /**
   * Exécute un effet HEAL
   */
  private executeHeal(effect: DelayedEffect, context: SimulationContext): void {
    const amount = effect.params['amount'] || 0;
    const percentMissing = effect.params['percentMissingPerCharge'] || 0;

    console.log(`[XELOR MAITRE_CADRAN] 💚 HEAL: ${amount > 0 ? amount : percentMissing + '% missing HP per charge'}`);
    console.log(`[XELOR MAITRE_CADRAN]    Target: ${effect.targetScope}`);

    // TODO: Appliquer les soins
  }

  /**
   * Exécute un effet TELEPORT
   */
  private executeTeleport(effect: DelayedEffect, context: SimulationContext): void {
    const to = effect.params['to'] || 'CAST_POS';

    console.log(`[XELOR MAITRE_CADRAN] 🌀 TELEPORT: to ${to}`);
    console.log(`[XELOR MAITRE_CADRAN]    Target: ${effect.targetScope}`);

    // TODO: Effectuer la téléportation
  }

  /**
   * Exécute un effet APPLY_STATUS
   */
  private executeApplyStatus(effect: DelayedEffect, context: SimulationContext): void {
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

    // Vérifier si c'est un auto-cast (le lanceur s'est ciblé lui-même)
    // Dans ce cas, on applique toujours l'effet au joueur, peu importe sa position actuelle
    const wasAutocast = effect.targetPosition.x === effect.casterPosition.x &&
      effect.targetPosition.y === effect.casterPosition.y;

    console.log(`[XELOR MAITRE_CADRAN]    Was autocast (self-targeted)? ${wasAutocast}`);

    // Déterminer la source de régénération basée sur le sort
    const regenerationSource = this.getRegenerationSourceForSpell(effect.spellId, effect.spellName);

    // Pour SELF, ou pour TARGET si c'était un auto-cast, appliquer au joueur
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
      // La cible était une autre entité (allié, etc.)
      // Vérifier si la cible est maintenant le joueur (il a pu se déplacer sur cette case)
      const playerEntity = this.boardService.player();
      const playerPositionFromBoard = playerEntity?.position;
      const playerPositionFromContext = context.playerPosition;

      const isTargetPlayerNow =
        (playerPositionFromBoard &&
          effect.targetPosition.x === playerPositionFromBoard.x &&
          effect.targetPosition.y === playerPositionFromBoard.y) ||
        (playerPositionFromContext &&
          effect.targetPosition.x === playerPositionFromContext.x &&
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
        // Note: Dans une simulation complète, il faudrait gérer les PA des alliés
      }
    }
  }

  /**
   * Exécute un effet SUB_AP
   */
  private executeSubAp(effect: DelayedEffect, context: SimulationContext): void {
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

    if (context.currentDialHour !== undefined) {
      const oldHour = context.currentDialHour;
      const newHour = ((oldHour + hours - 1) % 12) + 1;
      context.currentDialHour = newHour;
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

    // Récupérer les mécanismes du type correspondant
    const mechanisms = this.boardService.getMechanismsByType(kind.toLowerCase());
    mechanisms.forEach(mechanism => {
      const charges = context.mechanismCharges?.get(mechanism.id) || 0;
      const damage = charges * perChargeAmount;
      console.log(`[XELOR MAITRE_CADRAN]    ${kind} at (${mechanism.position.x}, ${mechanism.position.y}): ${charges} charges → ${damage} ${element} damage`);
    });
  }

  /**
   * Détermine la source de régénération appropriée pour un sort donné
   */
  private getRegenerationSourceForSpell(spellId: string, spellName: string): any {
    const spellIdLower = spellId.toLowerCase();

    // Mapper les sorts connus vers leurs sources de régénération
    if (spellIdLower.includes('devouement') || spellName.toLowerCase().includes('dévouement')) {
      return 'DEVOUEMENT';
    }
    if (spellIdLower.includes('pointe_heure') || spellName.toLowerCase().includes('pointe-heure')) {
      return 'POINTE_HEURE';
    }

    // Par défaut, utiliser SPELL_EFFECT
    return 'SPELL_EFFECT';
  }
}
