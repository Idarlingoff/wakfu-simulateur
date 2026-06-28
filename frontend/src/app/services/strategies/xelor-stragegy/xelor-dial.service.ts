import {inject, Injectable, Injector} from '@angular/core';
import {SimulationContext} from '../../calculators/simulation-engine.service';
import {Position} from '../../../models/timeline.model';
import {BoardService} from '../../board.service';
import {XelorPassivesService} from './xelor-passives.service';
import {XelorMechanismsService} from './xelor-mechanisms.service';
import {XelorDelayedEffectsService} from './xelor-delayed-effects.service';
import {XelorTeleportService} from './xelor-teleport.service';
import { getXelorState } from './xelor-state.utils';

@Injectable({ providedIn: 'root' })
export class XelorDialService {

private readonly boardService = inject(BoardService);
private readonly xelorPassiveService = inject(XelorPassivesService);
private readonly xelorMechanismsService = inject(XelorMechanismsService);
private readonly xelorDelayedEffectService = inject(XelorDelayedEffectsService);
private readonly injector = inject(Injector);

private get teleport(): XelorTeleportService {
  return this.injector.get(XelorTeleportService);
}


  /**
   * Crée les 12 heures autour d'un cadran, orientées selon la direction du lancer
   */
  public createDialHours(dialId: string, centerPosition: Position, playerPosition: Position): void {
    console.log(`[XELOR DIAL] Creating 12 hours around dial at (${centerPosition.x}, ${centerPosition.y})`);
    console.log(`[XELOR DIAL] Player position: (${playerPosition.x}, ${playerPosition.y})`);

    const dx = centerPosition.x - playerPosition.x;
    const dy = centerPosition.y - playerPosition.y;

    console.log(`[XELOR DIAL] Direction vector: (${dx}, ${dy})`);

    let rotation = 0;
    let directionName: string;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        rotation = 1;
        directionName = 'DROITE (Est)';
      } else {
        rotation = 3;
        directionName = 'GAUCHE (Ouest)';
      }
    } else if (dy > 0) {
      rotation = 2;
      directionName = 'BAS (Sud)';
    } else {
      rotation = 0;
      directionName = 'HAUT (Nord)';
    }

    console.log(`[XELOR DIAL] Direction: ${directionName}, Rotation: ${rotation * 90}°`);

    const baseHourPositions = [
      { hour: 12, offsetX: 0, offsetY: -3 },
      { hour: 1, offsetX: +1, offsetY: -2 },
      { hour: 2, offsetX: +2, offsetY: -1 },
      { hour: 3, offsetX: +3, offsetY: 0 },
      { hour: 4, offsetX: +2, offsetY: +1 },
      { hour: 5, offsetX: +1, offsetY: +2 },
      { hour: 6, offsetX: 0, offsetY: +3 },
      { hour: 7, offsetX: -1, offsetY: +2 },
      { hour: 8, offsetX: -2, offsetY: +1 },
      { hour: 9, offsetX: -3, offsetY: 0 },
      { hour: 10, offsetX: -2, offsetY: -1 },
      { hour: 11, offsetX: -1, offsetY: -2 }
    ];

    let hoursCreated = 0;

    baseHourPositions.forEach(({ hour, offsetX, offsetY }) => {
      let rotatedX = offsetX;
      let rotatedY = offsetY;

      for (let i = 0; i < rotation; i++) {
        const tempX = rotatedX;
        rotatedX = -rotatedY;
        rotatedY = tempX;
      }

      const hourPosition: Position = {
        x: centerPosition.x + rotatedX,
        y: centerPosition.y + rotatedY
      };

      if (hourPosition.x >= 0 && hourPosition.x < 13 && hourPosition.y >= 0 && hourPosition.y < 13) {
        const dialHour = {
          id: `dial_hour_${hour}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          dialId: dialId,
          hour: hour,
          position: hourPosition
        };

        this.boardService.addDialHour(dialHour);
        hoursCreated++;
        console.log(`Hour ${hour} at (${hourPosition.x}, ${hourPosition.y})`);
      } else {
        console.warn(` Hour ${hour} skipped - out of bounds: (${hourPosition.x}, ${hourPosition.y})`);
      }
    });

    console.log(`[XELOR DIAL] Created ${hoursCreated}/12 hours (oriented ${directionName})`);
  }

  /**
   * Met à jour les heures du cadran après un swap de position
   * Les heures sont simplement translatées en fonction du déplacement du cadran
   * (ancienne position du cadran -> nouvelle position du cadran)
   *
   * @param dialId ID du cadran
   */
  public updateDialHoursAfterSwap(dialId: string): void {
    const dial = this.boardService.getMechanism(dialId);
    if (dial?.type !== 'dial') {
      console.warn(`[XELOR DIAL] ⚠️ Cannot update dial hours: dial not found (${dialId})`);
      return;
    }

    const newDialPosition = dial.position;
    console.log(`[XELOR DIAL] 🔄 Updating dial hours after swap - new dial position: (${newDialPosition.x}, ${newDialPosition.y})`);

    const existingHours = this.boardService.getDialHours(dialId).map(h => ({
      hour: h.hour,
      position: { x: h.position.x, y: h.position.y }
    }));
    if (existingHours.length === 0) {
      console.warn(`[XELOR DIAL] ⚠️ No existing hours found for dial ${dialId}`);
      return;
    }

    const hour12 = existingHours.find(h => h.hour === 12);
    const hour6 = existingHours.find(h => h.hour === 6);
    if (!hour12 || !hour6) {
      console.warn(`[XELOR DIAL] ⚠️ Hour 12 or Hour 6 not found - cannot determine old center position`);
      return;
    }

    const oldCenterX = Math.round((hour12.position.x + hour6.position.x) / 2);
    const oldCenterY = Math.round((hour12.position.y + hour6.position.y) / 2);

    const translationX = newDialPosition.x - oldCenterX;
    const translationY = newDialPosition.y - oldCenterY;

    console.log(`[XELOR DIAL] 📍 Old center: (${oldCenterX}, ${oldCenterY})`);
    console.log(`[XELOR DIAL] 📍 New center (dial position): (${newDialPosition.x}, ${newDialPosition.y})`);
    console.log(`[XELOR DIAL] 📍 Hour 12 was at: (${hour12.position.x}, ${hour12.position.y})`);
    console.log(`[XELOR DIAL] 📍 Hour 6 was at: (${hour6.position.x}, ${hour6.position.y})`);
    console.log(`[XELOR DIAL] 📍 Translation vector: (${translationX}, ${translationY})`);

    console.log(`[XELOR DIAL] 📋 All existing hours BEFORE translation:`);
    existingHours.forEach(h => {
      console.log(`[XELOR DIAL]   Hour ${h.hour}: (${h.position.x}, ${h.position.y})`);
    });

    this.boardService.removeDialHoursForDial(dialId);

    let hoursCreated = 0;
    existingHours.forEach(oldHour => {
      const newHourPosition: Position = {
        x: oldHour.position.x + translationX,
        y: oldHour.position.y + translationY
      };

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
   * Déplace le cadran (mécanisme) sur la case de l'heure courante, puis translate
   * ses 12 heures en conséquence.
   * Les autres mécanismes posés sur des cases du cadran (ex: Régulateur) NE sont PAS
   * déplacés : seuls le cadran et ses zones d'heures bougent.
   * Utilisé par Tempus Fugit (lancé sur le cadran).
   */
  public moveDialToCurrentHour(context: SimulationContext): void {
    const state = getXelorState(context, true);
    if (!state.dialId || state.currentDialHour === undefined) {
      console.warn('[XELOR DIAL] ⚠️ moveDialToCurrentHour ignoré : aucun cadran actif');
      return;
    }

    const destination = this.boardService.getDialHourPosition(state.currentDialHour, state.dialId);
    if (!destination) {
      console.warn(`[XELOR DIAL] ⚠️ Heure courante (${state.currentDialHour}) introuvable - déplacement annulé`);
      return;
    }

    const dial = this.boardService.getMechanism(state.dialId);
    if (!dial || dial.type !== 'dial') {
      console.warn(`[XELOR DIAL] ⚠️ Cadran introuvable (${state.dialId})`);
      return;
    }

    const dialOldPos = { x: dial.position.x, y: dial.position.y };
    if (dialOldPos.x === destination.x && dialOldPos.y === destination.y) {
      console.log("[XELOR DIAL] ℹ️ Cadran déjà sur l'heure courante");
      return;
    }

    // Si l'heure courante est occupée (entité ennemie/alliée/joueur OU mécanisme), le Cadran ÉCHANGE
    // avec l'occupant : l'occupant prend l'ancienne place du Cadran. Sinon, simple déplacement.
    const occupantEntity = this.boardService.getEntityAtPosition(destination);
    const occupantMechanism = this.boardService.getMechanismAtPosition(destination);

    if (occupantEntity) {
      console.log(`[XELOR DIAL] 🔄 Heure courante occupée par ${occupantEntity.name} - échange Cadran <-> entité`);
      // Échange entité <-> cadran : entité -> ancienne position du cadran, cadran -> heure courante.
      this.boardService.swapEntityWithMechanism(occupantEntity.id, state.dialId);
      if (occupantEntity.type === 'player') {
        context.playerPosition = { ...dialOldPos };
        context.currentPosition = { ...dialOldPos };
      }
      const entInCtx = context.entities?.find(e => e.id === occupantEntity.id);
      if (entInCtx) entInCtx.position = { ...dialOldPos };
    } else if (occupantMechanism && occupantMechanism.id !== state.dialId) {
      console.log(`[XELOR DIAL] 🔄 Heure courante occupée par ${occupantMechanism.type} - échange Cadran <-> mécanisme`);
      this.boardService.swapMechanismPositions(state.dialId, occupantMechanism.id);
    } else {
      console.log(`[XELOR DIAL] 🧭 Déplacement du cadran sur l'heure courante (${state.currentDialHour}) -> (${destination.x}, ${destination.y})`);
      this.boardService.updateMechanismPosition(state.dialId, destination);
    }

    // Translate les 12 heures autour du nouveau centre du cadran.
    this.updateDialHoursAfterSwap(state.dialId);
  }

  /**
   * Avance l'heure du cadran selon le coût en PW d'un sort
   * L'heure courante avance de 1 par PW dépensé
   */
  public advanceDialHourByPwCost(pwCost: number, context: SimulationContext): void {
    if (!getXelorState(context, true).dialId || getXelorState(context, true).currentDialHour === undefined) {
      console.log(`[XELOR] ⚠️ advanceDialHourByPwCost skipped: dialId=${getXelorState(context, true).dialId}, currentDialHour=${getXelorState(context, true).currentDialHour}`);
      return;
    }

    console.log(`[XELOR] ⏰ Advancing dial hour by ${pwCost} (PW cost)`);
    console.log(`[XELOR] ⏰ BoardService state: activeDialId=${this.boardService.activeDialId()}, currentDialHour=${this.boardService.currentDialHour()}`);

    const result = this.boardService.advanceCurrentDialHour(pwCost);

    getXelorState(context, true).currentDialHour = result.newHour;

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

    const isFirstLoop = !getXelorState(context, true).dialFirstLoopCompleted;

    if (isFirstLoop) {
      console.log('[XELOR] 🔄 First hour wrap since dial placement - marking first loop as completed');
      getXelorState(context, true).dialFirstLoopCompleted = true;
    }

    // Tour de cadran RÉEL (hors premier "tour" de la pose) : ordre métier
    // permutation -> prémonition -> horlogerie -> dégâts indirects (Rouage). Le tout premier wrap
    // (pose à 12h -> 1h au 1er PW) ne déclenche aucun de ces effets.
    if (!isFirstLoop) {
      this.xelorPassiveService.applyPermutationMomentanee(context);  // a) échange Xélor <-> Cadran
      this.teleport.resolvePremonitionDeferredTeleport(context);     // b) Prémonition : TP différé du Xélor
      this.xelorPassiveService.applyHorlogerie(context);             // c) Horlogerie : TP sur l'heure courante
    }

    if (getXelorState(context, true).activeAuras?.has('ROUAGE_AURA')) {
      this.xelorMechanismsService.applyRouageDamage(context);
    }

    if (getXelorState(context, true).activeAuras?.has('SINISTRO_AURA')) {
      this.xelorMechanismsService.applySinistroHealing(context);
    }

    // Comportement par défaut du Cadran (refonte : ex-"Connaissance du passé") :
    // à chaque tour de cadran -> +2 PW ; +2 PA (1x/tour). Ignoré au tout premier tour après la pose.
    if (isFirstLoop) {
      console.log('[XELOR CADRAN] ⏳ Premier tour de cadran après la pose - régén par défaut ignorée');
    } else {
      this.xelorPassiveService.applyDialDefaultRegeneration(context);

      // Niveau de "tour de cadran" pour le coût dynamique de Distorsion (cap 4).
      const state = getXelorState(context, true);
      state.distortionPower = Math.min((state.distortionPower ?? 0) + 1, 4);
      console.log(`[XELOR] ⏫ Niveau tour de cadran (Distorsion): ${state.distortionPower}`);
    }

    if (this.xelorPassiveService.hasMaitreDuCadranPassive(context)) {
      this.xelorDelayedEffectService.resolveDelayedEffects(context);
    }
  }

  /**
   * Avance l'heure du cadran et déclenche les effets associés
   */
  public advanceDialHour(context: SimulationContext, hoursToAdvance: number = 1): void {
    if (getXelorState(context, true).currentDialHour === undefined) return;

    const state = getXelorState(context, true);
    const previousHour = state.currentDialHour as number;

    state.currentDialHour = ((previousHour - 1 + hoursToAdvance) % 12) + 1;

    console.log(`[XELOR] Dial hour advanced: ${previousHour} → ${state.currentDialHour} (${hoursToAdvance > 0 ? '+' : ''}${hoursToAdvance}h)`);

    const hasWrapped = this.hasDialHourWrapped(previousHour, state.currentDialHour as number, hoursToAdvance);

    if (hasWrapped) {
      console.log(`[XELOR] 🔄 Hour wrap detected! (${previousHour} → ${state.currentDialHour}) - Triggering ON_HOUR_WRAPPED effects`);
      this.processHourWrap(context);
    }

    const playerEntity = this.boardService.player();
    if (playerEntity && getXelorState(context, true).dialId) {
      const playerHour = this.boardService.getDialHourAtPosition(playerEntity.position, getXelorState(context, true).dialId);
      if (playerHour === state.currentDialHour) {
        console.log(`[XELOR] ⭐ Ponctualité! Player is on current hour (${state.currentDialHour})`);
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
    if (hoursAdvanced > 0) {
      const totalHours = previousHour + hoursAdvanced;
      return totalHours > 12;
    }

    if (hoursAdvanced < 0) {
      return newHour > previousHour;
    }

    return false;
  }

  /**
   * Modifie directement l'heure du cadran
   * Cette méthode peut faire avancer l'heure de plusieurs positions
   *
   * @param context Le contexte de simulation
   * @param hours Nombre d'heures à avancer (positif) ou reculer (négatif)
   */
  public setDialHourOffset(context: SimulationContext, hours: number): void {
    if (!getXelorState(context, true).dialId || getXelorState(context, true).currentDialHour === undefined) {
      console.warn(`[XELOR] Cannot set dial hour offset: no active dial`);
      return;
    }

    this.advanceDialHour(context, hours);
  }

  /**
   * Définit l'heure du cadran à une heure spécifique (1-12)
   * Déclenche un tour de cadran si nécessaire
   *
   * @param context Le contexte de simulation
   * @param targetHour L'heure cible (1-12)
   */
  public setDialHourDirect(context: SimulationContext, targetHour: number): void {
    if (!getXelorState(context, true).dialId || getXelorState(context, true).currentDialHour === undefined) {
      console.warn(`[XELOR] Cannot set dial hour: no active dial`);
      return;
    }

    if (targetHour < 1 || targetHour > 12) {
      console.error(`[XELOR] Invalid target hour: ${targetHour} (must be 1-12)`);
      return;
    }

    const previousHour = getXelorState(context, true).currentDialHour as number;

    let hoursToAdvance: number;
    if (targetHour >= previousHour) {
      hoursToAdvance = targetHour - previousHour;
    } else {
      hoursToAdvance = (12 - previousHour) + targetHour;
    }

    console.log(`[XELOR] Setting dial hour from ${previousHour} to ${targetHour} (${hoursToAdvance > 0 ? '+' : ''}${hoursToAdvance}h)`);

    this.advanceDialHour(context, hoursToAdvance);
  }
}
