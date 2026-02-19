import {inject, Injectable} from '@angular/core';
import {SimulationContext} from '../../calculators/simulation-engine.service';
import {Position} from '../../../models/timeline.model';
import {BoardService} from '../../board.service';
import {XelorPassivesService} from './xelor-passives.service';
import {XelorMechanismsService} from './xelor-mechanisms.service';
import {XelorDelayedEffectsService} from './xelor-delayed-effects.service';
import {XelorExecuteEffectService} from './xelor-execute-effect.service';

@Injectable({ providedIn: 'root' })
export class XelorDialService {

private readonly boardService = inject(BoardService);
private readonly xelorPassiveService = inject(XelorPassivesService);
private readonly xelorMechanismsService = inject(XelorMechanismsService);
private readonly xelorDelayedEffectService = inject(XelorDelayedEffectsService);

  /**
   * Met à jour les heures du cadran après un swap de position
   * Les heures sont simplement translatées en fonction du déplacement du cadran
   * (ancienne position du cadran -> nouvelle position du cadran)
   *
   * @param dialId ID du cadran
   * @param context Contexte de simulation (non utilisé mais conservé pour compatibilité)
   */
  public updateDialHoursAfterSwap(dialId: string, context?: SimulationContext): void {
    const dial = this.boardService.getMechanism(dialId);
    if (!dial || dial.type !== 'dial') {
      console.warn(`[XELOR DIAL] ⚠️ Cannot update dial hours: dial not found (${dialId})`);
      return;
    }

    const newDialPosition = dial.position;
    console.log(`[XELOR DIAL] 🔄 Updating dial hours after swap - new dial position: (${newDialPosition.x}, ${newDialPosition.y})`);

    // Récupérer les heures existantes (copie profonde pour éviter les problèmes de références)
    const existingHours = this.boardService.getDialHours(dialId).map(h => ({
      hour: h.hour,
      position: { x: h.position.x, y: h.position.y }
    }));
    if (existingHours.length === 0) {
      console.warn(`[XELOR DIAL] ⚠️ No existing hours found for dial ${dialId}`);
      return;
    }

    // Trouver l'heure 6 et l'heure 12 pour calculer l'ancien centre du cadran
    const hour12 = existingHours.find(h => h.hour === 12);
    const hour6 = existingHours.find(h => h.hour === 6);
    if (!hour12 || !hour6) {
      console.warn(`[XELOR DIAL] ⚠️ Hour 12 or Hour 6 not found - cannot determine old center position`);
      return;
    }

    // L'ancien centre était entre l'heure 12 et l'heure 6
    const oldCenterX = Math.round((hour12.position.x + hour6.position.x) / 2);
    const oldCenterY = Math.round((hour12.position.y + hour6.position.y) / 2);

    // Calculer le vecteur de translation (ancienne position -> nouvelle position)
    const translationX = newDialPosition.x - oldCenterX;
    const translationY = newDialPosition.y - oldCenterY;

    console.log(`[XELOR DIAL] 📍 Old center: (${oldCenterX}, ${oldCenterY})`);
    console.log(`[XELOR DIAL] 📍 New center (dial position): (${newDialPosition.x}, ${newDialPosition.y})`);
    console.log(`[XELOR DIAL] 📍 Hour 12 was at: (${hour12.position.x}, ${hour12.position.y})`);
    console.log(`[XELOR DIAL] 📍 Hour 6 was at: (${hour6.position.x}, ${hour6.position.y})`);
    console.log(`[XELOR DIAL] 📍 Translation vector: (${translationX}, ${translationY})`);

    // Log toutes les heures pour diagnostic
    console.log(`[XELOR DIAL] 📋 All existing hours BEFORE translation:`);
    existingHours.forEach(h => {
      console.log(`[XELOR DIAL]   Hour ${h.hour}: (${h.position.x}, ${h.position.y})`);
    });

    // Supprimer les anciennes heures
    this.boardService.removeDialHoursForDial(dialId);

    // Recréer les heures avec la translation appliquée
    let hoursCreated = 0;
    existingHours.forEach(oldHour => {
      const newHourPosition: Position = {
        x: oldHour.position.x + translationX,
        y: oldHour.position.y + translationY
      };

      // Vérifier que la position est dans les limites du plateau (13x13)
      if (newHourPosition.x >= 0 && newHourPosition.x < 13 && newHourPosition.y >= 0 && newHourPosition.y < 13) {
        const dialHour = {
          id: `dial_hour_${oldHour.hour}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          dialId: dialId,
          hour: oldHour.hour,
          position: newHourPosition
        };

        this.boardService.addDialHour(dialHour);
        hoursCreated++;
        console.log(`[XELOR DIAL] Hour ${oldHour.hour}: (${oldHour.position.x}, ${oldHour.position.y}) -> (${newHourPosition.x}, ${newHourPosition.y})`);
      } else {
        console.warn(`[XELOR DIAL] Hour ${oldHour.hour} skipped - out of bounds: (${newHourPosition.x}, ${newHourPosition.y})`);
      }
    });

    console.log(`[XELOR DIAL] ✅ Dial hours updated after swap (${hoursCreated}/${existingHours.length} hours translated)`);
  }

  /**
   * Avance l'heure du cadran selon le coût en PW d'un sort
   * L'heure courante avance de 1 par PW dépensé
   */
  public advanceDialHourByPwCost(pwCost: number, context: SimulationContext): void {
    if (!context.dialId || context.currentDialHour === undefined) {
      console.log(`[XELOR] ⚠️ advanceDialHourByPwCost skipped: dialId=${context.dialId}, currentDialHour=${context.currentDialHour}`);
      return;
    }

    console.log(`[XELOR] ⏰ Advancing dial hour by ${pwCost} (PW cost)`);
    console.log(`[XELOR] ⏰ BoardService state: activeDialId=${this.boardService.activeDialId()}, currentDialHour=${this.boardService.currentDialHour()}`);

    // Avancer via le BoardService pour mettre à jour le signal
    const result = this.boardService.advanceCurrentDialHour(pwCost);

    // Mettre à jour le contexte
    context.currentDialHour = result.newHour;

    // Traiter le wrap si nécessaire
    if (result.wrapped) {
      console.log(`[XELOR] 🔄 Hour wrap detected! Triggering ON_HOUR_WRAPPED effects`);
      this.processHourWrap(context);
    }
  }

  /**
   * Traite les effets de tour de cadran (hour wrap)
   * Un tour de cadran se produit lorsque l'heure courante fait un tour complet (passe par 12→1)
   */
  public processHourWrap(context: SimulationContext): void {
    console.log('[XELOR] 🔄 Processing hour wrap effects (dial completed a full rotation)');

    // Vérifier si c'est le premier tour de cadran après la pose
    const isFirstLoop = !context.dialFirstLoopCompleted;

    if (isFirstLoop) {
      console.log('[XELOR] 🔄 First hour wrap since dial placement - marking first loop as completed');
      context.dialFirstLoopCompleted = true;
    }

    // Les Rouages infligent des dégâts supplémentaires (status_effect avec tick_phase = ON_HOUR_WRAPPED)
    if (context.activeAuras?.has('ROUAGE_AURA')) {
      this.xelorMechanismsService.applyRouageDamage(context);
    }

    // Les Sinistros soignent à nouveau (status_effect avec tick_phase = ON_HOUR_WRAPPED)
    if (context.activeAuras?.has('SINISTRO_AURA')) {
      this.xelorMechanismsService.applySinistroHealing(context);
    }

    // Passif "Connaissance du passé" (XEL_CONNAISSANCE_PASSE):
    // Quand l'heure courante fait un tour complet du cadran, régénère 2 PA et 2 PW
    // IMPORTANT: Ne se déclenche PAS au premier passage de 12 à 1 après la pose du cadran
    if (this.xelorPassiveService.hasConnaissancePassePassive(context)) {
      if (isFirstLoop) {
        console.log('[XELOR CONNAISSANCE_PASSE] ⏳ First loop after dial placement - Connaissance du passé does NOT trigger');
      } else {
        this.xelorPassiveService.applyConnaissancePasseRegeneration(context);
      }
    }

    // Passif "Maître du Cadran" (XEL_MAITRE_CADRAN):
    // Quand l'heure courante fait un tour complet du cadran,
    // les effets délayés (ON_END_TURN, ON_TARGET_TURN_START, etc.) se résolvent immédiatement
    if (this.xelorPassiveService.hasMaitreDuCadranPassive(context)) {
      this.xelorDelayedEffectService.resolveDelayedEffects(context);
    }
  }

  /**
   * Avance l'heure du cadran et déclenche les effets associés
   */
  public advanceDialHour(context: SimulationContext, hoursToAdvance: number = 1): void {
    if (context.currentDialHour === undefined) return;

    const previousHour = context.currentDialHour;
    // Calculer la nouvelle heure (en restant dans 1-12)
    context.currentDialHour = ((context.currentDialHour - 1 + hoursToAdvance) % 12) + 1;

    console.log(`[XELOR] Dial hour advanced: ${previousHour} → ${context.currentDialHour} (${hoursToAdvance > 0 ? '+' : ''}${hoursToAdvance}h)`);

    // Détection du tour de cadran (hour wrap)
    // Un tour de cadran se produit si l'heure actuelle est "inférieure" à l'heure précédente
    // (en considérant le cycle 1-12), ce qui signifie qu'on a "bouclé"
    const hasWrapped = this.hasDialHourWrapped(previousHour, context.currentDialHour, hoursToAdvance);

    if (hasWrapped) {
      console.log(`[XELOR] 🔄 Hour wrap detected! (${previousHour} → ${context.currentDialHour}) - Triggering ON_HOUR_WRAPPED effects`);
      this.processHourWrap(context);
    }

    // Vérifier si le joueur est sur la nouvelle heure courante (Ponctualité)
    const playerEntity = this.boardService.player();
    if (playerEntity && context.dialId) {
      const playerHour = this.boardService.getDialHourAtPosition(playerEntity.position, context.dialId);
      if (playerHour === context.currentDialHour) {
        console.log(`[XELOR] ⭐ Ponctualité! Player is on current hour (${context.currentDialHour})`);
        // TODO: Appliquer le buff Ponctualité (+50% DI)
      }
    }
  }

  /**
   * Vérifie si un changement d'heure a provoqué un tour de cadran
   * Un tour de cadran se produit si on "passe" par 12→1 dans le cycle
   *
   * Exemples:
   * - 9 → 3 avec +6h: pas de wrap (9 + 6 = 15 = 3, mais on ne passe pas par 12→1)
   * - 9 → 1 avec +4h: WRAP (9 + 4 = 13 = 1, on passe par 12→1)
   * - 12 → 1 avec +1h: WRAP (classique)
   * - 10 → 2 avec +4h: WRAP (10 + 4 = 14 = 2, on passe par 12→1)
   */
  private hasDialHourWrapped(previousHour: number, newHour: number, hoursAdvanced: number): boolean {
    // Si on avance dans le sens horaire normal
    if (hoursAdvanced > 0) {
      // Calculer combien on a avancé en réalité (peut dépasser 12)
      const totalHours = previousHour + hoursAdvanced;
      // Si on dépasse 12, on a fait un wrap
      return totalHours > 12;
    }

    // Si on recule (hoursAdvanced négatif), on wrap si la nouvelle heure est supérieure
    // Exemple: 3 → 11 avec -4h signifie qu'on a reculé en passant par 12
    if (hoursAdvanced < 0) {
      return newHour > previousHour;
    }

    // hoursAdvanced === 0, pas de changement
    return false;
  }
}
