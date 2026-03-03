/**
 * Resource Regeneration Service
 * Service centralisé pour gérer toute la régénération de PA et PW
 *
 * Sources de régénération actuelles et futures:
 * - Dévouement (sort)
 * - Sinistro (mécanisme): 1 PA / 5 charges, max 15 charges = 3 PA max
 * - Régulateur (mécanisme): +1 PW si le régulateur est en vie à la fin de chaque tour
 *   (prend en compte les tours de cadran via Maître du Cadran)
 * - Connaissance du passé (passif)
 * - Cours du temps (passif)
 * - Pointe-heure (sort): rembourse 1 PA si échange effectué
 */

import { Injectable, inject } from '@angular/core';
import { SimulationContext } from '../calculators/simulation-engine.service';
import { BoardService } from '../board.service';
import { getXelorState } from '../strategies/xelor-stragegy/xelor-state.utils';

/**
 * Types de sources de régénération de ressources
 */
export type RegenerationSource =
  // Sorts
  | 'DEVOUEMENT'
  | 'POINTE_HEURE'

  // Mécanismes
  | 'SINISTRO'
  | 'REGULATEUR'

  // Passifs
  | 'CONNAISSANCE_PASSE'
  | 'COURS_DU_TEMPS'

  // Effets de sort génériques
  | 'SPELL_EFFECT'
  | 'REFUND'

  // Autres
  | 'HOUR_WRAP'
  | 'END_OF_TURN'
  | 'UNKNOWN';

/**
 * Type de ressource
 */
export type ResourceType = 'PA' | 'PW';

/**
 * Événement de régénération
 */
export interface RegenerationEvent {
  id: string;
  source: RegenerationSource;
  resourceType: ResourceType;
  amount: number;
  turn: number;
  stepIndex?: number;
  description: string;
  details?: Record<string, any>;
  timestamp: number;
}

/**
 * Résumé de régénération pour un tour/simulation
 */
export interface RegenerationSummary {
  totalPaRegenerated: number;
  totalPwRegenerated: number;
  events: RegenerationEvent[];
  bySource: Map<RegenerationSource, { pa: number; pw: number }>;
}

@Injectable({
  providedIn: 'root'
})
export class ResourceRegenerationService {

  private readonly boardService = inject(BoardService);
  private regenerationHistory: RegenerationEvent[] = [];
  private eventIdCounter = 0;

  /**
   * Régénère des PA et enregistre l'événement
   */
  regeneratePA(
    context: SimulationContext,
    amount: number,
    source: RegenerationSource,
    description: string,
    details?: Record<string, any>
  ): RegenerationEvent {
    const before = context.availablePa;
    context.availablePa += amount;
    const after = context.availablePa;

    const event = this.createEvent('PA', amount, source, description, context.turn || 1, details);
    this.regenerationHistory.push(event);

    this.logRegeneration(event, before, after);

    return event;
  }

  /**
   * Régénère des PW et enregistre l'événement
   */
  regeneratePW(
    context: SimulationContext,
    amount: number,
    source: RegenerationSource,
    description: string,
    details?: Record<string, any>
  ): RegenerationEvent {
    const before = context.availablePw;
    context.availablePw += amount;
    const after = context.availablePw;

    const event = this.createEvent('PW', amount, source, description, context.turn || 1, details);
    this.regenerationHistory.push(event);

    this.logRegeneration(event, before, after);

    return event;
  }

