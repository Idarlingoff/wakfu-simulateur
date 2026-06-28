import {inject, Injectable, Injector} from '@angular/core';
import {SimulationContext} from '../../calculators/simulation-engine.service';
import {ResourceRegenerationService} from '../../processors/resource-regeneration.service';
import {XelorCastValidatorService} from './xelor-cast-validator.service';
import {BoardService} from '../../board.service';
import {XelorMovementService} from './xelor-movement.service';
import {XelorDialService} from './xelor-dial.service';
import {Position} from '../../../models/timeline.model';
import {getXelorState} from './xelor-state.utils';

@Injectable({ providedIn: 'root' })
export class XelorPassivesService {

  private static readonly MAITRE_DU_CADRAN_ID = 'XEL_MAITRE_CADRAN';
  private static readonly COURS_DU_TEMPS = 'XEL_COURS_TEMPS';
  private static readonly MECANISME_SPECIALISE = 'XEL_MECANISMES_SPECIALISES';
  private static readonly HORLOGERIE = 'XEL_HORLOGERIE';
  private static readonly PERMUTATION_MOMENTANEE = 'XEL_PERMUTATION_MOMENTANEE';
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
      this.regenerationService.regeneratePA(
        context,
        1,
        'COURS_DU_TEMPS',
        'Cours du temps: +1 PA (Distorsion actif)',
        { trigger: 'ON_TRANSPOSITION', transpositionType, distorsionActive: true }
      );
      console.log(`[XELOR COURS_DU_TEMPS] ⚡ +1 PA (Distorsion actif) - Transposition: ${transpositionType}`);
    } else {
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
   * Régénération PAR DÉFAUT du Cadran (refonte : ex-"Connaissance du passé", désormais
   * comportement de base du Cadran, indépendant du passif).
   * À chaque tour de cadran : +2 PW (à chaque tour) ; +2 PA (1 fois max par tour de jeu).
   *
   * NOTE: le cap "1x/tour" du +2 PA s'appuie sur un flag (dialPaBonusGrantedThisTurn) qui n'est
   * pas encore réinitialisé en début de tour (le cycle de tour n'est pas câblé) -> en pratique
   * 1x/simulation, ce qui est correct pour les combos mono-tour. À revoir avec le lifecycle de tour.
   */
  public applyDialDefaultRegeneration(context: SimulationContext): void {
    console.log('[XELOR CADRAN] ⚡ Régénération par défaut du Cadran (ON_HOUR_WRAPPED)');

    this.regenerationService.regeneratePW(
      context,
      2,
      'HOUR_WRAP',
      'Cadran: +2 PW (tour de cadran)',
      { trigger: 'ON_HOUR_WRAPPED' }
    );

    const state = getXelorState(context, true);
    if (!state.dialPaBonusGrantedThisTurn) {
      this.regenerationService.regeneratePA(
        context,
        2,
        'HOUR_WRAP',
        'Cadran: +2 PA (tour de cadran, 1x/tour)',
        { trigger: 'ON_HOUR_WRAPPED' }
      );
      state.dialPaBonusGrantedThisTurn = true;
      console.log('[XELOR CADRAN] ✅ Régénération: +2 PW, +2 PA');
    } else {
      console.log('[XELOR CADRAN] ✅ Régénération: +2 PW (+2 PA déjà accordé ce tour)');
    }
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

    console.log(`[XELOR MECANISME_SPECIALISE]    Result: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  }

  /**
   * Applique l'effet du passif "Mécanisme spécialisé" pour le cadran spécifiquement
   * Retourne true si le swap a été effectué, false sinon
   *
   * @param mechanismId ID du cadran
   * @param context Contexte de simulation
   * @param sourceSpellId id du sort source
   * @returns true si le swap a été effectué
   */
  public applyMecanismeSpecialiseSwapForDial(
    mechanismId: string,
    context: SimulationContext,
    sourceSpellId?: string
  ): boolean {
    if (!this.hasMecanismeSpecialisePassive(context)) {
      console.log(`[XELOR MECANISME_SPECIALISE_DIAL] Passive not active - no swap`);
      return false;
    }

    console.log(`[XELOR MECANISME_SPECIALISE_DIAL] 🔍 Passive active - applying swap for dial`);

    const mechanism = this.boardService.getMechanism(mechanismId);
    if (!mechanism) {
      console.warn(`[XELOR MECANISME_SPECIALISE_DIAL] ⚠️ Mechanism not found - cannot swap`);
      return false;
    }
    const dialPosition = mechanism.position;

    const playerEntity = this.boardService.player();
    if (!playerEntity?.position || !playerEntity?.id) {
      console.warn(`[XELOR MECANISME_SPECIALISE_DIAL] ⚠️ Player not found - cannot swap`);
      return false;
    }
    const playerPosition = playerEntity.position;

    const distance = Math.abs(dialPosition.x - playerPosition.x) +
      Math.abs(dialPosition.y - playerPosition.y);

    console.log(`[XELOR MECANISME_SPECIALISE_DIAL] 📏 Distance: ${distance} cases (max: 6)`);
    console.log(`[XELOR MECANISME_SPECIALISE_DIAL]    Player (hour 6): (${playerPosition.x}, ${playerPosition.y})`);
    console.log(`[XELOR MECANISME_SPECIALISE_DIAL]    Dial (center): (${dialPosition.x}, ${dialPosition.y})`);

    if (distance > 6) {
      console.log(`[XELOR MECANISME_SPECIALISE_DIAL] ❌ Distance too large (${distance} > 6) - no swap`);
      return false;
    }

    console.log(`[XELOR MECANISME_SPECIALISE_DIAL] 🔄 Swapping player with dial (${mechanismId})`);

    const swapSuccess = this.boardService.swapEntityWithMechanism(playerEntity.id, mechanismId);

    if (swapSuccess) {
      console.log(`[XELOR MECANISME_SPECIALISE_DIAL] ✅ Swap successful!`);

      context.playerPosition = dialPosition;
      context.currentPosition = dialPosition;

      if (context.entities) {
        const playerEntityInContext = context.entities.find(e => e.type === 'player');
        if (playerEntityInContext) {
          playerEntityInContext.position = dialPosition;
        }
      }

      this.applyCoursduTempsOnTransposition(context, 'mecanisme_specialise_dial_swap');

      this.xelorMovementService.recordMovement(
        context,
        'swap_mechanism',
        playerEntity.id,
        'entity',
        playerEntity.name || 'Player',
        playerPosition,
        dialPosition,
        sourceSpellId || 'XEL_DIAL',
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
   * @param _mechanismPosition Position initiale du mécanisme
   * @param context Contexte de simulation
   * @param sourceSpellId id du sort source
   */
  public applyMecanismeSpecialiseSwap(
    mechanismType: string,
    mechanismId: string,
    _mechanismPosition: Position,
    context: SimulationContext,
    sourceSpellId?: string
  ): void {
    if (!this.hasMecanismeSpecialisePassive(context)) {
      return;
    }

    const eligibleTypes = ['cog', 'sinistro', 'dial', 'regulateur'];
    if (!eligibleTypes.includes(mechanismType)) {
      return;
    }

    console.log(`[XELOR MECANISME_SPECIALISE] 🔍 Passive active - checking swap conditions for ${mechanismType}`);

    const mechanism = this.boardService.getMechanism(mechanismId);
    if (!mechanism) {
      console.warn(`[XELOR MECANISME_SPECIALISE] ⚠️ Mechanism not found - cannot swap`);
      return;
    }
    const actualMechanismPosition = mechanism.position;

    const playerEntity = this.boardService.player();
    const playerPosition = playerEntity?.position;

    if (!playerPosition) {
      console.warn(`[XELOR MECANISME_SPECIALISE] ⚠️ Player position not found - cannot swap`);
      return;
    }

    const distance = Math.abs(actualMechanismPosition.x - playerPosition.x) +
      Math.abs(actualMechanismPosition.y - playerPosition.y);

    console.log(`[XELOR MECANISME_SPECIALISE] 📏 Distance: ${distance} cases (max: 6)`);
    console.log(`[XELOR MECANISME_SPECIALISE]    Player: (${playerPosition.x}, ${playerPosition.y})`);
    console.log(`[XELOR MECANISME_SPECIALISE]    Mechanism: (${actualMechanismPosition.x}, ${actualMechanismPosition.y})`);

    if (distance > 6) {
      console.log(`[XELOR MECANISME_SPECIALISE] ❌ Distance too large (${distance} > 6) - no swap`);
      return;
    }

    console.log(`[XELOR MECANISME_SPECIALISE] 🔄 Swapping player with mechanism ${mechanismType} (${mechanismId})`);

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

      if (mechanismType === 'dial') {
        this.dial.updateDialHoursAfterSwap(mechanismId);
      }

      const mechanismAfterSwap = this.boardService.getMechanism(mechanismId);
      console.log(`[XELOR MECANISME_SPECIALISE] 🔍 Mechanism position AFTER swap: (${mechanismAfterSwap?.position.x}, ${mechanismAfterSwap?.position.y})`);
      console.log(`[XELOR MECANISME_SPECIALISE] 🔍 Expected mechanism position: (${playerPosition.x}, ${playerPosition.y})`);

      const playerAfterSwap = this.boardService.player();
      console.log(`[XELOR MECANISME_SPECIALISE] 🔍 Player position AFTER swap: (${playerAfterSwap?.position.x}, ${playerAfterSwap?.position.y})`);
      console.log(`[XELOR MECANISME_SPECIALISE] 🔍 Expected player position: (${actualMechanismPosition.x}, ${actualMechanismPosition.y})`);

      context.playerPosition = actualMechanismPosition;
      context.currentPosition = actualMechanismPosition;

      if (context.entities) {
        const playerEntityInContext = context.entities.find(e => e.type === 'player');
        if (playerEntityInContext) {
          playerEntityInContext.position = actualMechanismPosition;
          console.log(`[XELOR MECANISME_SPECIALISE] 📍 Player entity in context.entities updated`);
        }
      }

      this.applyCoursduTempsOnTransposition(context, 'mecanisme_specialise_swap');

      this.xelorMovementService.recordMovement(
        context,
        'swap_mechanism',
        playerId,
        'entity',
        playerEntity?.name || 'Player',
        playerPosition,
        actualMechanismPosition,
        sourceSpellId,
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

  // =========================================
  // HORLOGERIE (passif - refonte)
  // =========================================
  public hasHorlogeriePassive(context: SimulationContext): boolean {
    const passiveIds = context.activePassiveIds || [];
    return passiveIds.some(id => id.toLowerCase() === XelorPassivesService.HORLOGERIE.toLowerCase());
  }

  /**
   * Horlogerie : en début de tour, téléporte le Xélor sur l'heure courante du cadran.
   * NOTE: le "+1 au CD du Cadran" n'est pas simulé (aucun cooldown n'est appliqué par le moteur).
   * Ce TP de passif ne déclenche pas Cours du temps et ne génère pas de charges.
   */
  public applyHorlogerie(context: SimulationContext): void {
    if (!this.hasHorlogeriePassive(context)) return;

    const state = getXelorState(context, true);
    if (!state.dialId || state.currentDialHour === undefined) {
      console.log('[XELOR HORLOGERIE] Pas de cadran actif - pas de téléportation');
      return;
    }

    const dest = this.boardService.getDialHourPosition(state.currentDialHour, state.dialId);
    if (!dest) {
      console.warn('[XELOR HORLOGERIE] Heure courante introuvable - pas de téléportation');
      return;
    }

    const player = this.boardService.player();
    if (!player?.id) return;

    if (player.position.x === dest.x && player.position.y === dest.y) {
      console.log("[XELOR HORLOGERIE] Xélor déjà sur l'heure courante");
      return;
    }

    const occupant = this.boardService.getEntityAtPosition(dest);
    if (occupant && occupant.id !== player.id) {
      this.boardService.swapEntityPositions(player.id, occupant.id);
    } else {
      this.boardService.updateEntityPosition(player.id, dest);
    }

    context.playerPosition = dest;
    context.currentPosition = dest;
    if (context.entities) {
      const p = context.entities.find(e => e.type === 'player');
      if (p) p.position = dest;
    }

    console.log(`[XELOR HORLOGERIE] 🌀 Xélor téléporté sur l'heure courante (${state.currentDialHour}) -> (${dest.x}, ${dest.y})`);
  }

  // =========================================
  // PERMUTATION MOMENTANÉE (passif - refonte)
  // =========================================
  public hasPermutationMomentaneePassive(context: SimulationContext): boolean {
    const passiveIds = context.activePassiveIds || [];
    return passiveIds.some(id => id.toLowerCase() === XelorPassivesService.PERMUTATION_MOMENTANEE.toLowerCase());
  }

  /**
   * Permutation momentanée : échange la position du Xélor avec le Cadran.
   * Déclencheurs :
   *   a) à CHAQUE tour complet du cadran (hour wrap) -> peut proc plusieurs fois par tour de jeu
   *      (1 fois par tour de cadran), géré dans processHourWrap ;
   *   b) à la fin du tour de jeu (cleanupTurn) UNIQUEMENT si aucun tour de cadran ne l'a déjà
   *      déclenchée ce tour (le déclencheur "OU fin de tour").
   * `permutationDoneThisTurn` ne BLOQUE pas les déclenchements (a) : il sert seulement à savoir, en
   * fin de tour, si (a) a déjà eu lieu (pour ne pas re-déclencher en (b)).
   * Génère 2 charges (Rouage/Sinistro) et déclenche Cours du temps. Renvoie true si l'échange a eu lieu.
   * Le "+100 résistance" du Cadran n'est pas simulé (les mécanismes n'ont ni PV ni résistances).
   */
  public applyPermutationMomentanee(context: SimulationContext): boolean {
    if (!this.hasPermutationMomentaneePassive(context)) return false;

    const state = getXelorState(context, true);

    if (!state.dialId) {
      console.log("[XELOR PERMUTATION] Pas de cadran - pas d'échange");
      return false;
    }

    const dial = this.boardService.getMechanism(state.dialId);
    const player = this.boardService.player();
    if (!dial || dial.type !== 'dial' || !player?.id) return false;

    const dialPos = { x: dial.position.x, y: dial.position.y };
    const playerPos = { x: player.position.x, y: player.position.y };
    if (dialPos.x === playerPos.x && dialPos.y === playerPos.y) return false;

    const swapSuccess = this.boardService.swapEntityWithMechanism(player.id, state.dialId);
    if (!swapSuccess) {
      console.warn('[XELOR PERMUTATION] Échange échoué');
      return false;
    }

    // Le cadran a bougé : translater ses 12 heures vers sa nouvelle position.
    this.dial.updateDialHoursAfterSwap(state.dialId);

    context.playerPosition = dialPos;
    context.currentPosition = dialPos;
    if (context.entities) {
      const p = context.entities.find(e => e.type === 'player');
      if (p) p.position = dialPos;
    }

    // Échange -> Cours du temps (confirmé par l'utilisateur).
    this.applyCoursduTempsOnTransposition(context, 'permutation_momentanee_swap');

    // NB : l'échange de Permutation momentanée n'est volontairement PAS enregistré dans
    // l'historique des mouvements -> il n'est donc PAS annulable par Retour Spontané.

    // +2 charges (swap) sur Rouage/Sinistro (partagées, capées) - même règle que les transpositions.
    this.addSwapTranspositionCharges(context, 2);

    state.permutationDoneThisTurn = true;
    console.log(`[XELOR PERMUTATION] 🔄 Échange Xélor <-> Cadran : joueur -> (${dialPos.x}, ${dialPos.y}), cadran -> (${playerPos.x}, ${playerPos.y})`);
    return true;
  }

  /**
   * Ajoute des charges de transposition partagées (Rouage/Sinistro), avec cap par type.
   * Utilisé par Permutation momentanée (échange = 2 charges).
   */
  private addSwapTranspositionCharges(context: SimulationContext, amount: number): void {
    const state = getXelorState(context, true);
    const caps: Record<'cog' | 'sinistro', number> = { cog: 10, sinistro: 15 };
    (['cog', 'sinistro'] as const).forEach(type => {
      const current = state.sharedMechanismCharges?.get(type) ?? 0;
      const next = Math.min(caps[type], current + amount);
      state.sharedMechanismCharges?.set(type, next);
      for (const mech of this.boardService.getMechanismsByType(type)) {
        const cur = state.mechanismCharges?.get(mech.id) ?? 0;
        if (next > cur) {
          this.boardService.addCharges(mech.id, next - cur);
        }
        state.mechanismCharges?.set(mech.id, next);
      }
    });
  }
}
