/**
 * Stratégie de simulation spécifique au Xelor
 * Gère les mécanismes, passifs et conditions de sorts propres au Xelor
 */

import { Injectable, inject } from '@angular/core';
import { ClassSimulationStrategy, ClassValidationResult } from './class-simulation-strategy.interface';
import { Spell } from '../../models/spell.model';
import { Position, TimelineAction } from '../../models/timeline.model';
import { SimulationContext, SimulationActionResult, DelayedEffect, MovementRecord } from '../calculators/simulation-engine.service';
import { Build } from '../../models/build.model';
import { TotalStats } from '../calculators/stats-calculator.service';
import { Mechanism } from '../../models/board.model';
import { BoardService } from '../board.service';
import { ResourceRegenerationService } from '../processors/resource-regeneration.service';
import { isSpellMechanism, getSpellMechanismType, getMechanismImagePath } from '../../utils/mechanism-utils';
import {XelorDialService} from './xelor-stragegy/xelor-dial.service';
import {XelorCastValidatorService} from './xelor-stragegy/xelor-cast-validator.service';
import {XelorPassivesService} from './xelor-stragegy/xelor-passives.service';
import {XelorDelayedEffectsService} from './xelor-stragegy/xelor-delayed-effects.service';
import {XelorTeleportService} from './xelor-stragegy/xelor-teleport.service';

@Injectable({
  providedIn: 'root'
})
export class XelorSimulationStrategy extends ClassSimulationStrategy {

  readonly classId = 'XEL';

  private readonly boardService = inject(BoardService);
  private readonly regenerationService = inject(ResourceRegenerationService);
  private readonly dial = inject(XelorDialService);
  private readonly castValidator = inject(XelorCastValidatorService);
  private readonly passive = inject(XelorPassivesService);
  private readonly delayed = inject(XelorDelayedEffectsService);
  private readonly teleport = inject(XelorTeleportService);