  /**
   * Applique la régénération du Sinistro (1 PA / 5 charges, max 15 charges = 3 PA)
   * Appelé en fin de tour ou lors d'un tour de cadran
   */
  applySinistroRegeneration(context: SimulationContext): RegenerationEvent[] {
    const events: RegenerationEvent[] = [];
    const sinistros = this.boardService.getMechanismsByType('sinistro');
    const playerPosition = context.currentPosition || context.playerPosition;

    sinistros.forEach(sinistro => {
      const distanceToPlayer = Math.abs(sinistro.position.x - playerPosition.x) + Math.abs(sinistro.position.y - playerPosition.y);

      if (distanceToPlayer !== 1) {
        console.log(
          `[REGEN] Sinistro ${sinistro.id} ignoré: joueur trop loin ` +
          `(distance ${distanceToPlayer}, requis: 1)`
        );
        return;
      }

      const charges = getXelorState(context, true).mechanismCharges?.get(sinistro.id) || 0;

      const effectiveCharges = Math.min(charges, 15);
      const paBonus = Math.floor(effectiveCharges / 5);

      if (paBonus > 0) {
        const event = this.regeneratePA(
          context,
          paBonus,
          'SINISTRO',
          `Sinistro: +${paBonus} PA (${charges} charges)`,
          {
            mechanismId: sinistro.id,
            distanceToPlayer,
            charges: charges,
            effectiveCharges: effectiveCharges,
            formula: '1 PA / 5 charges (max 15 charges)'
          }
        );
        events.push(event);
      }
    });

    return events;
  }

  /**
   * Applique la régénération du Régulateur (+1 PW en fin de tour)
   * Appelé en fin de tour ou lors d'un tour de cadran
   */
  applyRegulateurRegeneration(context: SimulationContext): RegenerationEvent[] {
    const events: RegenerationEvent[] = [];
    const regulateurs = this.boardService.getMechanismsByType('regulateur');

    if (regulateurs.length > 0) {
      const pwBonus = regulateurs.length;

      const event = this.regeneratePW(
        context,
        pwBonus,
        'REGULATEUR',
        `Régulateur: +${pwBonus} PW (${regulateurs.length} régulateur(s))`,
        {
          regulateurCount: regulateurs.length,
          regulateurIds: regulateurs.map(r => r.id)
        }
      );
      events.push(event);
    }

    return events;
  }

  /**
   * Applique la régénération d'un effet de sort (ADD_AP/ADD_WP)
   */
  applySpellEffectRegeneration(
    context: SimulationContext,
    resourceType: ResourceType,
    amount: number,
    spellName?: string
  ): RegenerationEvent {
    const description = spellName
      ? `${spellName}: +${amount} ${resourceType}`
      : `Effet de sort: +${amount} ${resourceType}`;

    if (resourceType === 'PA') {
      return this.regeneratePA(context, amount, 'SPELL_EFFECT', description, { spellName });
    } else {
      return this.regeneratePW(context, amount, 'SPELL_EFFECT', description, { spellName });
    }
  }

  /**
   * Applique un remboursement de ressource (REFUND_AP/REFUND_WP)
   */
  applyRefund(
    context: SimulationContext,
    resourceType: ResourceType,
    amount: number,
    reason?: string
  ): RegenerationEvent {
    const description = reason || `Remboursement: +${amount} ${resourceType}`;

    if (resourceType === 'PA') {
      return this.regeneratePA(context, amount, 'REFUND', description);
    } else {
      return this.regeneratePW(context, amount, 'REFUND', description);
    }
  }

  /**
   * Obtient le résumé de régénération pour le tour actuel
   */
  getRegenerationSummary(forTurn?: number): RegenerationSummary {
    const events = forTurn
      ? this.regenerationHistory.filter(e => e.turn === forTurn)
      : this.regenerationHistory;

    const summary: RegenerationSummary = {
      totalPaRegenerated: 0,
      totalPwRegenerated: 0,
      events: events,
      bySource: new Map()
    };

    events.forEach(event => {
      if (event.resourceType === 'PA') {
        summary.totalPaRegenerated += event.amount;
      } else {
        summary.totalPwRegenerated += event.amount;
      }

      const sourceStats = summary.bySource.get(event.source) || { pa: 0, pw: 0 };
      if (event.resourceType === 'PA') {
        sourceStats.pa += event.amount;
      } else {
        sourceStats.pw += event.amount;
      }
      summary.bySource.set(event.source, sourceStats);
    });

    return summary;
  }

