/**
 * Mechanism Manager Service
 * Gère les mécanismes du Xélor (Cadran, Sinistro, Rouage, Régulateur)
 * - Gestion des charges (stacking)
 * - Effets de transposition
 * - Interactions avec les mécanismes
 */

import { Injectable, inject } from '@angular/core';
import { BoardService } from '../board.service';
import { Mechanism } from '../../models/board.model';
import { Position } from '../../models/timeline.model';

export interface MechanismChargeInfo {
  mechanismId: string;
  type: string;
  charges: number;
  maxCharges: number;
  canAddCharge: boolean;
}

export interface TranspositionResult {
  success: boolean;
  playerOldPosition: Position;
  playerNewPosition: Position;
  mechanismOldPosition: Position;
  mechanismNewPosition: Position;
  chargesAdded: number; // +1 pour Sinistro et Rouage
}

@Injectable({
  providedIn: 'root'
})
export class MechanismManagerService {
  private readonly boardService = inject(BoardService);

  // Configuration des mécanismes
  private readonly mechanismConfig = {
    sinistro: {
      maxCharges: 3,
      chargePerTransposition: 1
    },
    rouage: {
      maxCharges: 3,
      chargePerTransposition: 1
    },
    dial: {
      maxCharges: 0, // Le cadran n'a pas de charges
      chargePerTransposition: 0
    },
    regulateur: {
      maxCharges: 0, // Le régulateur n'a pas de charges
      chargePerTransposition: 0
    }
  };

  /**
   * Obtient les informations de charge d'un mécanisme
   */
  getMechanismChargeInfo(mechanismId: string): MechanismChargeInfo | null {
    const mechanisms = this.boardService.mechanisms();
    const mechanism = mechanisms.find(m => m.id === mechanismId);

    if (!mechanism) {
      return null;
    }

    const config = this.mechanismConfig[mechanism.type as keyof typeof this.mechanismConfig];

    if (!config) {
      console.warn(`Configuration inconnue pour le mécanisme: ${mechanism.type}`);
      return null;
    }

    return {
      mechanismId: mechanism.id,
      type: mechanism.type,
      charges: mechanism.charges || 0,
      maxCharges: config.maxCharges,
      canAddCharge: (mechanism.charges || 0) < config.maxCharges
    };
  }

  /**
   * Ajoute des charges à un mécanisme
   */
  addCharges(mechanismId: string, amount: number): boolean {
    const info = this.getMechanismChargeInfo(mechanismId);

    if (!info) {
      console.error(`Mécanisme introuvable: ${mechanismId}`);
      return false;
    }

    if (!info.canAddCharge) {
      console.warn(`Le mécanisme ${info.type} a atteint le maximum de charges (${info.maxCharges})`);
      return false;
    }

    const newCharges = Math.min(info.charges + amount, info.maxCharges);
    this.boardService.updateMechanismCharges(mechanismId, newCharges);

    console.log(`✅ ${amount} charge(s) ajoutée(s) au ${info.type} (${info.charges} -> ${newCharges})`);
    return true;
  }

  /**
   * Exécute une transposition entre le joueur et un mécanisme
   * Ajoute automatiquement +1 charge pour Sinistro et Rouage
   */
  executeTransposition(
    mechanismId: string,
    playerPosition: Position
  ): TranspositionResult | null {
    const mechanisms = this.boardService.mechanisms();
    const mechanism = mechanisms.find(m => m.id === mechanismId);

    if (!mechanism) {
      console.error(`Mécanisme introuvable pour transposition: ${mechanismId}`);
      return null;
    }

    const mechanismPosition = mechanism.position;

    // Échanger les positions
    const playerEntity = this.boardService.player();

    if (!playerEntity) {
      console.error('Joueur introuvable sur le plateau');
      return null;
    }

    // Effectuer la transposition
    this.boardService.updateEntityPosition(playerEntity.id, mechanismPosition);
    this.boardService.updateMechanismPosition(mechanismId, playerPosition);

    // Ajouter les charges si c'est un Sinistro ou un Rouage
    let chargesAdded = 0;
    const config = this.mechanismConfig[mechanism.type as keyof typeof this.mechanismConfig];

    if (config && config.chargePerTransposition > 0) {
      const info = this.getMechanismChargeInfo(mechanismId);
      if (info && info.canAddCharge) {
        this.addCharges(mechanismId, config.chargePerTransposition);
        chargesAdded = config.chargePerTransposition;
      }
    }

    console.log(`🔄 Transposition effectuée: Joueur (${playerPosition.x}, ${playerPosition.y}) ↔ ${mechanism.type} (${mechanismPosition.x}, ${mechanismPosition.y})`);

    if (chargesAdded > 0) {
      console.log(`⚡ +${chargesAdded} charge(s) ajoutée(s) au ${mechanism.type}`);
    }

    return {
      success: true,
      playerOldPosition: playerPosition,
      playerNewPosition: mechanismPosition,
      mechanismOldPosition: mechanismPosition,
      mechanismNewPosition: playerPosition,
      chargesAdded
    };
  }

  /**
   * Consomme les charges d'un mécanisme
   * Utilisé quand un sort utilise les charges d'un mécanisme
   */
  consumeCharges(mechanismId: string, amount: number): boolean {
    const info = this.getMechanismChargeInfo(mechanismId);

    if (!info) {
      console.error(`Mécanisme introuvable: ${mechanismId}`);
      return false;
    }

    if (info.charges < amount) {
      console.warn(`Charges insuffisantes pour ${info.type} (besoin: ${amount}, disponible: ${info.charges})`);
      return false;
    }

    const newCharges = info.charges - amount;
    this.boardService.updateMechanismCharges(mechanismId, newCharges);

    console.log(`🔥 ${amount} charge(s) consommée(s) du ${info.type} (${info.charges} -> ${newCharges})`);
    return true;
  }

  /**
   * Obtient le mécanisme à une position donnée
   */
  getMechanismAtPosition(position: Position): Mechanism | null {
    const mechanisms = this.boardService.mechanisms();
    return mechanisms.find(m =>
      m.position.x === position.x && m.position.y === position.y
    ) || null;
  }

  /**
   * Vérifie si une position contient un mécanisme
   */
  hasDialAtPosition(position: Position): boolean {
    const mechanism = this.getMechanismAtPosition(position);
    return mechanism?.type === 'dial';
  }

  /**
   * Obtient tous les mécanismes d'un type donné
   */
  getMechanismsByType(type: string): Mechanism[] {
    const mechanisms = this.boardService.mechanisms();
    return mechanisms.filter(m => m.type === type);
  }

  /**
   * Détruit un mécanisme
   * Utilisé quand un mécanisme expire ou est détruit par un sort
   */
  destroyMechanism(mechanismId: string): boolean {
    const mechanisms = this.boardService.mechanisms();
    const mechanism = mechanisms.find(m => m.id === mechanismId);

    if (!mechanism) {
      console.error(`Mécanisme introuvable: ${mechanismId}`);
      return false;
    }

    this.boardService.removeMechanism(mechanismId);
    console.log(`💥 Mécanisme détruit: ${mechanism.type} à (${mechanism.position.x}, ${mechanism.position.y})`);

    return true;
  }
}