  /**
   * Vérifie les conditions de lancement spécifiques au Xelor
   */
  validateClassSpecificCasting(
    spell: Spell,
    casterPosition: Position,
    targetPosition: Position,
    context: SimulationContext
  ): ClassValidationResult {
    return this.castValidator.validateClassSpecificCasting(
      spell,
      casterPosition,
      targetPosition,
      context
    );
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

    // 🆕 Traiter les effets TELEPORT (Pointe-heure, etc.)
    if (actionResult.success) {
      this.teleport.processTeleportEffects(spell, action, context, actionResult);
    }

    // Avancer l'heure du cadran selon le PW dépensé (1h par PW)
    // Cela s'applique à TOUS les sorts qui coûtent du PW
    console.log(`[XELOR] 🔍 Checking PW advancement: pwCost=${spell.pwCost}, success=${actionResult.success}, dialId=${context.dialId}, currentHour=${context.currentDialHour}`);
    if (spell.pwCost > 0 && actionResult.success && context.dialId) {
      this.dial.advanceDialHourByPwCost(spell.pwCost, context);
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
      this.delayed.registerSpellDelayedEffects(spell, action, context);
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
   * Vérifie si un sort est un sort de mécanisme Xelor ou un sort spécial (comme Retour Spontané)
   */
  isClassMechanismSpell(spellId: string): boolean {
    // Vérifier si c'est un mécanisme
    if (isSpellMechanism(spellId)) {
      return true;
    }
    // Vérifier si c'est le sort "Retour Spontané"
    if (this.isRetourSpontaneSpell(spellId)) {
      return true;
    }
    return false;
  }

  /**
   * Exécute un sort de mécanisme Xelor (Rouage, Cadran, Sinistro, Régulateur)
   * ou un sort spécial comme "Retour Spontané"
   */
  executeClassMechanismSpell(
    action: TimelineAction,
    context: SimulationContext,
    spell: Spell,
    paCost: number,
    pwCost: number
  ): SimulationActionResult {
    console.log(`[XELOR MECHANISM] executeMechanismSpell for: ${spell.id} (${spell.name})`);

    // 🆕 Traitement spécial pour "Retour Spontané"
    if (this.isRetourSpontaneSpell(spell.id)) {
      console.log(`[XELOR] Executing Retour Spontané spell`);
      return this.executeRetourSpontane(spell, action, context);
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

    // 🆕 Appliquer le passif "Mécanisme spécialisé" : échange de position avec le mécanisme
    // IMPORTANT: Pour le cadran, le swap doit se faire APRÈS la téléportation sur l'heure 6
    // Pour les autres mécanismes (rouage, sinistro, régulateur), le swap se fait immédiatement
    if (mechanismType !== 'dial') {
      this.applyMecanismeSpecialiseSwap(mechanismType, mechanism.id, action.targetPosition, context);
    }

    // Si c'est un cadran, créer les 12 heures autour et téléporter le joueur sur l'heure 6
    if (mechanismType === 'dial') {
      const playerEntity = this.boardService.player();
      // 🔧 Sauvegarder la position ORIGINALE du joueur avant toute manipulation
      // Cette position sera utilisée pour calculer l'orientation du cadran (même après swap)
      const originalPlayerPosition = playerEntity?.position
        ? { x: playerEntity.position.x, y: playerEntity.position.y }
        : context.playerPosition
          ? { x: context.playerPosition.x, y: context.playerPosition.y }
          : { x: 6, y: 6 };

      console.log(`[XELOR DIAL] 📍 Original player position (for dial orientation): (${originalPlayerPosition.x}, ${originalPlayerPosition.y})`);
      console.log(`[XELOR DIAL] 📍 Dial target position: (${action.targetPosition.x}, ${action.targetPosition.y})`);

      // Créer les 12 heures autour du cadran (position initiale de pose)
      this.createDialHours(mechanism.id, action.targetPosition, originalPlayerPosition);

      // Définir l'heure courante à 12 dans le BoardService
      this.boardService.setCurrentDialHour(12, mechanism.id);

      // Téléporter le joueur sur l'heure 6
      const teleported = this.boardService.teleportPlayerToDialHour(6, mechanism.id);
      if (teleported) {
        console.log(`[XELOR] 🌀 Player automatically teleported to hour 6`);

        // Mettre à jour le contexte avec la nouvelle position du joueur (heure 6)
        const hour6Position = this.boardService.getDialHourPosition(6, mechanism.id);
        if (hour6Position) {
          context.playerPosition = hour6Position;
          context.currentPosition = hour6Position;

          // IMPORTANT: Mettre à jour aussi la position dans context.entities
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

      // Initialiser l'heure courante dans le contexte
      context.currentDialHour = 12;
      context.dialId = mechanism.id;
      context.dialFirstLoopCompleted = false; // Cadran fraîchement posé

      // 🆕 MAINTENANT appliquer le passif "Mécanisme spécialisé" pour le cadran
      // Le joueur est sur l'heure 6, on échange avec le cadran (au centre)
      // Le joueur va au centre, le cadran va à l'heure 6
      const swapApplied = this.applyMecanismeSpecialiseSwapForDial(mechanism.id, context);

      // Si le swap a été appliqué, translater les heures vers la NOUVELLE position du cadran
      if (swapApplied) {
        const updatedMechanism = this.boardService.getMechanism(mechanism.id);

        if (updatedMechanism) {
          console.log(`[XELOR] 🔄 Swap applied - translating dial hours to new dial position: (${updatedMechanism.position.x}, ${updatedMechanism.position.y})`);

          // 🔧 Utiliser updateDialHoursAfterSwap pour une simple translation
          // Les heures gardent leur orientation originale et sont juste déplacées
          this.updateDialHoursAfterSwap(mechanism.id, context);

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

    // Initialiser l'état Distorsion (inactif par défaut, pas de cooldown)
    context.distorsionActive = false;
    context.distorsionCooldownRemaining = 0;

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
      this.dial.advanceDialHour(context);
    }

    // 3. Appliquer le bonus PW du Régulateur en fin de tour
    this.applyRegulatorPwBonus(context);

    // 4. Décrémenter le cooldown de Distorsion
    this.decrementDistorsionCooldown(context);

    // 5. Effacer l'historique des mouvements (pour "Retour Spontané")
    this.clearMovementHistory(context);

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

    this.dial.advanceDialHour(context, hours);
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

    this.dial.advanceDialHour(context, hoursToAdvance);
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
    this.dial.processHourWrap(context);
  }

  /** Liste des IDs possibles pour le passif Connaissance du passé */
  private static readonly CONNAISSANCE_PASSE_IDS = [
    'connaissance_passe',
    'XEL_CONNAISSANCE_PASSE',
    'connaissance_du_passe',
    'connaissance-du-passe',
    'connaissancedupasse'
  ];

  /** Liste des IDs possibles pour le passif Mécanisme spécialisé */
  private static readonly MECANISME_SPECIALISE_IDS = [
    'mecanisme_specialise',
    'XEL_MECANISME_SPECIALISE',
    'XEL_MECANISMES_SPECIALISES',  // Variante avec S au pluriel
    'mecanisme-specialise',
    'mecanismespe',
    'specialized_mechanism'
  ];

  /** Liste des IDs possibles pour le sort "Retour Spontané" */
  private static readonly RETOUR_SPONTANE_SPELL_IDS = [
    'retour_spontane',
    'XEL_RETOUR_SPONTANE',
    'xel_retour_spontane',
    'retour-spontane',
    'retourspontane',
    'spontaneous_return'
  ];

  /**
   * Vérifie si un spell ID correspond au sort "Retour Spontané"
   */
  private isRetourSpontaneSpell(spellId: string): boolean {
    const lowerSpellId = spellId.toLowerCase();
    return XelorSimulationStrategy.RETOUR_SPONTANE_SPELL_IDS.some(id =>
      lowerSpellId === id.toLowerCase()
    );
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
   * Vérifie si le passif "Mécanisme spécialisé" est actif
   * Ce passif :
   * - À l'invocation d'un Rouage, Sinistro, Cadran ou Régulateur :
   *   - Échange immédiatement de position avec (6 cases max)
   */
  private hasMecanismeSpecialisePassive(context: SimulationContext): boolean {
    const passiveIds = context.activePassiveIds || [];
    return XelorSimulationStrategy.MECANISME_SPECIALISE_IDS.some(id =>
      passiveIds.some(activeId => activeId.toLowerCase() === id.toLowerCase())
    );
  }

  /**
   * Applique l'effet du passif "Mécanisme spécialisé"
   * Échange immédiatement de position avec le mécanisme invoqué si la distance est <= 6 cases
   *
   * @param mechanismType Type de mécanisme invoqué ('cog', 'sinistro', 'dial', 'regulateur')
   * @param mechanismId ID du mécanisme invoqué
   * @param mechanismPosition Position du mécanisme invoqué
   * @param context Contexte de simulation
   */
  private applyMecanismeSpecialiseSwap(
    mechanismType: string,
    mechanismId: string,
    _mechanismPosition: Position, // Position initiale, ignorée - on récupère la position actuelle du BoardService
    context: SimulationContext
  ): void {
    // Vérifier si le passif est actif
    if (!this.hasMecanismeSpecialisePassive(context)) {
      return;
    }

    // Vérifier si le type de mécanisme est concerné (Rouage, Sinistro, Cadran, Régulateur)
    const eligibleTypes = ['cog', 'sinistro', 'dial', 'regulateur'];
    if (!eligibleTypes.includes(mechanismType)) {
      return;
    }

    console.log(`[XELOR MECANISME_SPECIALISE] 🔍 Passive active - checking swap conditions for ${mechanismType}`);

    // Récupérer la position ACTUELLE du mécanisme depuis le BoardService
    const mechanism = this.boardService.getMechanism(mechanismId);
    if (!mechanism) {
      console.warn(`[XELOR MECANISME_SPECIALISE] ⚠️ Mechanism not found - cannot swap`);
      return;
    }
    const actualMechanismPosition = mechanism.position;

    // Récupérer la position actuelle du joueur depuis le BoardService
    const playerEntity = this.boardService.player();
    const playerPosition = playerEntity?.position;

    if (!playerPosition) {
      console.warn(`[XELOR MECANISME_SPECIALISE] ⚠️ Player position not found - cannot swap`);
      return;
    }

    // Calculer la distance entre le joueur et le mécanisme
    const distance = Math.abs(actualMechanismPosition.x - playerPosition.x) +
                     Math.abs(actualMechanismPosition.y - playerPosition.y);

    console.log(`[XELOR MECANISME_SPECIALISE] 📏 Distance: ${distance} cases (max: 6)`);
    console.log(`[XELOR MECANISME_SPECIALISE]    Player: (${playerPosition.x}, ${playerPosition.y})`);
    console.log(`[XELOR MECANISME_SPECIALISE]    Mechanism: (${actualMechanismPosition.x}, ${actualMechanismPosition.y})`);

    // Vérifier si la distance est <= 6 cases
    if (distance > 6) {
      console.log(`[XELOR MECANISME_SPECIALISE] ❌ Distance too large (${distance} > 6) - no swap`);
      return;
    }

    // Effectuer l'échange de position
    console.log(`[XELOR MECANISME_SPECIALISE] 🔄 Swapping player with mechanism ${mechanismType} (${mechanismId})`);

    // S'assurer d'avoir l'ID correct du joueur
    const playerId = playerEntity?.id;
    if (!playerId) {
      console.warn(`[XELOR MECANISME_SPECIALISE] ⚠️ Player entity ID not found - cannot swap`);
      return;
    }

    console.log(`[XELOR MECANISME_SPECIALISE] 🔍 Player ID: ${playerId}, Mechanism ID: ${mechanismId}`);
    console.log(`[XELOR MECANISME_SPECIALISE] 🔍 Mechanism current position: (${actualMechanismPosition.x}, ${actualMechanismPosition.y})`);

    const swapSuccess = this.boardService.swapEntityWithMechanism(playerId, mechanismId);

    if (swapSuccess) {
      console.log(`[XELOR MECANISME_SPECIALISE] ✅ Swap successful!`);

      // 🆕 Si le mécanisme est un cadran, mettre à jour les heures
      if (mechanismType === 'dial') {
        this.updateDialHoursAfterSwap(mechanismId, context);
      }

      // 🔍 Vérifier que le mécanisme a bien bougé
      const mechanismAfterSwap = this.boardService.getMechanism(mechanismId);
      console.log(`[XELOR MECANISME_SPECIALISE] 🔍 Mechanism position AFTER swap: (${mechanismAfterSwap?.position.x}, ${mechanismAfterSwap?.position.y})`);
      console.log(`[XELOR MECANISME_SPECIALISE] 🔍 Expected mechanism position: (${playerPosition.x}, ${playerPosition.y})`);

      // 🔍 Vérifier que le joueur a bien bougé
      const playerAfterSwap = this.boardService.player();
      console.log(`[XELOR MECANISME_SPECIALISE] 🔍 Player position AFTER swap: (${playerAfterSwap?.position.x}, ${playerAfterSwap?.position.y})`);
      console.log(`[XELOR MECANISME_SPECIALISE] 🔍 Expected player position: (${actualMechanismPosition.x}, ${actualMechanismPosition.y})`);

      // Mettre à jour le contexte avec la nouvelle position du joueur (= ancienne position du mécanisme)
      context.playerPosition = actualMechanismPosition;
      context.currentPosition = actualMechanismPosition;

      // Mettre à jour aussi la position dans context.entities si nécessaire
      if (context.entities) {
        const playerEntityInContext = context.entities.find(e => e.type === 'player');
        if (playerEntityInContext) {
          playerEntityInContext.position = actualMechanismPosition;
          console.log(`[XELOR MECANISME_SPECIALISE] 📍 Player entity in context.entities updated`);
        }
      }

      // 🆕 Appliquer le passif "Cours du temps" : +1 PA si Distorsion actif, sinon +1 PW
      this.passive.applyCoursduTempsOnTransposition(context, 'mecanisme_specialise_swap');

      // 🆕 Enregistrer le mouvement pour "Retour Spontané"
      this.recordMovement(
        context,
        'swap_mechanism',
        playerId,
        'entity',
        playerEntity?.name || 'Player',
        playerPosition,
        actualMechanismPosition,
        undefined, // Pas de sort source spécifique
        {
          id: mechanismId,
          type: 'mechanism',
          name: mechanismType,
          fromPosition: actualMechanismPosition,
          toPosition: playerPosition
        }
      );

      console.log(`[XELOR MECANISME_SPECIALISE] 📍 Player now at (${actualMechanismPosition.x}, ${actualMechanismPosition.y})`);
      console.log(`[XELOR MECANISME_SPECIALISE] 📍 Mechanism now at (${playerPosition.x}, ${playerPosition.y})`);
    } else {
      console.warn(`[XELOR MECANISME_SPECIALISE] ⚠️ Swap failed`);
    }
  }

  /**
   * Applique l'effet du passif "Mécanisme spécialisé" pour le cadran spécifiquement
   * Retourne true si le swap a été effectué, false sinon
   *
   * @param mechanismId ID du cadran
   * @param context Contexte de simulation
   * @returns true si le swap a été effectué
   */
  private applyMecanismeSpecialiseSwapForDial(
    mechanismId: string,
    context: SimulationContext
  ): boolean {
    // Vérifier si le passif est actif
    if (!this.hasMecanismeSpecialisePassive(context)) {
      console.log(`[XELOR MECANISME_SPECIALISE_DIAL] Passive not active - no swap`);
      return false;
    }

    console.log(`[XELOR MECANISME_SPECIALISE_DIAL] 🔍 Passive active - applying swap for dial`);

    // Récupérer la position ACTUELLE du mécanisme (cadran) depuis le BoardService
    const mechanism = this.boardService.getMechanism(mechanismId);
    if (!mechanism) {
      console.warn(`[XELOR MECANISME_SPECIALISE_DIAL] ⚠️ Mechanism not found - cannot swap`);
      return false;
    }
    const dialPosition = mechanism.position;

    // Récupérer la position actuelle du joueur (sur l'heure 6 après téléportation)
    const playerEntity = this.boardService.player();
    if (!playerEntity?.position || !playerEntity?.id) {
      console.warn(`[XELOR MECANISME_SPECIALISE_DIAL] ⚠️ Player not found - cannot swap`);
      return false;
    }
    const playerPosition = playerEntity.position;

    // Calculer la distance entre le joueur et le cadran
    const distance = Math.abs(dialPosition.x - playerPosition.x) +
                     Math.abs(dialPosition.y - playerPosition.y);

    console.log(`[XELOR MECANISME_SPECIALISE_DIAL] 📏 Distance: ${distance} cases (max: 6)`);
    console.log(`[XELOR MECANISME_SPECIALISE_DIAL]    Player (hour 6): (${playerPosition.x}, ${playerPosition.y})`);
    console.log(`[XELOR MECANISME_SPECIALISE_DIAL]    Dial (center): (${dialPosition.x}, ${dialPosition.y})`);

    // Vérifier si la distance est <= 6 cases
    if (distance > 6) {
      console.log(`[XELOR MECANISME_SPECIALISE_DIAL] ❌ Distance too large (${distance} > 6) - no swap`);
      return false;
    }

    // Effectuer l'échange de position
    console.log(`[XELOR MECANISME_SPECIALISE_DIAL] 🔄 Swapping player with dial (${mechanismId})`);

    const swapSuccess = this.boardService.swapEntityWithMechanism(playerEntity.id, mechanismId);

    if (swapSuccess) {
      console.log(`[XELOR MECANISME_SPECIALISE_DIAL] ✅ Swap successful!`);

      // Mettre à jour le contexte avec la nouvelle position du joueur (= ancienne position du cadran = centre)
      context.playerPosition = dialPosition;
      context.currentPosition = dialPosition;

      // Mettre à jour aussi la position dans context.entities
      if (context.entities) {
        const playerEntityInContext = context.entities.find(e => e.type === 'player');
        if (playerEntityInContext) {
          playerEntityInContext.position = dialPosition;
        }
      }

      // Appliquer le passif "Cours du temps"
      this.passive.applyCoursduTempsOnTransposition(context, 'mecanisme_specialise_dial_swap');

      // 🆕 Enregistrer le mouvement pour "Retour Spontané"
      this.recordMovement(
        context,
        'swap_mechanism',
        playerEntity.id,
        'entity',
        playerEntity.name || 'Player',
        playerPosition,
        dialPosition,
        'XEL_DIAL', // Le sort cadran est la source du swap automatique
        {
          id: mechanismId,
          type: 'mechanism',
          name: 'dial',
          fromPosition: dialPosition,
          toPosition: playerPosition
        }
      );

      console.log(`[XELOR MECANISME_SPECIALISE_DIAL] 📍 Player now at dial center: (${dialPosition.x}, ${dialPosition.y})`);
      console.log(`[XELOR MECANISME_SPECIALISE_DIAL] 📍 Dial now at hour 6 position: (${playerPosition.x}, ${playerPosition.y})`);

      return true;
    } else {
      console.warn(`[XELOR MECANISME_SPECIALISE_DIAL] ⚠️ Swap failed`);
      return false;
    }
  }

  /**
   * Active l'état Distorsion
   * Distorsion a un cooldown de 3 tours de relance
   */
  public activateDistorsion(context: SimulationContext): void {
    context.distorsionActive = true;
    context.distorsionCooldownRemaining = 0;
    console.log(`[XELOR DISTORSION] ✅ Distorsion activée`);
  }

  /**
   * Désactive l'état Distorsion (début du cooldown)
   * Le cooldown de 3 tours commence
   */
  public deactivateDistorsion(context: SimulationContext): void {
    context.distorsionActive = false;
    context.distorsionCooldownRemaining = 3;
    console.log(`[XELOR DISTORSION] ⏰ Distorsion désactivée - cooldown: ${context.distorsionCooldownRemaining} tours`);
  }

  /**
   * Décrémente le cooldown de Distorsion en fin de tour
   * Appelé par cleanupTurn
   */
  private decrementDistorsionCooldown(context: SimulationContext): void {
    if (context.distorsionCooldownRemaining && context.distorsionCooldownRemaining > 0) {
      context.distorsionCooldownRemaining--;
      console.log(`[XELOR DISTORSION] ⏰ Cooldown: ${context.distorsionCooldownRemaining + 1} → ${context.distorsionCooldownRemaining} tours restants`);

      if (context.distorsionCooldownRemaining === 0) {
        console.log(`[XELOR DISTORSION] ✅ Distorsion disponible à nouveau`);
      }
    }
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
   * Met à jour les heures du cadran après un swap de position
   * Les heures sont simplement translatées en fonction du déplacement du cadran
   * (ancienne position du cadran -> nouvelle position du cadran)
   *
   * @param dialId ID du cadran
   * @param context Contexte de simulation (non utilisé mais conservé pour compatibilité)
   */
  private updateDialHoursAfterSwap(dialId: string, context?: SimulationContext): void {
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
   * Met à jour la position d'une entité dans le contexte de simulation (context.entities)
   * Cette méthode est importante pour maintenir la cohérence entre BoardService et le contexte
   *
   * @param context Le contexte de simulation
   * @param entityId L'ID de l'entité à mettre à jour
   * @param newPosition La nouvelle position
   */
  private updateEntityPositionInContext(context: SimulationContext, entityId: string, newPosition: Position): void {
    if (!context.entities) {
      console.warn(`[XELOR] ⚠️ context.entities is undefined, cannot update position for entity ${entityId}`);
      return;
    }

    const entityInContext = context.entities.find(e => e.id === entityId);
    if (entityInContext) {
      const oldPosition = entityInContext.position;
      entityInContext.position = { ...newPosition };
      console.log(`[XELOR] 📍 Updated entity ${entityId} position in context: (${oldPosition.x}, ${oldPosition.y}) → (${newPosition.x}, ${newPosition.y})`);
    } else {
      console.warn(`[XELOR] ⚠️ Entity ${entityId} not found in context.entities`);
    }
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

  // ============ MOUVEMENT TRACKING (pour Retour Spontané) ============

  /**
   * Initialise l'historique des mouvements si nécessaire
   */
  private initMovementHistory(context: SimulationContext): void {
    if (!context.movementHistory) {
      context.movementHistory = [];
    }
  }

  /**
   * Enregistre un mouvement (téléportation, poussée, attirance, échange)
   * Utilisé pour le sort "Retour Spontané"
   *
   * @param context Contexte de simulation
   * @param type Type de mouvement
   * @param targetId ID de l'entité/mécanisme déplacé
   * @param targetType Type de cible
   * @param targetName Nom de la cible
   * @param fromPosition Position avant le mouvement
   * @param toPosition Position après le mouvement
   * @param sourceSpellId ID du sort source (optionnel)
   * @param swapPartner Informations sur le partenaire de swap (optionnel)
   */
  public recordMovement(
    context: SimulationContext,
    type: 'teleport' | 'push' | 'pull' | 'swap' | 'swap_mechanism',
    targetId: string,
    targetType: 'entity' | 'mechanism',
    targetName: string,
    fromPosition: Position,
    toPosition: Position,
    sourceSpellId?: string,
    swapPartner?: {
      id: string;
      type: 'entity' | 'mechanism';
      name: string;
      fromPosition: Position;
      toPosition: Position;
    }
  ): void {
    this.initMovementHistory(context);

    const movement: MovementRecord = {
      id: `movement_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      targetId,
      targetType,
      targetName,
      fromPosition: { ...fromPosition },
      toPosition: { ...toPosition },
      sourceSpellId,
      timestamp: Date.now(),
      swapPartner: swapPartner ? {
        ...swapPartner,
        fromPosition: { ...swapPartner.fromPosition },
        toPosition: { ...swapPartner.toPosition }
      } : undefined
    };

    context.movementHistory!.push(movement);
    console.log(`[XELOR MOVEMENT] 📝 Recorded ${type} movement: ${targetName} (${fromPosition.x}, ${fromPosition.y}) → (${toPosition.x}, ${toPosition.y})`);

    if (swapPartner) {
      console.log(`[XELOR MOVEMENT]    Swap partner: ${swapPartner.name} (${swapPartner.fromPosition.x}, ${swapPartner.fromPosition.y}) → (${swapPartner.toPosition.x}, ${swapPartner.toPosition.y})`);
    }
  }

  /**
   * Récupère le dernier mouvement enregistré
   */
  public getLastMovement(context: SimulationContext): MovementRecord | null {
    if (!context.movementHistory || context.movementHistory.length === 0) {
      return null;
    }
    return context.movementHistory[context.movementHistory.length - 1];
  }

  /**
   * Efface l'historique des mouvements (appelé en fin de tour)
   */
  public clearMovementHistory(context: SimulationContext): void {
    if (context.movementHistory) {
      const count = context.movementHistory.length;
      context.movementHistory = [];
      console.log(`[XELOR MOVEMENT] 🗑️ Cleared ${count} movement record(s)`);
    }
  }

  // ============ RETOUR SPONTANÉ ============

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

    const lastMovement = this.getLastMovement(context);

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

    console.log(`[XELOR RETOUR_SPONTANE] 📋 Last movement: ${lastMovement.type} - ${lastMovement.targetName}`);
    console.log(`[XELOR RETOUR_SPONTANE]    From: (${lastMovement.toPosition.x}, ${lastMovement.toPosition.y}) → To: (${lastMovement.fromPosition.x}, ${lastMovement.fromPosition.y})`);

    // Calculer le coût du sort
    const paCost = spell.paCost || 3;
    const pwCost = spell.pwCost || 0;

    // Vérifier les ressources
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

    // Annuler le mouvement selon son type
    let revertSuccess = false;
    let revertMessage = '';

    if (lastMovement.type === 'swap' || lastMovement.type === 'swap_mechanism') {
      revertSuccess = this.revertSwapMovement(lastMovement, context);
      revertMessage = revertSuccess
        ? `Échange annulé: ${lastMovement.targetName} et ${lastMovement.swapPartner?.name} retournent à leurs positions`
        : `Échec de l'annulation de l'échange`;
    } else {
      revertSuccess = this.revertSimpleMovement(lastMovement, context);
      revertMessage = revertSuccess
        ? `${lastMovement.targetName} retourne à sa position précédente (${lastMovement.fromPosition.x}, ${lastMovement.fromPosition.y})`
        : `Échec de l'annulation du mouvement`;
    }

    if (revertSuccess) {
      // TODO: Mettre en place pour la v2 la gestion source et cible marque
      //context.movementHistory!.pop();
      //console.log(`[XELOR RETOUR_SPONTANE] ✅ Movement reverted successfully`);


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
   * Annule un mouvement simple (téléportation, poussée, attirance)
   */
  private revertSimpleMovement(movement: MovementRecord, context: SimulationContext): boolean {
    console.log(`[XELOR RETOUR_SPONTANE] 🔄 Reverting simple ${movement.type} movement`);

    if (movement.targetType === 'entity') {
      // Trouver l'entité
      const entity = this.boardService.getEntity(movement.targetId);
      if (!entity) {
        console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ Entity ${movement.targetId} not found`);
        return false;
      }

      // Vérifier que l'entité est bien à la position "toPosition"
      if (entity.position.x !== movement.toPosition.x || entity.position.y !== movement.toPosition.y) {
        console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ Entity position mismatch: expected (${movement.toPosition.x}, ${movement.toPosition.y}), found (${entity.position.x}, ${entity.position.y})`);
        // On continue quand même, l'entité a peut-être bougé entre temps
      }

      // Remettre l'entité à sa position d'origine
      this.boardService.updateEntityPosition(movement.targetId, movement.fromPosition);

      // Mettre à jour le contexte si c'est le joueur
      if (entity.type === 'player') {
        context.playerPosition = { ...movement.fromPosition };
        context.currentPosition = { ...movement.fromPosition };
      }

      // Mettre à jour context.entities
      this.updateEntityPositionInContext(context, movement.targetId, movement.fromPosition);

      console.log(`[XELOR RETOUR_SPONTANE] ✅ Entity ${entity.name} returned to (${movement.fromPosition.x}, ${movement.fromPosition.y})`);
      return true;

    } else if (movement.targetType === 'mechanism') {
      // Trouver le mécanisme
      const mechanism = this.boardService.getMechanism(movement.targetId);
      if (!mechanism) {
        console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ Mechanism ${movement.targetId} not found`);
        return false;
      }

      // Remettre le mécanisme à sa position d'origine
      this.boardService.updateMechanismPosition(movement.targetId, movement.fromPosition);

      // Si c'est un cadran, mettre à jour les heures
      if (mechanism.type === 'dial') {
        this.updateDialHoursAfterSwap(movement.targetId, context);
      }

      console.log(`[XELOR RETOUR_SPONTANE] ✅ Mechanism ${mechanism.type} returned to (${movement.fromPosition.x}, ${movement.fromPosition.y})`);
      return true;
    }

    return false;
  }

  /**
   * Annule un échange de position (swap)
   */
  private revertSwapMovement(movement: MovementRecord, context: SimulationContext): boolean {
    console.log(`[XELOR RETOUR_SPONTANE] 🔄 Reverting swap movement`);

    if (!movement.swapPartner) {
      console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ Swap movement has no partner info`);
      return false;
    }

    const partner = movement.swapPartner;

    // Cas 1: Swap entre deux entités
    if (movement.targetType === 'entity' && partner.type === 'entity') {
      const entity1 = this.boardService.getEntity(movement.targetId);
      const entity2 = this.boardService.getEntity(partner.id);

      if (!entity1 || !entity2) {
        console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ One or both entities not found`);
        return false;
      }

      // Ré-échanger les positions
      this.boardService.swapEntityPositions(movement.targetId, partner.id);

      // Mettre à jour le contexte si l'un est le joueur
      if (entity1.type === 'player') {
        context.playerPosition = { ...movement.fromPosition };
        context.currentPosition = { ...movement.fromPosition };
      }
      if (entity2.type === 'player') {
        context.playerPosition = { ...partner.fromPosition };
        context.currentPosition = { ...partner.fromPosition };
      }

      // Mettre à jour context.entities
      this.updateEntityPositionInContext(context, movement.targetId, movement.fromPosition);
      this.updateEntityPositionInContext(context, partner.id, partner.fromPosition);

      console.log(`[XELOR RETOUR_SPONTANE] ✅ Swap reverted: ${entity1.name} ↔ ${entity2.name}`);
      return true;
    }

    // Cas 2: Swap entre entité et mécanisme
    if ((movement.targetType === 'entity' && partner.type === 'mechanism') ||
        (movement.targetType === 'mechanism' && partner.type === 'entity')) {

      const entityId = movement.targetType === 'entity' ? movement.targetId : partner.id;
      const mechanismId = movement.targetType === 'mechanism' ? movement.targetId : partner.id;

      const entity = this.boardService.getEntity(entityId);
      const mechanism = this.boardService.getMechanism(mechanismId);

      if (!entity || !mechanism) {
        console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ Entity or mechanism not found`);
        return false;
      }

      // Ré-échanger les positions
      this.boardService.swapEntityWithMechanism(entityId, mechanismId);

      // Si c'est un cadran, mettre à jour les heures
      if (mechanism.type === 'dial') {
        this.updateDialHoursAfterSwap(mechanismId, context);
      }

      // Déterminer les positions d'origine
      const entityOriginalPos = movement.targetType === 'entity' ? movement.fromPosition : partner.fromPosition;

      // Mettre à jour le contexte si c'est le joueur
      if (entity.type === 'player') {
        context.playerPosition = { ...entityOriginalPos };
        context.currentPosition = { ...entityOriginalPos };
      }

      // Mettre à jour context.entities
      this.updateEntityPositionInContext(context, entityId, entityOriginalPos);

      console.log(`[XELOR RETOUR_SPONTANE] ✅ Entity/Mechanism swap reverted: ${entity.name} ↔ ${mechanism.type}`);
      return true;
    }

    // Cas 3: Swap entre deux mécanismes
    if (movement.targetType === 'mechanism' && partner.type === 'mechanism') {
      const mechanism1 = this.boardService.getMechanism(movement.targetId);
      const mechanism2 = this.boardService.getMechanism(partner.id);

      if (!mechanism1 || !mechanism2) {
        console.warn(`[XELOR RETOUR_SPONTANE] ⚠️ One or both mechanisms not found`);
        return false;
      }

      // Ré-échanger les positions
      this.boardService.swapMechanismPositions(movement.targetId, partner.id);

      // Mettre à jour les heures des cadrans si nécessaire
      if (mechanism1.type === 'dial') {
        this.updateDialHoursAfterSwap(movement.targetId, context);
      }
      if (mechanism2.type === 'dial') {
        this.updateDialHoursAfterSwap(partner.id, context);
      }

      console.log(`[XELOR RETOUR_SPONTANE] ✅ Mechanism swap reverted: ${mechanism1.type} ↔ ${mechanism2.type}`);
      return true;
    }

    return false;
  }

  /**
   * Vérifie si le sort "Retour Spontané" peut être lancé
   * (il faut qu'il y ait un mouvement à annuler)
   */
  public canCastRetourSpontane(context: SimulationContext): boolean {
    const lastMovement = this.getLastMovement(context);
    return lastMovement !== null;
  }
}
