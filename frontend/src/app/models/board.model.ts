/**
 * Board Model
 * Encapsulates board state and entity positions
 */

import { Position, Facing } from './timeline.model';

export interface BoardEntity {
  id: string;
  type: 'player' | 'enemy';
  name: string;
  classId?: string;
  position: Position;
  facing: Facing;
  icon?: string;
}

export interface BoardState {
  cols: number;
  rows: number;
  entities: BoardEntity[];
  selectedEntityId?: string;
}

export interface Mechanism {
  id: string;
  type: 'cog' | 'sinistro' | 'dial' | 'regulateur';
  position: Position;
  charges?: number;
  turn?: number;
  effects?: string[];
  spellId?: string; // ID du sort qui a créé le mécanisme
}

/**
 * Heure du cadran - Zone visuelle/de déplacement, PAS un mécanisme
 */
export interface DialHour {
  id: string;
  dialId: string; // ID du cadran central
  hour: number; // 1-12
  position: Position;
}

export interface InteractiveBoardState extends BoardState {
  mechanisms: Mechanism[];
  dialHours: DialHour[]; // Heures du cadran (zones visuelles)
  draggedEntity?: BoardEntity;
}

