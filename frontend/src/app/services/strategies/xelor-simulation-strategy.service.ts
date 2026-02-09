/**
 * Stratégie de simulation spécifique au Xelor
 * Gère les mécanismes, passifs et conditions de sorts propres au Xelor
 */

import { Injectable, inject } from '@angular/core';
import { ClassSimulationStrategy, ClassValidationResult } from './class-simulation-strategy.interface';
import { Spell } from '../../models/spell.model';
import { Position, TimelineAction } from '../../models/timeline.model';
import { SimulationContext, SimulationActionResult, DelayedEffect } from '../calculators/simulation-engine.service';
import { Build } from '../../models/build.model';
import { TotalStats } from '../calculators/stats-calculator.service';
import { Mechanism } from '../../models/board.model';
import { BoardService } from '../board.service';
import { ResourceRegenerationService } from '../processors/resource-regeneration.service';
import { isSpellMechanism, getSpellMechanismType, getMechanismImagePath } from '../../utils/mechanism-utils';

@Injectable({
  providedIn: 'root'
})
export class XelorSimulationStrategy extends ClassSimulationStrategy {

  readonly classId = 'XEL';

  private readonly boardService = inject(BoardService);
  private readonly regenerationService = inject(ResourceRegenerationService);

  /**
   * Vérifie les conditions de lancement spécifiques au Xelor
   */
  validateClassSpecificCasting(
    spell: Spell,
    casterPosition: Position,
    targetPosition: Position,
    context: SimulationContext
  ): ClassValidationResult {
    const mechanismType = getSpellMechanismType(spell.id);

    // Validation: 1 cadran par tour maximum
    if (mechanismType === 'dial') {
      const dialsPlacedThisTurn = context.mechanismsPlacedThisTurn?.get('dial') || 0;
      if (dialsPlacedThisTurn >= 1) {
        console.log(`[XELOR] ❌ Cadran déjà posé ce tour (${dialsPlacedThisTurn}/1)`);
        return {
          canCast: false,
          reason: 'Un seul Cadran peut être posé par tour'
        };
      }
    }

    // Validation spécifique pour le Régulateur
    if (mechanismType === 'regulateur') {
      // Le régulateur ne peut être posé QUE sur les cases heures du cadran
      const isOnDialHour = this.boardService.isPositionOnDialHour(targetPosition);

      if (!isOnDialHour) {
        console.log(`[XELOR] ❌ Régulateur cannot be placed: target position (${targetPosition.x}, ${targetPosition.y}) is not on a dial hour`);
        return {
          canCast: false,
          reason: 'Le Régulateur ne peut être posé que sur les heures du cadran'
        };
      }

      // Vérifier qu'il y a un cadran actif
      const dials = this.boardService.getMechanismsByType('dial');
      if (dials.length === 0) {
        console.log(`[XELOR] ❌ Régulateur cannot be placed: no active dial on board`);
        return {
          canCast: false,
          reason: 'Le Régulateur nécessite un Cadran actif sur le plateau'
        };
      }

      console.log(`[XELOR] ✅ Régulateur can be placed on dial hour at (${targetPosition.x}, ${targetPosition.y})`);
    }

    // TODO: Ajouter d'autres validations spécifiques
    // - Certains sorts ont des conditions basées sur les heures du cadran

    return {
      canCast: true
    };
  }

  /**
   * Traite les effets spécifiques au Xelor après le lancement d'un sort
   */
  processClassSpecificEffects(
    spell: Spell,
    action: TimelineAction,
    context: SimulationContext,
    actionResult: SimulationActionResult
  ): void {
    console.log(`[XELOR] Processing class-specific effects for spell: ${spell.name}`);

    // Si le sort est un mécanisme, activer l'aura correspondante
    const mechanismType = getSpellMechanismType(spell.id);
    if (mechanismType && actionResult.success) {
      this.activateMechanismAura(mechanismType, context);

      // Si c'est un cadran, initialiser l'heure courante
      if (mechanismType === 'dial' && actionResult.details?.mechanismId) {
        context.dialId = actionResult.details.mechanismId;
        context.currentDialHour = 12; // Heure XII par défaut
        context.dialFirstLoopCompleted = false; // Le cadran vient d'être posé, pas encore de tour complet
        console.log(`[XELOR] Dial activated - current hour set to ${context.currentDialHour}, first loop not yet completed`);
      }
    }

    // Avancer l'heure du cadran selon le PW dépensé (1h par PW)
    // Cela s'applique à TOUS les sorts qui coûtent du PW
    console.log(`[XELOR] 🔍 Checking PW advancement: pwCost=${spell.pwCost}, success=${actionResult.success}, dialId=${context.dialId}, currentHour=${context.currentDialHour}`);
    if (spell.pwCost > 0 && actionResult.success && context.dialId) {
      this.advanceDialHourByPwCost(spell.pwCost, context);
    } else if (spell.pwCost > 0 && actionResult.success && !context.dialId) {
      console.log(`[XELOR] ⚠️ Cannot advance dial hour: no dialId in context (spell: ${spell.name})`);
    }

    // Ajouter des charges aux mécanismes selon le PW dépensé
    // Certains sorts comme Horloge ajoutent 1 charge par PW dépensé à tous les mécanismes
    if (spell.pwCost > 0 && actionResult.success) {
      this.addChargesFromPwSpent(spell.pwCost, context);
    }

    // Traiter les sorts qui téléportent sur une heure du cadran
    // Cela pourrait déclencher l'effet Ponctualité (+50% DI)
    if (action.targetPosition && context.dialId) {
      const hour = this.boardService.getDialHourAtPosition(action.targetPosition, context.dialId);
      if (hour !== null && hour === context.currentDialHour) {
        console.log(`[XELOR] Player on current hour (${hour}) - Ponctualité may apply`);
        // TODO: Appliquer le buff Ponctualité (+50% DI pour le tour)
      }
    }

    // 🆕 Enregistrer les effets différés du sort (ON_END_TURN, ON_TARGET_TURN_START, etc.)
    // Ces effets seront résolus immédiatement lors d'un tour de cadran si le passif "Maître du Cadran" est actif
    if (actionResult.success) {
      this.registerSpellDelayedEffects(spell, action, context);
    }
  }

