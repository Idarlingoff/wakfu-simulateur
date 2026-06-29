/**
 * Stratégie de simulation spécifique au Xelor
 * Gère les mécanismes, passifs et conditions de sorts propres au Xelor
 */

import {inject, Injectable} from '@angular/core';
import {ClassSimulationStrategy, ClassValidationResult} from './class-simulation-strategy.interface';
import {Spell} from '../../models/spell.model';
import {Position, TimelineAction} from '../../models/timeline.model';
import {SimulationActionResult, SimulationContext} from '../calculators/simulation-engine.service';
import {Build} from '../../models/build.model';
import {TotalStats} from '../calculators/stats-calculator.service';
import {MovementValidationResult} from '../validators/movement-validator.service';
import {Mechanism} from '../../models/board.model';
import {BoardService} from '../board.service';
import {ResourceRegenerationService} from '../processors/resource-regeneration.service';
import {getSpellMechanismType, isSpellMechanism} from '../../utils/mechanism-utils';
import {XelorDialService} from './xelor-stragegy/xelor-dial.service';
import {XelorCastValidatorService} from './xelor-stragegy/xelor-cast-validator.service';
import {XelorPassivesService} from './xelor-stragegy/xelor-passives.service';
import {XelorDelayedEffectsService} from './xelor-stragegy/xelor-delayed-effects.service';
import {XelorTeleportService} from './xelor-stragegy/xelor-teleport.service';
import {XelorMovementService} from './xelor-stragegy/xelor-movement.service';
import {XelorMechanismsService} from './xelor-stragegy/xelor-mechanisms.service';
import {XelorExecuteEffectService} from './xelor-stragegy/xelor-execute-effect.service';
import {getXelorState} from './xelor-stragegy/xelor-state.utils';

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
  private readonly movement = inject(XelorMovementService);
  private readonly mechanisms = inject(XelorMechanismsService);
  private readonly executeEffect = inject(XelorExecuteEffectService);

  private static readonly DISTORSION_SPELL_ID = 'XEL_DISTO';
  private static readonly VOL_DU_TEMPS_SPELL_ID = 'XEL_VDT';

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

    if (actionResult.success && spell.id === XelorSimulationStrategy.DISTORSION_SPELL_ID) {
      this.activateDistorsion(context);
    }

    // Vol du Temps : convertit les PW dépensés en PA. Le PW (stacks + 1) est déjà décompté via le coût
    // dynamique (getSpellExtraCost) ; ici on rend le MÊME montant en PA, puis on incrémente les stacks.
    if (actionResult.success && spell.id === XelorSimulationStrategy.VOL_DU_TEMPS_SPELL_ID) {
      const state = getXelorState(context, true);
      const paGain = (state.timeStealStacks ?? 0) + 1;
      this.regenerationService.regeneratePA(
        context,
        paGain,
        'SPELL_EFFECT',
        `Vol du Temps: +${paGain} PA (${paGain} PW converti(s))`,
        { spellId: spell.id, spellName: spell.name, stacks: state.timeStealStacks ?? 0 }
      );
      state.timeStealStacks = (state.timeStealStacks ?? 0) + 1;
      console.log(`[XELOR VOL_DU_TEMPS] ⚡ +${paGain} PA — stacks: ${state.timeStealStacks}`);
    }

    const mechanismType = getSpellMechanismType(spell.id);
    if (mechanismType && actionResult.success) {
      this.activateMechanismAura(mechanismType, context);

      if (mechanismType === 'dial' && actionResult.details?.mechanismId) {
        getXelorState(context, true).dialId = actionResult.details.mechanismId;
        getXelorState(context, true).currentDialHour = 12;
        getXelorState(context, true).dialFirstLoopCompleted = false;
        console.log(`[XELOR] Dial activated - current hour set to ${getXelorState(context, true).currentDialHour}, first loop not yet completed`);
      }
    }

    if (actionResult.success) {
      this.teleport.processTeleportEffects(spell, action, context, actionResult);
    }

    // Avancer l'heure du cadran : 1h par PW RÉELLEMENT dépensé sur le cast (surcoûts dynamiques
    // inclus, ex: Distorsion), SAUF le cast qui vient de POSER le cadran (sa propre dépense ne fait
    // pas tourner le cadran fraîchement placé).
    const isDialSummon = mechanismType === 'dial';
    const dialHourAdvance = isDialSummon ? 0 : (actionResult.pwCost || 0);
    console.log(`[XELOR] 🔍 Checking dial hour advancement: advance=${dialHourAdvance}, success=${actionResult.success}, dialId=${getXelorState(context, true).dialId}, currentHour=${getXelorState(context, true).currentDialHour}`);

    if (dialHourAdvance > 0 && actionResult.success && getXelorState(context, true).dialId) {
      this.dial.advanceDialHourByPwCost(dialHourAdvance, context);
    } else if (dialHourAdvance > 0 && actionResult.success && !getXelorState(context, true).dialId) {
      console.log(`[XELOR] ⚠️ Cannot advance dial hour: no dialId in context (spell: ${spell.name})`);
    }

    // Ajouter des charges aux mécanismes selon les transpositions réalisées par le Xélor.
    // 1 charge par déplacement d'entité/mécanisme, 2 charges pour un échange (swap).
    if (actionResult.success) {
      this.addRouageAndSinistroChargesFromTranspositions(spell.id, context);
    }

    if (action.targetPosition && getXelorState(context, true).dialId) {
      const hour = this.boardService.getDialHourAtPosition(action.targetPosition, getXelorState(context, true).dialId);
      if (hour !== null && hour === getXelorState(context, true).currentDialHour) {
        console.log(`[XELOR] Player on current hour (${hour}) - Ponctualité may apply`);
        // TODO: Appliquer le buff Ponctualité (+50% DI pour le tour)
      }
    }

    if (actionResult.success) {
      this.delayed.registerSpellDelayedEffects(spell, action, context);
    }

    // Effet spécial Désynchronisation: lancé sur le cadran, avance de 6h et rend 2 PA (1 fois/tour)
    if (actionResult.success) {
      this.executeEffect.processConditionalOnCastEffects(spell, action, context);
    }
  }

  /**
   * Active l'aura correspondant à un type de mécanisme
   */
  private activateMechanismAura(mechanismType: string, context: SimulationContext): void {
    if (!getXelorState(context, true).activeAuras) {
      getXelorState(context, true).activeAuras = new Set();
    }

    switch (mechanismType) {
      case 'cog':
        getXelorState(context, true).activeAuras.add('ROUAGE_AURA');
        console.log(`[XELOR] ✅ ROUAGE_AURA activated`);
        break;
      case 'sinistro':
        getXelorState(context, true).activeAuras.add('SINISTRO_AURA');
        console.log(`[XELOR] ✅ SINISTRO_AURA activated`);
        break;
      case 'dial':
        getXelorState(context, true).activeAuras.add('DIAL_AURA');
        console.log(`[XELOR] ✅ DIAL_AURA activated`);
        break;
      case 'regulateur':
        getXelorState(context, true).activeAuras.add('REGULATOR_PW_AURA');
        console.log(`[XELOR] ✅ REGULATOR_PW_AURA activated`);
        break;
    }
  }

  /**
   * * Ajoute des charges aux rouages/sinistros selon les transpositions du sort courant.
   *    *
   *    * Règles métier:
   *    * - 1 charge par déplacement (téléportation)
   *    * - 2 charges par échange (swap)
   *    * - Les Rouages partagent le même compteur (max 10)
   *    * - Les Sinistros partagent le même compteur (max 15)
   */
  private addRouageAndSinistroChargesFromTranspositions(spellId: string, context: SimulationContext): void {
    const generatedCharges = this.castValidator.isRetourSpontaneSpell(spellId)
      ? this.getTranspositionChargesForRetourSpontane(context)
      : this.getTranspositionChargesForCurrentAction(spellId, context);

    if (generatedCharges <= 0) {
      return;
    }

    this.addSharedChargesToMechanismType('cog', generatedCharges, context);
    this.addSharedChargesToMechanismType('sinistro', generatedCharges, context);

    console.log(`[XELOR] Added ${generatedCharges} shared transposition charge(s) to Rouage and Sinistro`);
  }

  /**
   * Retour Spontané annule un mouvement déjà enregistré (au lieu d'en créer un nouveau)
   * et doit générer des charges sur la base de ce mouvement annulé.
   */
  private getTranspositionChargesForRetourSpontane(context: SimulationContext): number {
    const revertedMovement = this.movement.getLastMovement(context);

    if (!revertedMovement) {
      return 0;
    }

    // Un déplacement classique (PM/PW) n'est pas une transposition -> ne génère pas de charges.
    if (revertedMovement.type === 'move') {
      return 0;
    }

    return (revertedMovement.type === 'swap' || revertedMovement.type === 'swap_mechanism') ? 2 : 1;
  }

  /**
   * Calcule le nombre de charges générées par le sort courant via l'historique de mouvements.
   *
   * On lit les derniers mouvements consécutifs associés au sort en cours.
   */
  private getTranspositionChargesForCurrentAction(spellId: string, context: SimulationContext): number {
    if (!context.movementHistory || context.movementHistory.length === 0) {
      return 0;
    }

    const currentActionId = context.currentActionId;
    let charges = 0;

    for (let i = context.movementHistory.length - 1; i >= 0; i--) {
      const movement = context.movementHistory[i];

      // Priorité au découpage strict par action timeline.
      // Si l'action courante est connue, on ne compte que ses mouvements.
      if (currentActionId) {
        if (movement.sourceActionId !== currentActionId) {
          continue;
        }
      } else {
        // Fallback historique: lot contigu du même sort en fin d'historique.
        if (movement.sourceSpellId !== spellId) {
          break;
        }
      }

      // Un déplacement classique (PM/PW) n'est pas une transposition -> ne génère pas de charges.
      if (movement.type === 'move') {
        continue;
      }

      if (movement.type === 'swap' || movement.type === 'swap_mechanism') {
        charges += 2;
      } else {
        charges += 1;
      }
    }

    return charges;
  }

  /**
   * Ajoute des charges à tous les mécanismes d'un type en gardant une valeur partagée.
   */
  private addSharedChargesToMechanismType(type: 'cog' | 'sinistro', chargesToAdd: number, context: SimulationContext): void {
    if (chargesToAdd <= 0) {
      return;
    }

    const mechanisms = this.boardService.getMechanismsByType(type);
    const maxCharges = this.getMechanismMaxCharges(type);
    const baseCharges = this.getSharedChargesForType(type, mechanisms, context);
    const nextCharges = Math.min(maxCharges, baseCharges + chargesToAdd);

    if (!getXelorState(context, true).sharedMechanismCharges) {
      getXelorState(context, true).sharedMechanismCharges = new Map<'cog' | 'sinistro', number>();
    }

    getXelorState(context, true).sharedMechanismCharges.set(type, nextCharges);
    if (mechanisms.length === 0) {
      console.log(`[XELOR] ${type} shared charges updated to ${nextCharges} (no active mechanism yet)`);
      return;
    }

    for (const mechanism of mechanisms) {
      const currentCharges = getXelorState(context, true).mechanismCharges?.get(mechanism.id) || 0;
      const delta = nextCharges - currentCharges;

      if (delta > 0) {
        this.boardService.addCharges(mechanism.id, delta);
      }

      getXelorState(context, true).mechanismCharges?.set(mechanism.id, nextCharges);
    }
  }

  /**
   * Lit la charge partagée d'un type de mécanisme.
   * Si des mécanismes sont désynchronisés, on conserve la valeur minimale pour éviter
   * d'augmenter artificiellement une charge déjà décrémentée (ex: explosion de rouage).
   */
  private getSharedChargesForType(type: 'cog' | 'sinistro', mechanisms: Mechanism[], context: SimulationContext): number {
    const sharedCounter = getXelorState(context, true).sharedMechanismCharges?.get(type);
    if (sharedCounter !== undefined) {
      return sharedCounter;
    }

    if (mechanisms.length === 0) {
      return 0;
    }

    const charges = mechanisms.map(mechanism => getXelorState(context, true).mechanismCharges?.get(mechanism.id) || 0);
    return Math.min(...charges);
  }


  /**
   * Retourne le nombre maximum de charges pour un type de mécanisme
   */
  private getMechanismMaxCharges(type: string): number {
    switch (type) {
      case 'cog': return 10; // Rouage: max 10 charges
      case 'sinistro': return 15; // Sinistro: max 15 charges
      case 'dial': return 0; // Cadran: 12 heures
      case 'regulateur': return 0; // Régulateur n'a pas de charges
      default: return 0;
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
    // TODO: Implémenter l'application des passifs Xelor
    // Exemples:
    // - Rémanence: +1 sinistro et +1 rouage sur le terrain. Les invocations ne cache plus la ligne de vue

    return {...baseStats};
  }

  /**
   * Calcule le coût supplémentaire en ressources pour un sort basé sur les passifs actifs
   */
  public override getSpellExtraCost(spell: Spell, context: SimulationContext): { extraPaCost: number; extraPwCost: number } {
    let extraPaCost = 0;
    let extraPwCost = 0;

    const activePassives = context.activePassiveIds ?? [];

    // Surcoûts conditionnels PILOTÉS PAR LES DONNÉES : effets 'EXTRA_COST_IF_PASSIVE'
    // (ex: Cadran +2 PW si "Connaissance du passé" équipé). Plus de test d'identifiant en dur.
    const variant = spell.variants?.find(v => v.kind === 'NORMAL') ?? spell.variants?.[0];
    for (const effect of variant?.effects ?? []) {
      if (effect.effect !== 'EXTRA_COST_IF_PASSIVE') {
        continue;
      }
      const data = (effect.extendedData ?? {}) as Record<string, any>;
      const passiveId = data['passiveId'];
      if (!passiveId || !activePassives.some(id => id.toLowerCase() === String(passiveId).toLowerCase())) {
        continue;
      }
      const extra = Number(data['extra'] ?? 0);
      if ((data['resource'] ?? 'PW') === 'PA') {
        extraPaCost += extra;
      } else {
        extraPwCost += extra;
      }
      console.log(`[XELOR] 💰 Surcoût ${spell.name}: +${extra} ${data['resource'] ?? 'PW'} (passif ${passiveId})`);
    }

    // Vol du Temps : coût dynamique = base (1 PW) + 1 PW par stack TIME_STEAL déjà accumulé,
    // soit (stacks + 1) PW au total. Le gain de PA équivalent est appliqué dans processClassSpecificEffects.
    if (spell.id === XelorSimulationStrategy.VOL_DU_TEMPS_SPELL_ID) {
      const stacks = getXelorState(context, true).timeStealStacks ?? 0;
      if (stacks > 0) {
        extraPwCost += stacks;
        console.log(`[XELOR VOL_DU_TEMPS] 💰 Coût dynamique: +${stacks} PW (${stacks} stack(s), total ${spell.pwCost + extraPwCost} PW)`);
      }
    }

    // Distorsion : coût dynamique = +1 PW par niveau de "tour de cadran". Reste basé sur l'identifiant
    // de sort car le compteur (distortionPower) est un état de classe (pas de système de stacks générique).
    if (spell.id === XelorSimulationStrategy.DISTORSION_SPELL_ID) {
      const level = Math.min(getXelorState(context, true).distortionPower ?? 0, 4);
      if (level > 0) {
        extraPwCost += level;
        console.log(`[XELOR DISTORSION] 💰 Coût dynamique: +${level} PW (niveau tour de cadran, total PW: ${spell.pwCost + extraPwCost})`);
      }
    }

    return { extraPaCost, extraPwCost };
  }

  /**
   * Vérifie si un sort est un sort de mécanisme Xelor ou un sort spécial (comme Retour Spontané)
   */
  isClassMechanismSpell(spellId: string): boolean {
    if (isSpellMechanism(spellId)) {
      return true;
    }
    return this.castValidator.isRetourSpontaneSpell(spellId);
  }

  public executeClassMechanismSpell(
    action: TimelineAction,
    context: SimulationContext,
    spell: Spell,
    paCost: number,
    pwCost: number
  ): SimulationActionResult {
    return this.mechanisms.executeClassMechanismSpell(action, context, spell, paCost, pwCost);
  }

  /**
   * Initialise le contexte avec les données spécifiques au Xelor
   */
  initializeClassContext(context: SimulationContext, build: Build): void {
    console.log('[XELOR] Initializing class context');

    getXelorState(context, true).mechanismCharges = new Map<string, number>();
    getXelorState(context, true).sharedMechanismCharges = new Map<'cog' | 'sinistro', number>();
    getXelorState(context, true).activeAuras = new Set<string>();
    getXelorState(context, true).currentDialHour = undefined;
    getXelorState(context, true).dialId = undefined;
    getXelorState(context, true).delayedEffects = [];

    getXelorState(context, true).distorsionActive = false;
    getXelorState(context, true).distorsionCooldownRemaining = 0;
    getXelorState(context, true).distortionPower = 0;
    getXelorState(context, true).dialPaBonusGrantedThisTurn = false;
    getXelorState(context, true).permutationDoneThisTurn = false;
    getXelorState(context, true).timeStealStacks = 0;

    const mechanisms = this.boardService.mechanisms();
    mechanisms.forEach(mechanism => {
      const charges = mechanism.charges || 0;
      getXelorState(context, true).mechanismCharges.set(mechanism.id, charges);
      console.log(`[XELOR] Loaded mechanism ${mechanism.type} (${mechanism.id}): ${charges} charges`);
    });

    const initialRouageCharges = this.getSharedChargesForType('cog', this.boardService.getMechanismsByType('cog'), context);
    const initialSinistroCharges = this.getSharedChargesForType('sinistro', this.boardService.getMechanismsByType('sinistro'), context);
    getXelorState(context, true).sharedMechanismCharges.set('cog', initialRouageCharges);
    getXelorState(context, true).sharedMechanismCharges.set('sinistro', initialSinistroCharges);
    console.log(`[XELOR] Shared charges initialized - cog: ${initialRouageCharges}, sinistro: ${initialSinistroCharges}`);

    const dials = this.boardService.getMechanismsByType('dial');
    if (dials.length > 0) {
      const dial = dials[0];
      getXelorState(context, true).dialId = dial.id;
      getXelorState(context, true).currentDialHour = 12;
      getXelorState(context, true).dialFirstLoopCompleted = false;
      getXelorState(context, true).activeAuras.add('DIAL_AURA');
      console.log(`[XELOR] Active dial found (${dial.id}), current hour: ${getXelorState(context, true).currentDialHour}, first loop not yet completed`);
    }

    const rouages = this.boardService.getMechanismsByType('cog');
    if (rouages.length > 0) {
      getXelorState(context, true).activeAuras.add('ROUAGE_AURA');
      console.log(`[XELOR] ${rouages.length} Rouage(s) found - ROUAGE_AURA activated`);
    }

    const sinistros = this.boardService.getMechanismsByType('sinistro');
    if (sinistros.length > 0) {
      getXelorState(context, true).activeAuras.add('SINISTRO_AURA');
      console.log(`[XELOR] ${sinistros.length} Sinistro(s) found - SINISTRO_AURA activated`);
    }

    const regulateurs = this.boardService.getMechanismsByType('regulateur');
    if (regulateurs.length > 0) {
      getXelorState(context, true).activeAuras.add('REGULATOR_PW_AURA');
      console.log(`[XELOR] Régulateur found - REGULATOR_PW_AURA activated`);
    }

    console.log(`[XELOR] Context initialized - ${getXelorState(context, true).mechanismCharges.size} mechanisms, ${getXelorState(context, true).activeAuras!.size} auras`);
  }

  /**
   * Début de tour (chaque TimelineStep = un tour).
   * - Réinitialise les compteurs "par tour" (cap +2 PA du Cadran, garde permutation, usages).
   * - Prémonition : résout un TP différé enregistré au tour précédent.
   * NB : Horlogerie n'est PAS ici — elle se déclenche sur un tour de cadran (voir processHourWrap).
   */
  override onTurnStart(context: SimulationContext): void {
    console.log('[XELOR] Turn start');
    // Reset des compteurs/gardes "par tour" : utilisation par tour/cible, bonus cadran, permutation.
    // (Indispensable depuis le câblage du cycle de tour : sinon les limites "X/tour" et les bonus
    //  1x/tour resteraient bloqués après le 1er tour.)
    context.spellUsageThisTurn?.clear();
    context.spellUsagePerTarget?.clear();
    getXelorState(context, true).dialPaBonusGrantedThisTurn = false;
    getXelorState(context, true).permutationDoneThisTurn = false;
    this.teleport.resolvePremonitionDeferredTeleport(context);
  }

  /**
   * Nettoie les données spécifiques au Xelor à la fin d'un tour
   */
  override cleanupTurn(context: SimulationContext): void {
    console.log('[XELOR] Cleaning up turn');

    // 0. Permutation momentanée — déclencheur "fin de tour" (b) : UNIQUEMENT si aucun tour de cadran
    //    ne l'a déjà déclenchée ce tour (sinon double échange). Sur tour de cadran (a), elle est gérée
    //    dans processHourWrap et peut proc plusieurs fois (une par tour de cadran).
    if (!getXelorState(context, true).permutationDoneThisTurn) {
      this.passive.applyPermutationMomentanee(context);
    }

    // 1. Appliquer les effets de fin de tour des mécanismes
    this.applyEndOfTurnMechanismEffects(context);

    // 2. (désactivé) L'avance automatique de l'heure du cadran en fin de tour n'est pas une règle
    //    Xélor (l'heure avance via les PW dépensés). Réactivée dormante par le câblage du cycle de
    //    tour, elle fausserait tours de cadran/régén -> laissée commentée. À confirmer si besoin.
    // if (getXelorState(context, true).dialId && getXelorState(context, true).currentDialHour !== undefined) {
    //   this.dial.advanceDialHour(context);
    // }

    // 3. Appliquer le bonus PW du Régulateur en fin de tour
    this.applyRegulatorPwBonus(context);

    // 4. Décrémenter le cooldown de Distorsion (relance en cours d'un tour précédent).
    this.decrementDistorsionCooldown(context);

    // 4b. Fin de l'état Distorsion : il ne dure que le tour COMPLET où il a été lancé
    //     (pas un tour de cadran). À la vraie fin de tour, Distorsion se désactive -> Cours du temps
    //     repasse en +1 PW, et la relance (3 tours) démarre. Gardé pour ne pas réarmer le cooldown
    //     sur les tours où Distorsion n'était pas active. Placé APRÈS le décrément pour que la relance
    //     fraîchement posée (3) ne soit pas décrémentée dès ce tour.
    if (getXelorState(context, true).distorsionActive) {
      this.deactivateDistorsion(context);
    }

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
    this.regenerationService.applyRegulateurRegeneration(context);
  }

  /**
   * Applique les effets de fin de tour des mécanismes
   */
  private applyEndOfTurnMechanismEffects(context: SimulationContext): void {
    console.log('[XELOR] Applying end-of-turn mechanism effects');

    if (getXelorState(context, true).activeAuras?.has('ROUAGE_AURA')) {
      this.mechanisms.applyRouageDamage(context);
    }

    if (getXelorState(context, true).activeAuras?.has('SINISTRO_AURA')) {
      this.mechanisms.applySinistroHealing(context);
    }

    // TODO: Autres effets de fin de tour
  }

  /**
   * Traite les effets de tour de cadran (hour wrap)
   * Un tour de cadran se produit lorsque l'heure courante fait un tour complet (passe par 12→1)
   */
  public override onMoveExecuted(
    action: TimelineAction,
    context: SimulationContext,
    validation: MovementValidationResult,
    result: SimulationActionResult
  ): void {
    if (validation.details?.movementType !== 'dial_hour' || validation.cost.wp <= 0) {
      return;
    }

    this.dial.advanceDialHourByPwCost(validation.cost.wp, context);
    result.message = `${result.message} (via dial hour)`;
  }

  /**
   * Active l'état Distorsion
   * Distorsion a un cooldown de 3 tours de relance
   */
  public activateDistorsion(context: SimulationContext): void {
    getXelorState(context, true).distorsionActive = true;
    getXelorState(context, true).distorsionCooldownRemaining = 0;
    // Refonte: la puissance "tour de cadran" retombe à 0 après le cast de Distorsion.
    getXelorState(context, true).distortionPower = 0;
    console.log(`[XELOR DISTORSION] ✅ Distorsion activée`);
  }

  /**
   * Désactive l'état Distorsion (début du cooldown)
   * Le cooldown de 3 tours commence
   */
  public deactivateDistorsion(context: SimulationContext): void {
    getXelorState(context, true).distorsionActive = false;
    getXelorState(context, true).distorsionCooldownRemaining = 3;
    console.log(`[XELOR DISTORSION] ⏰ Distorsion désactivée - cooldown: ${getXelorState(context, true).distorsionCooldownRemaining} tours`);
  }

  /**
   * Décrémente le cooldown de Distorsion en fin de tour
   */
  private decrementDistorsionCooldown(context: SimulationContext): void {
    if (getXelorState(context, true).distorsionCooldownRemaining && getXelorState(context, true).distorsionCooldownRemaining > 0) {
      getXelorState(context, true).distorsionCooldownRemaining--;
      console.log(`[XELOR DISTORSION] ⏰ Cooldown: ${getXelorState(context, true).distorsionCooldownRemaining + 1} → ${getXelorState(context, true).distorsionCooldownRemaining} tours restants`);

      if (getXelorState(context, true).distorsionCooldownRemaining === 0) {
        console.log(`[XELOR DISTORSION] ✅ Distorsion disponible à nouveau`);
      }
    }
  }

  /**
   * Retourne le nombre d'effets différés en attente
   */
  public getDelayedEffectsCount(context: SimulationContext): number {
    return getXelorState(context, true).delayedEffects?.length || 0;
  }

  /**
   * Vide tous les effets différés sans les exécuter
   */
  public clearDelayedEffects(context: SimulationContext): void {
    const count = getXelorState(context, true).delayedEffects?.length || 0;
    getXelorState(context, true).delayedEffects = [];
    console.log(`[XELOR MAITRE_CADRAN] 🗑️ Cleared ${count} delayed effect(s)`);
  }

  /**
   * Vérifie si les dégâts doivent être redirigés vers le Régulateur
   * Tous les dégâts subis par les mécanismes (Rouage, Sinistro, Cadran) sont redirigés vers le Régulateur
   *
   * @param targetMechanismType Le type de mécanisme ciblé
   * @returns true si les dégâts doivent être redirigés
   */
  shouldRedirectDamageToRegulator(targetMechanismType: string): boolean {
    if (targetMechanismType === 'regulateur') {
      return false;
    }

    const regulateurs = this.boardService.getMechanismsByType('regulateur');
    return regulateurs.length > 0;
  }

  /**
   * Redirige les dégâts d'un mécanisme vers le Régulateur
   * Le Régulateur absorbe tous les coups destinés aux autres mécanismes
   *
   * @param damage Les dégâts à rediriger
   * @param sourceMechanismId L'ID du mécanisme initialement ciblé
   * @returns L'ID du Régulateur qui a reçu les dégâts, ou null si pas de redirection
   */
  redirectDamageToRegulator(
    damage: number,
    sourceMechanismId: string,
  ): { regulatorId: string; damageDealt: number } | null {
    const regulateurs = this.boardService.getMechanismsByType('regulateur');

    if (regulateurs.length === 0) {
      console.log(`[XELOR] ❌ No Régulateur to redirect damage to`);
      return null;
    }

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
    // TODO: Implémenter les calculs de dégâts spécifiques aux mécanismes du Xélor
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
}
