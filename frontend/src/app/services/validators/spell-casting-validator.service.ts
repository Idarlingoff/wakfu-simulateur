/**
 * Spell Casting Validator Service
 * Gère toutes les validations pour le lancement de sorts
 * - Vérification des ressources (AP, WP, MP)
 * - Vérification de la portée (modifiable ou non)
 * - Vérification de la ligne de vue
 * - Vérification de la zone de lancement (ligne droite, croix, allié, etc.)
 */

import { Injectable, inject } from '@angular/core';
import { Spell } from '../../models/spell.model';
import { Position } from '../../models/timeline.model';
import { SimulationContext } from '../calculators/simulation-engine.service';
import { BoardService } from '../board.service';

export interface SpellCastValidationResult {
  canCast: boolean;
  reason?: string;
  details?: {
    hasEnoughAp?: boolean;
    hasEnoughWp?: boolean;
    hasEnoughMp?: boolean;
    isInRange?: boolean;
    hasLineOfSight?: boolean;
    isValidDirection?: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SpellCastingValidatorService {
  private readonly boardService = inject(BoardService);

  /**
   * Valide si un sort peut être lancé dans les conditions actuelles
   */
  validateSpellCast(
    spell: Spell,
    casterPosition: Position,
    targetPosition: Position,
    context: SimulationContext
  ): SpellCastValidationResult {
    const details = {
      hasEnoughAp: false,
      hasEnoughWp: false,
      hasEnoughMp: false,
      isInRange: false,
      hasLineOfSight: false,
      isValidDirection: false
    };

    // 1. Vérifier les ressources (AP)
    if (context.availablePa < spell.paCost) {
      return {
        canCast: false,
        reason: `PA insuffisants (besoin: ${spell.paCost}, disponible: ${context.availablePa})`,
        details
      };
    }
    details.hasEnoughAp = true;

    // 2. Vérifier les ressources (WP)
    if (context.availablePw < spell.pwCost) {
      return {
        canCast: false,
        reason: `WP insuffisants (besoin: ${spell.pwCost}, disponible: ${context.availablePw})`,
        details
      };
    }
    details.hasEnoughWp = true;
    details.hasEnoughMp = true; // Les sorts ne coûtent pas de MP directement

    // 3. Vérifier la portée
    const distance = this.calculateDistance(casterPosition, targetPosition);

    console.log(`🎯 [PORTÉE] Vérification de la portée du sort "${spell.name}"`);
    console.log(`   Position lanceur: (${casterPosition.x}, ${casterPosition.y})`);
    console.log(`   Position cible: (${targetPosition.x}, ${targetPosition.y})`);
    console.log(`   Distance calculée (Chebyshev): ${distance}`);
    console.log(`   Portée du sort: min=${spell.poMin}, max=${spell.poMax}, modifiable=${spell.poModifiable}`);

    // Si la portée est modifiable, ajouter la portée du joueur (range)
    const playerRange = context.range || 0;
    const effectiveMaxRange = spell.poModifiable ? spell.poMax + playerRange : spell.poMax;

    console.log(`Portée du joueur: +${playerRange}`)
    if (playerRange > 0 && spell.poModifiable) {
      console.log(`   🎯 Portée du joueur: +${playerRange} → Portée effective: ${spell.poMin}-${effectiveMaxRange}`);
    }

    if (distance < spell.poMin || distance > effectiveMaxRange) {
      const rangeInfo = spell.poModifiable && playerRange > 0
        ? `${spell.poMin}-${spell.poMax} (+${playerRange} PO) = ${spell.poMin}-${effectiveMaxRange}`
        : `${spell.poMin}-${spell.poMax}`;

      console.log(`   ❌ HORS DE PORTÉE !`);
      console.log(`   ℹ️  Bonus PO du joueur: ${playerRange}`);
      console.log(`   ℹ️  Portée effective max: ${effectiveMaxRange}`);
      return {
        canCast: false,
        reason: `Hors de portée (distance: ${distance}, portée: ${rangeInfo})`,
        details
      };
    }
    console.log(`   ✅ Distance valide`);
    details.isInRange = true;

    // 4. Vérifier la ligne de vue
    console.log(`👁️ [LIGNE DE VUE] Vérification requise: ${spell.lineOfSight}`);
    if (spell.lineOfSight) {
      const hasLos = this.checkLineOfSight(casterPosition, targetPosition, context);
      if (!hasLos) {
        console.log(`   ❌ LIGNE DE VUE BLOQUÉE !`);
        return {
          canCast: false,
          reason: 'Ligne de vue bloquée',
          details
        };
      }
      console.log(`   ✅ Ligne de vue libre`);
    } else {
      console.log(`   ⏭️ Ligne de vue non requise pour ce sort`);
    }
    details.hasLineOfSight = true;

    // 5. Vérifier la direction de lancement
    const isValidDirection = this.validateSpellDirection(
      spell.direction,
      casterPosition,
      targetPosition
    );

    if (!isValidDirection) {
      return {
        canCast: false,
        reason: `Direction de lancement invalide (requis: ${spell.direction})`,
        details
      };
    }
    details.isValidDirection = true;

    // 6. Vérifier le nombre d'utilisations par tour
    const usePerTurnValidation = this.validateUsePerTurn(spell, context);
    if (!usePerTurnValidation.valid) {
      return {
        canCast: false,
        reason: usePerTurnValidation.reason || 'Limite d\'utilisation par tour atteinte',
        details
      };
    }

    // 7. Vérifier le nombre d'utilisations par cible
    const usePerTargetValidation = this.validateUsePerTarget(spell, targetPosition, context);
    if (!usePerTargetValidation.valid) {
      return {
        canCast: false,
        reason: usePerTargetValidation.reason || 'Limite d\'utilisation par cible atteinte',
        details
      };
    }

    return {
      canCast: true,
      details
    };
  }

  /**
   * Valide le nombre d'utilisations par tour d'un sort
   */
  private validateUsePerTurn(
    spell: Spell,
    context: SimulationContext
  ): { valid: boolean; reason?: string } {
    // Si usePerTurn n'est pas défini ou est très élevé (99), pas de limite
    if (!spell.usePerTurn || spell.usePerTurn >= 99) {
      return { valid: true };
    }

    const currentUsage = context.spellUsageThisTurn?.get(spell.id) || 0;

    console.log(`🔢 [USE PER TURN] Sort "${spell.name}": ${currentUsage}/${spell.usePerTurn} utilisations ce tour`);

    if (currentUsage >= spell.usePerTurn) {
      return {
        valid: false,
        reason: `${spell.name} ne peut être utilisé que ${spell.usePerTurn} fois par tour (déjà utilisé ${currentUsage} fois)`
      };
    }

    return { valid: true };
  }

  /**
   * Valide le nombre d'utilisations par cible d'un sort
   */
  private validateUsePerTarget(
    spell: Spell,
    targetPosition: Position,
    context: SimulationContext
  ): { valid: boolean; reason?: string } {
    // Si usePerTarget n'est pas défini ou est très élevé (99), pas de limite
    if (!spell.usePerTarget || spell.usePerTarget >= 99) {
      return { valid: true };
    }

    const targetKey = `${targetPosition.x},${targetPosition.y}`;
    const spellTargetUsage = context.spellUsagePerTarget?.get(spell.id);
    const currentUsage = spellTargetUsage?.get(targetKey) || 0;

    console.log(`🎯 [USE PER TARGET] Sort "${spell.name}" sur (${targetPosition.x}, ${targetPosition.y}): ${currentUsage}/${spell.usePerTarget} utilisations sur cette cible`);

    if (currentUsage >= spell.usePerTarget) {
      return {
        valid: false,
        reason: `${spell.name} ne peut être utilisé que ${spell.usePerTarget} fois par cible par tour (déjà utilisé ${currentUsage} fois sur cette cible)`
      };
    }

    return { valid: true };
  }

  /**
   * Calcule la distance entre deux positions (distance de manahttan)
   * C'est la distance utilisée dans Wakfu (l'addition des différences absolues sur x et y)
   * Exemples:
   * - (0,0) -> (3,0) = 3
   * - (0,0) -> (3,3) = 6
   * - (0,0) -> (2,4) = 6
   */
  private calculateDistance(pos1: Position, pos2: Position): number {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return dx + dy;
  }

  /**
   * Vérifie la ligne de vue entre deux positions
   * Utilise l'algorithme de Bresenham pour tracer la ligne
   * Vérifie qu'aucune entité ou mécanisme ne bloque le chemin
   *
   * Note: Le passif "Rémanence" (ID: remanence) permet aux mécanismes de ne plus bloquer la ligne de vue
   */
  private checkLineOfSight(
    from: Position,
    to: Position,
    context: SimulationContext
  ): boolean {
    // Si c'est la même position, la ligne de vue est valide
    if (from.x === to.x && from.y === to.y) {
      return true;
    }

    // Récupérer toutes les positions entre from et to (excluant from et to)
    const linePositions = this.getLinePositions(from, to);

    // Vérifier si le passif "Rémanence" est actif (les mécanismes ne bloquent plus la LdV)
    const hasRemanence = this.hasRemanencePassive(context);
    if (hasRemanence) {
      console.log(`   🔮 Passif "Rémanence" actif: les mécanismes ne bloquent pas la ligne de vue`);
    }

    // Vérifier qu'aucune cellule intermédiaire ne contient une entité ou un mécanisme bloquant
    for (const pos of linePositions) {
      // Vérifier si une entité bloque (ennemis, alliés, invocations)
      // Note: Le lanceur et la cible ne sont pas sur ces positions intermédiaires
      if (context.entities) {
        const blockingEntity = context.entities.find(
          (e) => e.position.x === pos.x && e.position.y === pos.y
        );
        if (blockingEntity) {
          console.log(`   ❌ Ligne de vue bloquée par ${blockingEntity.type === 'player' ? 'un allié' : 'un ennemi'} "${blockingEntity.name}" à (${pos.x}, ${pos.y})`);
          return false;
        }
      }

      // Vérifier si un mécanisme bloque (sauf si le passif Rémanence est actif)
      if (!hasRemanence && context.mechanisms) {
        const blockingMechanism = context.mechanisms.find(
          (m) => m.position.x === pos.x && m.position.y === pos.y
        );
        if (blockingMechanism) {
          console.log(`   ❌ Ligne de vue bloquée par un mécanisme "${blockingMechanism.type}" à (${pos.x}, ${pos.y})`);
          return false;
        }
      }
    }

    console.log(`   ✅ Ligne de vue libre de (${from.x}, ${from.y}) à (${to.x}, ${to.y})`);
    return true;
  }

  /**
   * Vérifie si le passif "Rémanence" est actif dans le contexte
   * Le passif Rémanence permet aux mécanismes de ne plus bloquer la ligne de vue
   */
  private hasRemanencePassive(context: SimulationContext): boolean {
    if (!context.activePassiveIds) {
      return false;
    }
    // Vérifier différentes formes possibles de l'ID du passif Rémanence
    const remanenceIds = ['remanence', 'REMANENCE', 'Remanence', 'rémanence', 'Rémanence', 'xelor_remanence'];
    return context.activePassiveIds.some(id =>
      remanenceIds.some(remanenceId =>
        id.toLowerCase().includes(remanenceId.toLowerCase().replace('é', 'e'))
      )
    );
  }

  /**
   * Obtient toutes les positions sur la ligne entre from et to (excluant from et to)
   * Utilise l'algorithme de Bresenham
   */
  private getLinePositions(from: Position, to: Position): Position[] {
    const positions: Position[] = [];

    let x0 = from.x;
    let y0 = from.y;
    const x1 = to.x;
    const y1 = to.y;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      // Avancer d'un pas
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }

      // Si on a atteint la destination, arrêter
      if (x0 === x1 && y0 === y1) {
        break;
      }

      // Ajouter la position intermédiaire
      positions.push({ x: x0, y: y0 });
    }

    return positions;
  }

