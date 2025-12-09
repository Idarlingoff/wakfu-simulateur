/**
 * Spell Casting Validator Service
 * Gère toutes les validations pour le lancement de sorts
 * - Vérification des ressources (AP, WP, MP)
 * - Vérification de la portée (modifiable ou non)
 * - Vérification de la ligne de vue
 * - Vérification de la zone de lancement (ligne droite, croix, allié, etc.)
 */

import { Injectable } from '@angular/core';
import { Spell } from '../../models/spell.model';
import { Position } from '../../models/timeline.model';
import { SimulationContext } from '../calculators/simulation-engine.service';

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
    console.log(`   Portée du sort: min=${spell.poMin}, max=${spell.poMax}`);

    if (distance < spell.poMin || distance > spell.poMax) {
      console.log(`   ❌ HORS DE PORTÉE !`);
      return {
        canCast: false,
        reason: `Hors de portée (distance: ${distance}, portée: ${spell.poMin}-${spell.poMax})`,
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

    return {
      canCast: true,
      details
    };
  }

  /**
   * Calcule la distance entre deux positions (distance de Chebyshev / distance "en échiquier")
   * C'est la distance utilisée dans Wakfu (max des différences absolues sur x et y)
   * Exemples:
   * - (0,0) -> (3,0) = 3
   * - (0,0) -> (3,3) = 3 (pas 6 comme avec Manhattan)
   * - (0,0) -> (2,4) = 4
   */
  private calculateDistance(pos1: Position, pos2: Position): number {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy);
  }

  /**
   * Vérifie la ligne de vue entre deux positions
   * Utilise l'algorithme de Bresenham pour tracer la ligne
   * Vérifie qu'aucune entité ou mécanisme ne bloque le chemin
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

    // Vérifier qu'aucune cellule intermédiaire ne contient une entité ou un mécanisme bloquant
    for (const pos of linePositions) {
      // Vérifier si une entité bloque (sauf le lanceur et la cible)
      if (context.entities) {
        const entity = context.entities.find(
          e => e.position.x === pos.x && e.position.y === pos.y
        );
        if (entity) {
          console.log(`❌ Ligne de vue bloquée par une entité à (${pos.x}, ${pos.y}):`, entity.name);
          return false;
        }
      }

      // Vérifier si un mécanisme bloque
      // Note: Dans Wakfu, certains mécanismes bloquent la ligne de vue, d'autres non
      // Pour simplifier, on considère que tous les mécanismes bloquent
      if (context.mechanisms) {
        const mechanism = context.mechanisms.find(
          m => m.position.x === pos.x && m.position.y === pos.y
        );
        if (mechanism) {
          console.log(`❌ Ligne de vue bloquée par un mécanisme à (${pos.x}, ${pos.y}):`, mechanism.type);
          return false;
        }
      }
    }

    console.log(`✅ Ligne de vue libre de (${from.x}, ${from.y}) à (${to.x}, ${to.y})`);
    return true;
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