  /**
   * Obtient l'historique complet des régénérations
   */
  getRegenerationHistory(): RegenerationEvent[] {
    return [...this.regenerationHistory];
  }

  /**
   * Réinitialise l'historique de régénération
   */
  clearHistory(): void {
    this.regenerationHistory = [];
    this.eventIdCounter = 0;
    console.log('🗑️ [REGENERATION] Historique de régénération effacé');
  }

  /**
   * Affiche un résumé de la régénération dans la console
   */
  logRegenerationSummary(title: string = 'RÉSUMÉ RÉGÉNÉRATION'): void {
    const summary = this.getRegenerationSummary();

    console.log('');
    console.log('💫 ═══════════════════════════════════════════════════');
    console.log(`💫 ${title}`);
    console.log('💫 ═══════════════════════════════════════════════════');
    console.log(`💫 ⚡ Total PA régénérés: +${summary.totalPaRegenerated}`);
    console.log(`💫 🔮 Total PW régénérés: +${summary.totalPwRegenerated}`);

    if (summary.bySource.size > 0) {
      console.log('💫 ─────────────────────────────────────────────────');
      console.log('💫 Par source:');
      summary.bySource.forEach((stats, source) => {
        const parts = [];
        if (stats.pa > 0) parts.push(`+${stats.pa} PA`);
        if (stats.pw > 0) parts.push(`+${stats.pw} PW`);
        console.log(`💫   • ${source}: ${parts.join(', ')}`);
      });
    }

    console.log('💫 ═══════════════════════════════════════════════════');
    console.log('');
  }

  // ============================================
  // MÉTHODES PRIVÉES
  // ============================================

  /**
   * Crée un événement de régénération
   */
  private createEvent(
    resourceType: ResourceType,
    amount: number,
    source: RegenerationSource,
    description: string,
    turn: number,
    details?: Record<string, any>
  ): RegenerationEvent {
    return {
      id: `regen_${++this.eventIdCounter}_${Date.now()}`,
      source,
      resourceType,
      amount,
      turn,
      description,
      details,
      timestamp: Date.now()
    };
  }

  /**
   * Log une régénération avec un format visuel clair
   */
  private logRegeneration(event: RegenerationEvent, before: number, after: number): void {
    const icon = event.resourceType === 'PA' ? '⚡' : '🔮';
    const sourceName = this.getSourceDisplayName(event.source);

    console.log('');
    console.log('💫 ═══════════════════════════════════════════════════');
    console.log(`💫 [RÉGÉNÉRATION ${event.resourceType}] ${sourceName}`);
    console.log('💫 ═══════════════════════════════════════════════════');
    console.log(`💫 ${icon} ${event.resourceType} avant: ${before}`);
    console.log(`💫 ${icon} ${event.resourceType} régénérés: +${event.amount}`);
    console.log(`💫 ${icon} ${event.resourceType} après: ${after}`);
    if (event.details) {
      console.log(`💫 📋 Détails: ${JSON.stringify(event.details)}`);
    }
    console.log('💫 ═══════════════════════════════════════════════════');
    console.log('');
  }

  /**
   * Retourne le nom d'affichage pour une source de régénération
   */
  private getSourceDisplayName(source: RegenerationSource): string {
    const names: Record<RegenerationSource, string> = {
      'DEVOUEMENT': 'Sort Dévouement',
      'POINTE_HEURE': 'Sort Pointe-heure',
      'SINISTRO': 'Mécanisme Sinistro',
      'REGULATEUR': 'Mécanisme Régulateur',
      'CONNAISSANCE_PASSE': 'Passif Connaissance du passé',
      'COURS_DU_TEMPS': 'Passif Cours du temps',
      'SPELL_EFFECT': 'Effet de sort',
      'REFUND': 'Remboursement',
      'HOUR_WRAP': 'Tour de cadran',
      'END_OF_TURN': 'Fin de tour',
      'UNKNOWN': 'Source inconnue'
    };
    return names[source] || source;
  }
}

