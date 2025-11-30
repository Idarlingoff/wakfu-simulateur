/**
 * Timeline Model
 * Encapsulates combat timeline and combo sequences
 */

export type ActionType = 'CastSpell' | 'Move' | 'Transpose' | 'ChangeFacing' | 'TriggerMechanism';

export interface Position {
  x: number;
  y: number;
}

export interface Facing {
  direction: 'front' | 'side' | 'back';
}

export interface TimelineAction {
  id: string;
  type: ActionType;
  order: number;
  spellId?: string;
  entityId?: string;
  targetPosition?: Position;
  targetFacing?: Facing;
  details?: Record<string, any>;
  tags?: string[];
}

export interface TimelineStep {
  id: string;
  actions: TimelineAction[];
  description?: string;
}

export interface Timeline {
  id: string;
  name: string;
  buildId: string;
  steps: TimelineStep[];
  currentTurn?: number;
  maxTurns?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ComboPreset {
  id: string;
  name: string;
  description: string;
  timeline: Timeline;
  classId: string;
  tags?: string[];
  createdAt?: Date;
}

export interface SimulationState {
  timeline: Timeline;
  currentStep: number;
  currentTurn: number;
  playerPosition: Position;
  playerFacing: Facing;
  enemies: Array<{
    id: string;
    position: Position;
    facing: Facing;
    name: string;
  }>;
}