  /**
   * Enregistre les effets différés d'un sort
   * Les effets avec phase ON_END_TURN, ON_TARGET_TURN_START, ON_TARGET_TURN_END
   * sont enregistrés comme effets différés pour être résolus plus tard
   * (ou immédiatement lors d'un tour de cadran avec le passif "Maître du Cadran")
   */
  private registerSpellDelayedEffects(
    spell: Spell,
    action: TimelineAction,
    context: SimulationContext
  ): void {
    // Phases considérées comme "différées"
    const delayedPhases = ['ON_END_TURN', 'ON_TARGET_TURN_START', 'ON_TARGET_TURN_END'];

    // Utiliser la variante NORMAL par défaut (TODO: gérer les crits)
    const variant = spell.variants.find(v => v.kind === 'NORMAL');
    if (!variant) {
      console.log(`[XELOR DELAYED] ⚠️ No NORMAL variant found for spell ${spell.name}`);
      return;
    }

    // Filtrer les effets différés
    const delayedEffects = variant.effects.filter(effect =>
      effect.phase && delayedPhases.includes(effect.phase)
    );

    if (delayedEffects.length === 0) {
      console.log(`[XELOR DELAYED] ℹ️ No delayed effects for spell ${spell.name}`);
      return;
    }

    console.log(`[XELOR DELAYED] 📦 Found ${delayedEffects.length} delayed effect(s) for spell ${spell.name}`);

    // Position du lanceur et de la cible
    const playerEntity = this.boardService.player();
    const casterPosition = playerEntity?.position || context.playerPosition || { x: 0, y: 0 };
    const targetPosition = action.targetPosition || casterPosition;

    // Enregistrer chaque effet différé
    for (const effect of delayedEffects) {
      // Extraire le montant - peut être dans extendedData.amount, minValue ou maxValue
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
   * Avance l'heure du cadran selon le coût en PW d'un sort
   * L'heure courante avance de 1 par PW dépensé
   */
  private advanceDialHourByPwCost(pwCost: number, context: SimulationContext): void {
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
   * Active l'aura correspondant à un type de mécanisme
   */
  private activateMechanismAura(mechanismType: string, context: SimulationContext): void {
    if (!context.activeAuras) {
      context.activeAuras = new Set();
    }

    switch (mechanismType) {
      case 'cog':
        context.activeAuras.add('ROUAGE_AURA');
        console.log(`[XELOR] ✅ ROUAGE_AURA activated`);
        break;
      case 'sinistro':
        context.activeAuras.add('SINISTRO_AURA');
        console.log(`[XELOR] ✅ SINISTRO_AURA activated`);
        break;
      case 'dial':
        context.activeAuras.add('DIAL_AURA');
        console.log(`[XELOR] ✅ DIAL_AURA activated`);
        break;
      case 'regulateur':
        context.activeAuras.add('REGULATOR_PW_AURA');
        console.log(`[XELOR] ✅ REGULATOR_PW_AURA activated`);
        break;
    }
  }

  /**
   * Ajoute des charges aux mécanismes en fonction du PW dépensé
   * Certains sorts comme Horloge ajoutent 1 charge par PW à tous les mécanismes
   */
  private addChargesFromPwSpent(pwCost: number, context: SimulationContext): void {
    // Note: Dans le jeu réel, seuls certains sorts ajoutent des charges
    // Pour l'instant, on implémente une règle générique
    // TODO: Raffiner selon les sorts spécifiques (ex: Horloge uniquement)

    const mechanisms = this.boardService.mechanisms();
    mechanisms.forEach(mechanism => {
      // Les mécanismes peuvent avoir une limite de charges
      const maxCharges = this.getMechanismMaxCharges(mechanism.type);
      const currentCharges = context.mechanismCharges?.get(mechanism.id) || 0;

      if (currentCharges < maxCharges) {
        const chargesToAdd = Math.min(pwCost, maxCharges - currentCharges);
        this.boardService.addCharges(mechanism.id, chargesToAdd);
        context.mechanismCharges?.set(mechanism.id, currentCharges + chargesToAdd);
        console.log(`[XELOR] Added ${chargesToAdd} charges to ${mechanism.type} from PW cost`);
      }
    });
  }

  /**
   * Retourne le nombre maximum de charges pour un type de mécanisme
   */
  private getMechanismMaxCharges(type: string): number {
    switch (type) {
      case 'cog': return 10; // Rouage: max 10 charges
      case 'sinistro': return 20; // Sinistro: max 20 charges (estimation)
      case 'dial': return 12; // Cadran: 12 heures
      case 'regulateur': return 0; // Régulateur n'a pas de charges
      default: return 10;
    }
  }

  /**
   * Gère les mécanismes existants avant d'en poser un nouveau
   * Règles:
   * - Cadran: 1 seul max, remplace l'ancien (supprime aussi les heures du cadran)
   * - Régulateur: 1 seul max, remplace l'ancien
   * - Rouage: 1 max par défaut, 2 max avec passif "Rémanence" (supprime le plus ancien si limite atteinte)
   * - Sinistro: 1 max par défaut, 2 max avec passif "Rémanence" (supprime le plus ancien si limite atteinte)
   */
  private handleExistingMechanisms(mechanismType: 'cog' | 'sinistro' | 'dial' | 'regulateur', context: SimulationContext): void {
    const existingMechanisms = this.boardService.getMechanismsByType(mechanismType);
    const maxAllowed = this.getMaxMechanismsAllowed(mechanismType, context);

    console.log(`[XELOR] Handling existing ${mechanismType}s: ${existingMechanisms.length} existing, max allowed: ${maxAllowed}`);

    if (existingMechanisms.length >= maxAllowed) {
      // Supprimer le(s) mécanisme(s) le(s) plus ancien(s) jusqu'à avoir de la place
      const toRemove = existingMechanisms.length - maxAllowed + 1;

      for (let i = 0; i < toRemove; i++) {
        const mechanismToRemove = existingMechanisms[i];
        console.log(`[XELOR] 🗑️ Removing old ${mechanismType}: ${mechanismToRemove.id}`);

        // Si c'est un cadran, supprimer aussi les heures associées et réinitialiser l'état
        if (mechanismType === 'dial') {
          this.boardService.removeDialHoursForDial(mechanismToRemove.id);
          this.boardService.resetDialState();
          context.dialId = undefined;
          context.currentDialHour = undefined;
          console.log(`[XELOR] 🗑️ Removed dial hours and reset dial state`);
        }

        // Supprimer le mécanisme du plateau
        this.boardService.removeMechanism(mechanismToRemove.id);

        // Supprimer les charges du contexte
        context.mechanismCharges?.delete(mechanismToRemove.id);
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
        return 1; // Toujours 1 seul cadran
      case 'regulateur':
        return 1; // Toujours 1 seul régulateur
      case 'cog':
        return hasRemanence ? 2 : 1; // 2 rouages avec Rémanence, sinon 1
      case 'sinistro':
        return hasRemanence ? 2 : 1; // 2 sinistros avec Rémanence, sinon 1
      default:
        return 1;
    }
  }

  /**
   * Applique les passifs spécifiques au Xelor
   */
  applyClassPassives(
    build: Build,
    baseStats: TotalStats,
    context: SimulationContext
  ): TotalStats {
    const modifiedStats = { ...baseStats };

    // TODO: Implémenter l'application des passifs Xelor
    // Exemples:
    // - Rémanence: +1 sinistro et +1 rouage sur le terrain. Les invocations ne cache plus la ligne de vue

    return modifiedStats;
  }

  /**
   * Calcule le coût supplémentaire en ressources pour un sort basé sur les passifs actifs
   * Implémente l'effet "Connaissance du passé": Le Cadran coûte +2 PW supplémentaires
   */
  public override getSpellExtraCost(spell: Spell, context: SimulationContext): { extraPaCost: number; extraPwCost: number } {
    let extraPaCost = 0;
    let extraPwCost = 0;

    // Passif "Connaissance du passé": Le Cadran coûte +2 PW
    if (this.hasConnaissancePassePassive(context)) {
      // Vérifier si c'est le sort Cadran (plusieurs IDs possibles)
      const isDialSpell = spell.id.toLowerCase().includes('cadran') ||
                          spell.id === 'XEL_CADRAN' ||
                          spell.id === 'xel_cadran';

      if (isDialSpell) {
        extraPwCost += 2;
        console.log(`[XELOR CONNAISSANCE_PASSE] 💰 Cadran extra cost: +2 PW (total PW: ${spell.pwCost + extraPwCost})`);
      }
    }

    return { extraPaCost, extraPwCost };
  }

  /**
   * Vérifie si un sort est un sort de mécanisme Xelor
   */
  isClassMechanismSpell(spellId: string): boolean {
    return isSpellMechanism(spellId);
  }

  /**
   * Exécute un sort de mécanisme Xelor (Rouage, Cadran, Sinistro, Régulateur)
   */
  executeClassMechanismSpell(
    action: TimelineAction,
    context: SimulationContext,
    spell: Spell,
    paCost: number,
    pwCost: number
  ): SimulationActionResult {
    console.log(`[XELOR MECHANISM] executeMechanismSpell for: ${spell.id} (${spell.name})`);

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

    const imageUrl = 'http://localhost:8080/' + getMechanismImagePath(mechanismType, 0);

    console.log(`[XELOR] Mechanism type found:`, {
      type: mechanismType,
      imageUrl: imageUrl
    });

    // Vérifier que la position cible est fournie
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

    // Gérer les mécanismes existants selon les règles
    this.handleExistingMechanisms(mechanismType, context);

    // Créer le mécanisme
    const mechanism: Mechanism = {
      id: `${mechanismType}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: mechanismType,
      position: action.targetPosition,
      charges: 0,
      spellId: spell.id
    };

    console.log(`[XELOR] Mechanism object created:`, mechanism);

    // Ajouter le mécanisme au plateau via le BoardService
    this.boardService.addMechanism(mechanism);

    // Incrémenter le compteur de mécanismes posés ce tour
    if (!context.mechanismsPlacedThisTurn) {
      context.mechanismsPlacedThisTurn = new Map<string, number>();
    }
    const currentCount = context.mechanismsPlacedThisTurn.get(mechanismType) || 0;
    context.mechanismsPlacedThisTurn.set(mechanismType, currentCount + 1);
    console.log(`[XELOR] 📊 ${mechanismType} posé ce tour: ${currentCount + 1}`);

    console.log(`[XELOR] Mechanism ${spell.name} placed at (${action.targetPosition.x}, ${action.targetPosition.y})`);

    // Si c'est un cadran, créer les 12 heures autour et téléporter le joueur sur l'heure 6
    if (mechanismType === 'dial') {
      const playerEntity = this.boardService.player();
      const playerPosition = playerEntity?.position || context.playerPosition || { x: 6, y: 6 };

      // Créer les 12 heures autour du cadran
      this.createDialHours(mechanism.id, action.targetPosition, playerPosition);

      // Définir l'heure courante à 12 dans le BoardService
      this.boardService.setCurrentDialHour(12, mechanism.id);

      // Téléporter le joueur sur l'heure 6
      const teleported = this.boardService.teleportPlayerToDialHour(6, mechanism.id);
      if (teleported) {
        console.log(`[XELOR] 🌀 Player automatically teleported to hour 6`);

        // Mettre à jour le contexte avec la nouvelle position du joueur (heure 6, PAS 12)
        const newPosition = this.boardService.getDialHourPosition(6, mechanism.id);
        if (newPosition) {
          context.playerPosition = newPosition;
          context.currentPosition = newPosition;

          // IMPORTANT: Mettre à jour aussi la position dans context.entities
          // sinon le joueur "fantôme" à l'ancienne position bloquera la ligne de vue
          if (context.entities) {
            const playerEntityInContext = context.entities.find(e => e.type === 'player');
            if (playerEntityInContext) {
              playerEntityInContext.position = newPosition;
              console.log(`[XELOR] 📍 Player entity in context.entities also updated to (${newPosition.x}, ${newPosition.y})`);
            }
          }

          console.log(`[XELOR] 📍 Context updated with new player position: (${newPosition.x}, ${newPosition.y})`);
        }
      }

      // Initialiser l'heure courante dans le contexte
      context.currentDialHour = 12;
      context.dialId = mechanism.id;
      context.dialFirstLoopCompleted = false; // Cadran fraîchement posé
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

  /**
   * Initialise le contexte avec les données spécifiques au Xelor
   */
  initializeClassContext(context: SimulationContext, build: Build): void {
    console.log('[XELOR] Initializing class context');

    // Initialiser les structures de données Xélor
    context.mechanismCharges = new Map<string, number>();
    context.activeAuras = new Set<string>();
    context.currentDialHour = undefined;
    context.dialId = undefined;
    context.delayedEffects = []; // Effets différés pour Maître du Cadran

    // Charger les mécanismes existants et leurs charges
    const mechanisms = this.boardService.mechanisms();
    mechanisms.forEach(mechanism => {
      const charges = mechanism.charges || 0;
      context.mechanismCharges!.set(mechanism.id, charges);
      console.log(`[XELOR] Loaded mechanism ${mechanism.type} (${mechanism.id}): ${charges} charges`);
    });

    // Vérifier s'il y a un cadran actif
    const dials = this.boardService.getMechanismsByType('dial');
    if (dials.length > 0) {
      const dial = dials[0]; // On prend le premier cadran (max 1 normalement)
      context.dialId = dial.id;
      context.currentDialHour = 12; // Heure initiale (XII - où le Xélor est téléporté)
      context.dialFirstLoopCompleted = false; // Le premier tour n'est pas encore complété
      context.activeAuras!.add('DIAL_AURA');
      console.log(`[XELOR] Active dial found (${dial.id}), current hour: ${context.currentDialHour}, first loop not yet completed`);
    }

    // Vérifier les autres mécanismes pour ajouter leurs auras
    const rouages = this.boardService.getMechanismsByType('cog');
    if (rouages.length > 0) {
      context.activeAuras!.add('ROUAGE_AURA');
      console.log(`[XELOR] ${rouages.length} Rouage(s) found - ROUAGE_AURA activated`);
    }

    const sinistros = this.boardService.getMechanismsByType('sinistro');
    if (sinistros.length > 0) {
      context.activeAuras!.add('SINISTRO_AURA');
      console.log(`[XELOR] ${sinistros.length} Sinistro(s) found - SINISTRO_AURA activated`);
    }

    const regulateurs = this.boardService.getMechanismsByType('regulateur');
    if (regulateurs.length > 0) {
      context.activeAuras!.add('REGULATOR_PW_AURA');
      console.log(`[XELOR] Régulateur found - REGULATOR_PW_AURA activated`);
    }

    console.log(`[XELOR] Context initialized - ${context.mechanismCharges!.size} mechanisms, ${context.activeAuras!.size} auras`);
  }

  /**
   * Nettoie les données spécifiques au Xelor à la fin d'un tour
   */
  cleanupTurn(context: SimulationContext): void {
    console.log('[XELOR] Cleaning up turn');

    // 1. Appliquer les effets de fin de tour des mécanismes
    this.applyEndOfTurnMechanismEffects(context);

    // 2. Avancer l'heure du cadran (si présent)
    if (context.dialId && context.currentDialHour !== undefined) {
      this.advanceDialHour(context);
    }

    // 3. Appliquer le bonus PW du Régulateur en fin de tour
    this.applyRegulatorPwBonus(context);

    // TODO: Décrémenter les durées de buffs temporaires
    // TODO: Réinitialiser certains compteurs
  }

  /**
   * Applique le bonus +1 PW du Régulateur si présent en fin de tour
   * Le Xelor gagne +1 PW par Régulateur présent sur le plateau à la fin de son tour
   * Utilise le service centralisé ResourceRegenerationService
   */
  private applyRegulatorPwBonus(context: SimulationContext): void {
    // Déléguer au service centralisé qui gère tout
    this.regenerationService.applyRegulateurRegeneration(context);
  }

  /**
   * Applique les effets de fin de tour des mécanismes
   */
  private applyEndOfTurnMechanismEffects(context: SimulationContext): void {
    console.log('[XELOR] Applying end-of-turn mechanism effects');

    // Rouage: Inflige des dégâts Lumière en croix (range 2)
    if (context.activeAuras?.has('ROUAGE_AURA')) {
      this.applyRouageDamage(context);
    }

    // Sinistro: Soigne les alliés adjacents
    if (context.activeAuras?.has('SINISTRO_AURA')) {
      this.applySinistroHealing(context);
    }

    // TODO: Autres effets de fin de tour
  }

  /**
   * Applique les dégâts du Rouage (fin de tour)
   */
  private applyRouageDamage(context: SimulationContext): void {
    const rouages = this.boardService.getMechanismsByType('cog');

    rouages.forEach(rouage => {
      const charges = context.mechanismCharges?.get(rouage.id) || 0;
      const damage = Math.min(charges, 10) * 20; // 20 dégâts par charge, max 10 charges

      if (damage > 0) {
        console.log(`[XELOR] ⚡ Rouage (${rouage.id}) deals ${damage} Light damage (${charges} charges)`);
        // TODO: Appliquer les dégâts aux ennemis dans la zone (croix, range 2)
        // Pour l'instant, on log simplement
      }
    });
  }

  /**
   * Applique les soins du Sinistro (fin de tour)
   * Utilise le service centralisé ResourceRegenerationService pour la régénération de PA
   */
  private applySinistroHealing(context: SimulationContext): void {
    const sinistros = this.boardService.getMechanismsByType('sinistro');

    sinistros.forEach(sinistro => {
      const charges = context.mechanismCharges?.get(sinistro.id) || 0;

      if (charges > 0) {
        console.log(`[XELOR] 💚 Sinistro (${sinistro.id}) heals adjacent allies (${charges} charges)`);
        // TODO: Calculer et appliquer les soins aux alliés adjacents
        // Soins = 2% PV manquant par charge
      }
    });

    // Déléguer la régénération de PA au service centralisé
    this.regenerationService.applySinistroRegeneration(context);
  }

  /**
   * Avance l'heure du cadran et déclenche les effets associés
   */
  private advanceDialHour(context: SimulationContext, hoursToAdvance: number = 1): void {
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
   * Modifie directement l'heure du cadran (utilisé par les sorts comme Désynchronisation, Distorsion)
   * Cette méthode peut faire avancer ou reculer l'heure de plusieurs positions
   *
   * @param context Le contexte de simulation
   * @param hours Nombre d'heures à avancer (positif) ou reculer (négatif)
   */
  public setDialHourOffset(context: SimulationContext, hours: number): void {
    if (!context.dialId || context.currentDialHour === undefined) {
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
    if (!context.dialId || context.currentDialHour === undefined) {
      console.warn(`[XELOR] Cannot set dial hour: no active dial`);
      return;
    }

    if (targetHour < 1 || targetHour > 12) {
      console.error(`[XELOR] Invalid target hour: ${targetHour} (must be 1-12)`);
      return;
    }

    const previousHour = context.currentDialHour;

    // Calculer le nombre d'heures à avancer pour atteindre l'heure cible
    let hoursToAdvance: number;
    if (targetHour >= previousHour) {
      hoursToAdvance = targetHour - previousHour;
    } else {
      // On doit passer par 12→1 pour atteindre la cible
      hoursToAdvance = (12 - previousHour) + targetHour;
    }

    console.log(`[XELOR] Setting dial hour from ${previousHour} to ${targetHour} (${hoursToAdvance > 0 ? '+' : ''}${hoursToAdvance}h)`);

    this.advanceDialHour(context, hoursToAdvance);
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

  /**
   * Traite les effets de tour de cadran (hour wrap)
   * Un tour de cadran se produit lorsque l'heure courante fait un tour complet (passe par 12→1)
   */
  public override processHourWrap(context: SimulationContext): void {
    console.log('[XELOR] 🔄 Processing hour wrap effects (dial completed a full rotation)');

    // Vérifier si c'est le premier tour de cadran après la pose
    const isFirstLoop = !context.dialFirstLoopCompleted;

    if (isFirstLoop) {
      console.log('[XELOR] 🔄 First hour wrap since dial placement - marking first loop as completed');
      context.dialFirstLoopCompleted = true;
    }

    // Les Rouages infligent des dégâts supplémentaires (status_effect avec tick_phase = ON_HOUR_WRAPPED)
    if (context.activeAuras?.has('ROUAGE_AURA')) {
      this.applyRouageDamage(context);
    }

    // Les Sinistros soignent à nouveau (status_effect avec tick_phase = ON_HOUR_WRAPPED)
    if (context.activeAuras?.has('SINISTRO_AURA')) {
      this.applySinistroHealing(context);
    }

    // Passif "Connaissance du passé" (XEL_CONNAISSANCE_PASSE):
    // Quand l'heure courante fait un tour complet du cadran, régénère 2 PA et 2 PW
    // IMPORTANT: Ne se déclenche PAS au premier passage de 12 à 1 après la pose du cadran
    if (this.hasConnaissancePassePassive(context)) {
      if (isFirstLoop) {
        console.log('[XELOR CONNAISSANCE_PASSE] ⏳ First loop after dial placement - Connaissance du passé does NOT trigger');
      } else {
        this.applyConnaissancePasseRegeneration(context);
      }
    }

    // Passif "Maître du Cadran" (XEL_MAITRE_CADRAN):
    // Quand l'heure courante fait un tour complet du cadran,
    // les effets délayés (ON_END_TURN, ON_TARGET_TURN_START, etc.) se résolvent immédiatement
    if (this.hasMaitreDuCadranPassive(context)) {
      this.resolveDelayedEffects(context);
    }
  }

  // ============================================
  // PASSIF "MAÎTRE DU CADRAN" - RESOLVE_DELAYED_EFFECTS
  // Correspond à: passive_effect.effect_type = 'RESOLVE_DELAYED_EFFECTS'
  // avec trigger = 'ON_HOUR_WRAPPED'
  // ============================================

  /** Liste des IDs possibles pour le passif Maître du Cadran */
  private static readonly MAITRE_DU_CADRAN_IDS = [
    'maitre_du_cadran',
    'XEL_MAITRE_CADRAN',      // ID correct dans la base de données
    'XEL_MAITRE_DU_CADRAN',   // Variante possible
    'master_of_dial',
    'maitre-du-cadran',
    'maitreducadran'
  ];

  /** Liste des IDs possibles pour le passif Connaissance du passé */
  private static readonly CONNAISSANCE_PASSE_IDS = [
    'connaissance_passe',
    'XEL_CONNAISSANCE_PASSE',
    'connaissance_du_passe',
    'connaissance-du-passe',
    'connaissancedupasse'
  ];

  /**
   * Vérifie si le passif "Maître du Cadran" est actif
   * Ce passif permet de résoudre les effets différés lors d'un tour de cadran
   */
  private hasMaitreDuCadranPassive(context: SimulationContext): boolean {
    const passiveIds = context.activePassiveIds || [];
    console.log(`[XELOR MAITRE_CADRAN] 🔍 Checking for Maître du Cadran passive...`);
    console.log(`[XELOR MAITRE_CADRAN]    Active passive IDs in context: [${passiveIds.join(', ')}]`);
    console.log(`[XELOR MAITRE_CADRAN]    Looking for any of: [${XelorSimulationStrategy.MAITRE_DU_CADRAN_IDS.join(', ')}]`);

    const found = XelorSimulationStrategy.MAITRE_DU_CADRAN_IDS.some(id =>
      passiveIds.some(activeId => activeId.toLowerCase() === id.toLowerCase())
    );

    console.log(`[XELOR MAITRE_CADRAN]    Result: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  }

  /**
   * Vérifie si le passif "Connaissance du passé" est actif
   * Ce passif :
   * - Régénère 2 PA et 2 PW à chaque tour de cadran
   * - Le Cadran coûte +2 PW supplémentaires
   */
  private hasConnaissancePassePassive(context: SimulationContext): boolean {
    const passiveIds = context.activePassiveIds || [];
    return XelorSimulationStrategy.CONNAISSANCE_PASSE_IDS.some(id =>
      passiveIds.some(activeId => activeId.toLowerCase() === id.toLowerCase())
    );
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
    // On enregistre l'effet même si le passif n'est pas actif
    // (il sera simplement résolu à son moment normal, pas sur hour wrap)
    if (!context.delayedEffects) {
      context.delayedEffects = [];
    }

    // Générer un ID unique si non fourni
    if (!effect.id) {
      effect.id = `delayed_${effect.spellId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    // Enregistrer le tour si non fourni
    if (!effect.registeredOnTurn) {
      effect.registeredOnTurn = context.turn || 1;
    }

    context.delayedEffects.push(effect);

    const willResolveOnHourWrap = this.hasMaitreDuCadranPassive(context);
    console.log(`[XELOR DELAYED] ✅ Registered delayed effect: ${effect.spellName}`);
    console.log(`[XELOR DELAYED]    Effect type: ${effect.effectType}, Phase: ${effect.originalPhase}`);
    console.log(`[XELOR DELAYED]    Target scope: ${effect.targetScope}`);
    console.log(`[XELOR DELAYED]    Will resolve on hour wrap: ${willResolveOnHourWrap ? 'YES (Maître du Cadran active)' : 'NO'}`);
    console.log(`[XELOR DELAYED] 📋 Total delayed effects: ${context.delayedEffects.length}`);

    return true;
  }

  /**
   * Résout tous les effets différés enregistrés
   * Appelé lors d'un tour de cadran si le passif "Maître du Cadran" est actif
   *
   * Correspond à l'effet 'RESOLVE_DELAYED_EFFECTS' avec params: {"owner":"CASTER"}
   */
  private resolveDelayedEffects(context: SimulationContext): void {
    if (!context.delayedEffects || context.delayedEffects.length === 0) {
      console.log(`[XELOR MAITRE_CADRAN] 📭 No delayed effects to resolve`);
      return;
    }

    console.log(`[XELOR MAITRE_CADRAN] ⚡ RESOLVE_DELAYED_EFFECTS triggered on ON_HOUR_WRAPPED`);
    console.log(`[XELOR MAITRE_CADRAN] 📋 Resolving ${context.delayedEffects.length} delayed effect(s)...`);

    // Copier le tableau pour éviter les modifications pendant l'itération
    const effectsToResolve = [...context.delayedEffects];

    // Vider le tableau des effets différés
    context.delayedEffects = [];

    effectsToResolve.forEach((effect, index) => {
      console.log(`[XELOR MAITRE_CADRAN] 🎯 Resolving effect ${index + 1}/${effectsToResolve.length}:`);
      console.log(`[XELOR MAITRE_CADRAN]    Spell: ${effect.spellName}`);
      console.log(`[XELOR MAITRE_CADRAN]    Effect type: ${effect.effectType}`);
      console.log(`[XELOR MAITRE_CADRAN]    Original phase: ${effect.originalPhase}`);
      console.log(`[XELOR MAITRE_CADRAN]    Target: (${effect.targetPosition.x}, ${effect.targetPosition.y})`);

      this.executeEffect(effect, context);
    });

    console.log(`[XELOR MAITRE_CADRAN] ✅ All delayed effects resolved!`);
  }

  /**
   * Exécute un effet selon son type (correspond à effect_type dans la table spell_effect)
   */
  private executeEffect(effect: DelayedEffect, context: SimulationContext): void {
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

  // ============================================
  // PASSIF "CONNAISSANCE DU PASSÉ" - REGENERATION
  // Correspond à: passive_effect.effect_type = 'ADD_AP' et 'ADD_PW'
  // avec trigger = 'ON_HOUR_WRAPPED'
  // ============================================

  /**
   * Applique la régénération du passif "Connaissance du passé"
   * À chaque tour de cadran : +2 PA et +2 PW
   */
  private applyConnaissancePasseRegeneration(context: SimulationContext): void {
    console.log('[XELOR CONNAISSANCE_PASSE] ⚡ Triggering Connaissance du passé regeneration on ON_HOUR_WRAPPED');

    // Régénérer 2 PA
    this.regenerationService.regeneratePA(
      context,
      2,
      'CONNAISSANCE_PASSE',
      'Connaissance du passé: +2 PA (tour de cadran)',
      { trigger: 'ON_HOUR_WRAPPED' }
    );

    // Régénérer 2 PW
    this.regenerationService.regeneratePW(
      context,
      2,
      'CONNAISSANCE_PASSE',
      'Connaissance du passé: +2 PW (tour de cadran)',
      { trigger: 'ON_HOUR_WRAPPED' }
    );

    console.log('[XELOR CONNAISSANCE_PASSE] ✅ Regeneration complete: +2 PA, +2 PW');
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
   * Retourne le nombre d'effets différés en attente
   */
  public getDelayedEffectsCount(context: SimulationContext): number {
    return context.delayedEffects?.length || 0;
  }

  /**
   * Vide tous les effets différés sans les exécuter
   */
  public clearDelayedEffects(context: SimulationContext): void {
    const count = context.delayedEffects?.length || 0;
    context.delayedEffects = [];
    console.log(`[XELOR MAITRE_CADRAN] 🗑️ Cleared ${count} delayed effect(s)`);
  }

  /**
   * Vérifie si le passif Maître du Cadran est actif (méthode publique)
   */
  public isMaitreDuCadranActive(context: SimulationContext): boolean {
    return this.hasMaitreDuCadranPassive(context);
  }

  /**
   * Crée les 12 heures autour d'un cadran, orientées selon la direction du lancer
   */
  private createDialHours(dialId: string, centerPosition: Position, playerPosition: Position): void {
    console.log(`[XELOR DIAL] Creating 12 hours around dial at (${centerPosition.x}, ${centerPosition.y})`);
    console.log(`[XELOR DIAL] Player position: (${playerPosition.x}, ${playerPosition.y})`);

    // Calculer la direction du lancer
    const dx = centerPosition.x - playerPosition.x;
    const dy = centerPosition.y - playerPosition.y;

    console.log(`[XELOR DIAL] Direction vector: (${dx}, ${dy})`);

    // Déterminer la rotation à appliquer
    let rotation = 0;
    let directionName = '';

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        rotation = 1;
        directionName = 'DROITE (Est)';
      } else {
        rotation = 3;
        directionName = 'GAUCHE (Ouest)';
      }
    } else {
      if (dy > 0) {
        rotation = 2;
        directionName = 'BAS (Sud)';
      } else {
        rotation = 0;
        directionName = 'HAUT (Nord)';
      }
    }

    console.log(`[XELOR DIAL] Direction: ${directionName}, Rotation: ${rotation * 90}°`);

    // Positions de base des heures (12h vers le HAUT/NORD par défaut)
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

      // Rotation par quarts de tour (sens horaire)
      for (let i = 0; i < rotation; i++) {
        const tempX = rotatedX;
        rotatedX = -rotatedY;
        rotatedY = tempX;
      }

      const hourPosition: Position = {
        x: centerPosition.x + rotatedX,
        y: centerPosition.y + rotatedY
      };

      // Vérifier que la position est dans les limites du plateau (13x13)
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
   * Vérifie si les dégâts doivent être redirigés vers le Régulateur
   * Tous les dégâts subis par les mécanismes (Rouage, Sinistro, Cadran) sont redirigés vers le Régulateur
   *
   * @param targetMechanismType Le type de mécanisme ciblé
   * @returns true si les dégâts doivent être redirigés
   */
  shouldRedirectDamageToRegulator(targetMechanismType: string): boolean {
    // Seuls les mécanismes "non-régulateur" redirigent leurs dégâts
    if (targetMechanismType === 'regulateur') {
      return false;
    }

    // Vérifier s'il y a un Régulateur actif sur le plateau
    const regulateurs = this.boardService.getMechanismsByType('regulateur');
    return regulateurs.length > 0;
  }

  /**
   * Redirige les dégâts d'un mécanisme vers le Régulateur
   * Le Régulateur absorbe tous les coups destinés aux autres mécanismes
   *
   * @param damage Les dégâts à rediriger
   * @param sourceMechanismId L'ID du mécanisme initialement ciblé
   * @param context Le contexte de simulation
   * @returns L'ID du Régulateur qui a reçu les dégâts, ou null si pas de redirection
   */
  redirectDamageToRegulator(
    damage: number,
    sourceMechanismId: string,
    context: SimulationContext
  ): { regulatorId: string; damageDealt: number } | null {
    const regulateurs = this.boardService.getMechanismsByType('regulateur');

    if (regulateurs.length === 0) {
      console.log(`[XELOR] ❌ No Régulateur to redirect damage to`);
      return null;
    }

    // Prendre le premier Régulateur (normalement il n'y en a qu'un)
    const regulateur = regulateurs[0];

    console.log(`[XELOR] 🔄 Redirecting ${damage} damage from mechanism ${sourceMechanismId} to Régulateur ${regulateur.id}`);
    console.log(`[XELOR] 📍 Régulateur at position (${regulateur.position.x}, ${regulateur.position.y})`);

    // Appliquer les dégâts au Régulateur
    // Dans le jeu, le Régulateur a des PV comme les autres mécanismes
    // Pour l'instant, on log simplement le dommage
    // TODO: Implémenter un système de PV pour les mécanismes

    return {
      regulatorId: regulateur.id,
      damageDealt: damage
    };
  }

  /**
   * Calcule les dégâts qu'un mécanisme devrait recevoir (avant redirection)
   * Utilisé pour savoir combien de dégâts seront redirigés vers le Régulateur
   *
   * @param mechanismId L'ID du mécanisme ciblé
   * @param baseDamage Les dégâts de base de l'attaque
   * @returns Les dégâts finaux après calculs
   */
  calculateMechanismDamage(mechanismId: string, baseDamage: number): number {
    // Les mécanismes n'ont pas de résistance, les dégâts sont appliqués directement
    // TODO: Vérifier si certains passifs modifient les dégâts sur les mécanismes
    return baseDamage;
  }

  /**
   * Vérifie si un mécanisme est ciblé par une attaque
   * Utilisé pour déterminer si on doit rediriger les dégâts
   *
   * @param targetPosition La position ciblée par l'attaque
   * @returns Le mécanisme à cette position, ou null
   */
  getMechanismAtPosition(targetPosition: Position): Mechanism | null {
    const mechanisms = this.boardService.mechanisms();

    for (const mechanism of mechanisms) {
      if (mechanism.position.x === targetPosition.x &&
          mechanism.position.y === targetPosition.y) {
        return mechanism;
      }
    }

    return null;
  }
}
