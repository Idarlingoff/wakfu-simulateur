/**
 * Movement Validator Service
 * Gère toutes les validations pour les déplacements
 * - Déplacement normal (coût en MP)
 * - Déplacement sur les heures du cadran (coût en WP)
 * - Déplacement de l'heure courante (1 WP = 1 heure avancée)
 */
import { Injectable, inject } from '@angular/core';
import { Position } from '../../models/timeline.model';
import { SimulationContext } from '../calculators/simulation-engine.service';
import { BoardService } from '../board.service';
export interface MovementValidationResult {
  canMove: boolean;
  reason?: string;
  cost: {
    mp: number;
    wp: number;
  };
  details?: {
    isOnDialHour?: boolean;
    dialHourNumber?: number;
    movementType?: 'normal' | 'dial_hour' | 'dial_advance';
  };
}
@Injectable({
  providedIn: 'root'
})
export class MovementValidatorService {
  private readonly boardService = inject(BoardService);
  validateMovement(
    from: Position,
    to: Position,
    context: SimulationContext
  ): MovementValidationResult {
    const isOnDialHour = this.isPositionOnDialHour(from);
    if (isOnDialHour) {
      return this.validateDialHourMovement(from, to, context);
    } else {
      return this.validateNormalMovement(from, to, context);
    }
  }
  private validateNormalMovement(
    from: Position,
    to: Position,
    context: SimulationContext
  ): MovementValidationResult {
    const mpCost = this.calculateDistance(from, to);
    if (context.availableMp < mpCost) {
      return {
        canMove: false,
        reason: `MP insuffisants (besoin: ${mpCost}, disponible: ${context.availableMp})`,
        cost: { mp: mpCost, wp: 0 },
        details: { movementType: 'normal' }
      };
    }
    return {
      canMove: true,
      cost: { mp: mpCost, wp: 0 },
      details: { movementType: 'normal' }
    };
  }
  private validateDialHourMovement(
    from: Position,
    to: Position,
    context: SimulationContext
  ): MovementValidationResult {
    const wpCost = 1
    const dialHour = this.getDialHourAtPosition(from);
    const dialHourNumber = dialHour?.hour || 0;
    if (context.availablePw < wpCost) {
      return {
        canMove: false,
        reason: `WP insuffisants pour se déplacer depuis l'heure ${dialHourNumber} (besoin: ${wpCost}, disponible: ${context.availablePw})`,
        cost: { mp: 0, wp: wpCost },
        details: {
          isOnDialHour: true,
          dialHourNumber,
          movementType: 'dial_hour'
        }
      };
    }
    return {
      canMove: true,
      cost: { mp: 0, wp: wpCost },
      details: {
        isOnDialHour: true,
        dialHourNumber,
        movementType: 'dial_hour'
      }
    };
  }

  private isPositionOnDialHour(position: Position): boolean {
    const dialHours = this.boardService.dialHours();
    return dialHours.some(hour => hour.position.x === position.x && hour.position.y === position.y);
  }

  private getDialHourAtPosition(position: Position) {
    const dialHours = this.boardService.dialHours();
    return dialHours.find(hour => hour.position.x === position.x && hour.position.y === position.y);
  }

  private calculateDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  isPathClear(from: Position, to: Position, context: SimulationContext): boolean {
    return true;
  }
}

