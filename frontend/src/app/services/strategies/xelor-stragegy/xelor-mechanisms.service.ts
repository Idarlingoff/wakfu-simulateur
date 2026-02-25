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

    // 🆕 Traitement spécial pour "Retour Spontané"
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

    const sharedCharges = this.getInitialChargesForMechanismType(mechanismType, context);

    // Créer le mécanisme
    const mechanism: Mechanism = {
      id: `${mechanismType}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: mechanismType,
      position: action.targetPosition,
      charges: sharedCharges,
      spellId: spell.id
    };

    console.log(`[XELOR] Mechanism object created:`, mechanism);

    // Ajouter le mécanisme au plateau via le BoardService
    this.boardService.addMechanism(mechanism);
    context.mechanismCharges?.set(mechanism.id, sharedCharges);

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
      this.xelorPassiveService.applyMecanismeSpecialiseSwap(
        mechanismType,
        mechanism.id,
        action.targetPosition,
        context,
        spell.id
      );
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
      this.dial.createDialHours(mechanism.id, action.targetPosition, originalPlayerPosition);

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
      const swapApplied = this.xelorPassiveService.applyMecanismeSpecialiseSwapForDial(
        mechanism.id,
        context,
        spell.id
      );

      // Si le swap a été appliqué, translater les heures vers la NOUVELLE position du cadran
      if (swapApplied) {
        const updatedMechanism = this.boardService.getMechanism(mechanism.id);

        if (updatedMechanism) {
          console.log(`[XELOR] 🔄 Swap applied - translating dial hours to new dial position: (${updatedMechanism.position.x}, ${updatedMechanism.position.y})`);

          // 🔧 Utiliser updateDialHoursAfterSwap pour une simple translation
          // Les heures gardent leur orientation originale et sont juste déplacées
          this.dial.updateDialHoursAfterSwap(mechanism.id, context);

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

    return context.sharedMechanismCharges?.get(mechanismType) || 0;
  }

  /**
   * Applique les dégâts du Rouage (fin de tour)
   */
  public applyRouageDamage(context: SimulationContext): void {
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
  public applySinistroHealing(context: SimulationContext): void {
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
}
