import {inject, Injectable, Injector} from '@angular/core';
import {SimulationContext} from '../../calculators/simulation-engine.service';
import {ResourceRegenerationService} from '../../processors/resource-regeneration.service';
import {XelorCastValidatorService} from './xelor-cast-validator.service';
import {BoardService} from '../../board.service';
import {XelorMovementService} from './xelor-movement.service';
import {XelorDialService} from './xelor-dial.service';
import {Position} from '../../../models/timeline.model';

@Injectable({ providedIn: 'root' })
export class XelorPassivesService {

  private static readonly MAITRE_DU_CADRAN_ID = 'XEL_MAITRE_CADRAN';
  private static readonly COURS_DU_TEMPS = 'XEL_COURS_TEMPS';
  private static readonly CONNAISSANCE_PASSE = 'XEL_CONNAISSANCE_PASSE';
  private static readonly MECANISME_SPECIALISE = 'XEL_MECANISMES_SPECIALISES';
  private readonly boardService = inject(BoardService);
  private readonly regenerationService = inject(ResourceRegenerationService);
  private readonly xelorCastValidatorService = inject(XelorCastValidatorService);
  private readonly xelorMovementService = inject(XelorMovementService);
  private readonly injector = inject(Injector);

  private get dial(): XelorDialService {
    return this.injector.get(XelorDialService);
  }
  /**
   * Vérifie si le passif "Maître du Cadran" est actif
   * Ce passif permet de résoudre les effets différés lors d'un tour de cadran
   */
  public hasMaitreDuCadranPassive(context: SimulationContext): boolean {
    const passiveIds = context.activePassiveIds || [];
    console.log(`[XELOR MAITRE_CADRAN] 🔍 Checking for Maître du Cadran passive...`);
    console.log(`[XELOR MAITRE_CADRAN]    Active passive IDs in context: [${passiveIds.join(', ')}]`);
    console.log(`[XELOR MAITRE_CADRAN]    Looking for any of: ${XelorPassivesService.MAITRE_DU_CADRAN_ID.toLowerCase()}`);

    const found = passiveIds.some(
      activeId => activeId.toLowerCase() === XelorPassivesService.MAITRE_DU_CADRAN_ID.toLowerCase()
    );

    console.log(`[XELOR MAITRE_CADRAN]    Result: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  }

  /**
   * Vérifie si le passif "Cours du temps" est actif
   * Ce passif :
   * - À chaque transposition causée par le Xélor :
   *   - Régénère 1 PA si Distorsion est actif
   *   - Autrement, régénère 1 PW
   */
  public hasCoursDuTempsPassive(context: SimulationContext): boolean {
    const passiveIds = context.activePassiveIds || [];
    const found = passiveIds.some(
      activeId => activeId.toLowerCase() === XelorPassivesService.COURS_DU_TEMPS.toLowerCase()
    );

    console.log(`[XELOR COURS_DU_TEMPS]    Result: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  }

  /**
   * Traite l'effet du passif "Cours du temps" lors d'une transposition
   * - Si Distorsion est actif : +1 PA
   * - Sinon : +1 PW
   *
   * @param context Le contexte de simulation
   * @param transpositionType Type de transposition effectuée (pour le logging)
   */
  public applyCoursduTempsOnTransposition(context: SimulationContext, transpositionType: string = 'standard'): void {
    if (!this.hasCoursDuTempsPassive(context)) {
      return;
    }

    const isDistorsionActive = this.xelorCastValidatorService.isDistorsionActive(context);

    if (isDistorsionActive) {
      // Distorsion active : +1 PA
      this.regenerationService.regeneratePA(
        context,
        1,
        'COURS_DU_TEMPS',
        'Cours du temps: +1 PA (Distorsion actif)',
        { trigger: 'ON_TRANSPOSITION', transpositionType, distorsionActive: true }
      );
      console.log(`[XELOR COURS_DU_TEMPS] ⚡ +1 PA (Distorsion actif) - Transposition: ${transpositionType}`);
    } else {
      // Distorsion inactif : +1 PW
      this.regenerationService.regeneratePW(
        context,
        1,
        'COURS_DU_TEMPS',
        'Cours du temps: +1 PW (Distorsion inactif)',
        { trigger: 'ON_TRANSPOSITION', transpositionType, distorsionActive: false }
      );
      console.log(`[XELOR COURS_DU_TEMPS] 💧 +1 PW (Distorsion inactif) - Transposition: ${transpositionType}`);
    }
  }

  /**
   * Vérifie si le passif "Connaissance du passé" est actif
   * Ce passif :
   * - Régénère 2 PA et 2 PW à chaque tour de cadran
   * - Le Cadran coûte +2 PW supplémentaires
   */
  public hasConnaissancePassePassive(context: SimulationContext): boolean {
    const passiveIds = context.activePassiveIds || [];
    const found = passiveIds.some(
      activeId => activeId.toLowerCase() === XelorPassivesService.CONNAISSANCE_PASSE.toLowerCase()
    );

    console.log(`[XELOR CONNAISSANCE_PASSE]    Result: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  }

  /**
   * Applique la régénération du passif "Connaissance du passé"
   * À chaque tour de cadran : +2 PA et +2 PW
   */
  public applyConnaissancePasseRegeneration(context: SimulationContext): void {
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
   * Vérifie si le passif "Mécanisme spécialisé" est actif
   * Ce passif :
   * - À l'invocation d'un Rouage, Sinistro, Cadran ou Régulateur :
   *   - Échange immédiatement de position avec (6 cases max)
   */
  public hasMecanismeSpecialisePassive(context: SimulationContext): boolean {
    const passiveIds = context.activePassiveIds || [];
    const found = passiveIds.some(
      activeId => activeId.toLowerCase() === XelorPassivesService.MECANISME_SPECIALISE.toLowerCase()
    );

    console.log(`[XELOR XEL_MECANISMES_SPECIALISES]    Result: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  }

  /**
   * Applique l'effet du passif "Mécanisme spécialisé" pour le cadran spécifiquement
   * Retourne true si le swap a été effectué, false sinon
   *
   * @param mechanismId ID du cadran
   * @param context Contexte de simulation
   * @returns true si le swap a été effectué
   */
  public applyMecanismeSpecialiseSwapForDial(
    mechanismId: string,
    context: SimulationContext,
    sourceSpellId?: string
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
      this.applyCoursduTempsOnTransposition(context, 'mecanisme_specialise_dial_swap');

      // 🆕 Enregistrer le mouvement pour "Retour Spontané"
      this.xelorMovementService.recordMovement(
        context,
        'swap_mechanism',
        playerEntity.id,
        'entity',
        playerEntity.name || 'Player',
        playerPosition,
        dialPosition,
        sourceSpellId || 'XEL_DIAL', // Le sort cadran est la source du swap automatique
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
   * Applique l'effet du passif "Mécanisme spécialisé"
   * Échange immédiatement de position avec le mécanisme invoqué si la distance est <= 6 cases
   *
   * @param mechanismType Type de mécanisme invoqué ('cog', 'sinistro', 'dial', 'regulateur')
   * @param mechanismId ID du mécanisme invoqué
   * @param mechanismPosition Position du mécanisme invoqué
   * @param context Contexte de simulation
   */
  public applyMecanismeSpecialiseSwap(
    mechanismType: string,
    mechanismId: string,
    _mechanismPosition: Position, // Position initiale, ignorée - on récupère la position actuelle du BoardService
    context: SimulationContext,
    sourceSpellId?: string
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
        this.dial.updateDialHoursAfterSwap(mechanismId, context);
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
      this.applyCoursduTempsOnTransposition(context, 'mecanisme_specialise_swap');

      // 🆕 Enregistrer le mouvement pour "Retour Spontané"
      this.xelorMovementService.recordMovement(
        context,
        'swap_mechanism',
        playerId,
        'entity',
        playerEntity?.name || 'Player',
        playerPosition,
        actualMechanismPosition,
        sourceSpellId, // Pas de sort source spécifique
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
}
