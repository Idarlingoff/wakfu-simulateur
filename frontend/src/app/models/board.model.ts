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
  type: 'cog' | 'sinistro' | 'dial';
  position: Position;
  charges?: number;
  turn?: number;
  effects?: string[];
}

export interface InteractiveBoardState extends BoardState {
  mechanisms: Mechanism[];
  draggedEntity?: BoardEntity;
}