  /**
   * Valide la direction de lancement d'un sort
   * @param direction - Type de direction: LINE (ligne droite), CROSS (croix), CIRCLE (cercle), NONE (aucune restriction)
   */
  private validateSpellDirection(
    direction: string,
    casterPosition: Position,
    targetPosition: Position
  ): boolean {
    const dx = targetPosition.x - casterPosition.x;
    const dy = targetPosition.y - casterPosition.y;

    switch (direction.toUpperCase()) {
      case 'NONE':
        // Aucune restriction de direction
        return true;

      case 'LINE':
        // Ligne droite (horizontal ou vertical)
        return dx === 0 || dy === 0;

      case 'CROSS':
        // Croix (ligne droite horizontal, vertical ou diagonal)
        return dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);

      case 'DIAGONAL':
        // Uniquement diagonal
        return Math.abs(dx) === Math.abs(dy) && dx !== 0;

      case 'CIRCLE':
        // Cercle (toutes les positions à portée)
        return true;

      default:
        console.warn(`Direction de sort inconnue: ${direction}`);
        return true;
    }
  }

  /**
   * Obtient toutes les cellules affectées par un sort selon sa zone d'effet
   * TODO: Implémenter les différents types de zones d'effet
   */
  getAffectedCells(
    spell: Spell,
    targetPosition: Position
  ): Position[] {
    // Pour l'instant, retourner uniquement la cible
    // TODO: Implémenter les zones d'effet (AOE)
    return [targetPosition];
  }
}

