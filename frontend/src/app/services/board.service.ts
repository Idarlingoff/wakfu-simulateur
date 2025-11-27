/**
 * Board Service - IMPLEMENTATION
 * Gère l'état du plateau et positionnement des entités
 */

import { Injectable, signal, computed } from '@angular/core';
import { InteractiveBoardState, BoardEntity, Mechanism } from '../models/board.model';
import { Position, Facing } from '../models/timeline.model';

@Injectable({
  providedIn: 'root'
})
export class BoardService {
  // State Signal
  private boardState = signal<InteractiveBoardState>({
    cols: 13,
    rows: 13,
    entities: [],
    mechanisms: [],
    selectedEntityId: undefined,
    draggedEntity: undefined
  });

  // Computed Selectors
  public state = computed(() => this.boardState());

  public selectedEntity = computed(() => {
    const state = this.boardState();
    return state.selectedEntityId
      ? state.entities.find(e => e.id === state.selectedEntityId)
      : null;
  });

  public enemies = computed(() => {
    return this.boardState().entities.filter(e => e.type === 'enemy');
  });

  public players = computed(() => {
    return this.boardState().entities.filter(e => e.type === 'player');
  });

  public player = computed(() => {
    return this.boardState().entities.find(e => e.type === 'player');
  });

  public mechanisms = computed(() => {
    return this.boardState().mechanisms;
  });

  constructor() {
    this.initializeBoard();
  }

  /**
   * Initialize board with default state
   */
  private initializeBoard(): void {
    const boardState: InteractiveBoardState = {
      cols: 13,
      rows: 13,
      entities: [
        {
          id: 'player_1',
          type: 'player',
          name: 'Xélor',
          classId: 'xelor',
          position: { x: 6, y: 10 },
          facing: { direction: 'front' }
        },
        {
          id: 'enemy_1',
          type: 'enemy',
          name: 'Enemy #1',
          position: { x: 8, y: 10 },
          facing: { direction: 'front' }
        },
        {
          id: 'enemy_2',
          type: 'enemy',
          name: 'Enemy #2',
          position: { x: 11, y: 9 },
          facing: { direction: 'front' }
        }
      ],
      mechanisms: [],
      selectedEntityId: undefined
    };

    this.boardState.set(boardState);
  }

  // ============ Entity Management ============

  public addEntity(entity: BoardEntity): void {
    this.boardState.update(state => ({
      ...state,
      entities: [...state.entities, entity]
    }));
  }

  public updateEntity(entityId: string, updates: Partial<BoardEntity>): void {
    this.boardState.update(state => ({
      ...state,
      entities: state.entities.map(e =>
        e.id === entityId ? { ...e, ...updates } : e
      )
    }));
  }

  public removeEntity(entityId: string): void {
    this.boardState.update(state => ({
      ...state,
      entities: state.entities.filter(e => e.id !== entityId),
      selectedEntityId: state.selectedEntityId === entityId ? undefined : state.selectedEntityId
    }));
  }

  public getEntity(entityId: string): BoardEntity | undefined {
    return this.boardState().entities.find(e => e.id === entityId);
  }

  // ============ Positioning ============

  public updateEntityPosition(entityId: string, position: Position): void {
    const entity = this.getEntity(entityId);
    if (!entity) return;

    // Validate bounds
    const state = this.boardState();
    if (position.x < 0 || position.x >= state.cols || position.y < 0 || position.y >= state.rows) {
      console.warn(`Position out of bounds: (${position.x}, ${position.y})`);
      return;
    }

    this.boardState.update(s => ({
      ...s,
      entities: s.entities.map(e =>
        e.id === entityId ? { ...e, position } : e
      )
    }));
  }

  public updateEntityFacing(entityId: string, facing: Facing): void {
    this.boardState.update(state => ({
      ...state,
      entities: state.entities.map(e =>
        e.id === entityId ? { ...e, facing } : e
      )
    }));
  }

  public selectEntity(entityId: string | undefined): void {
    this.boardState.update(state => ({
      ...state,
      selectedEntityId: entityId
    }));
  }

  public setDraggedEntity(entity: BoardEntity | undefined): void {
    this.boardState.update(state => ({
      ...state,
      draggedEntity: entity
    }));
  }

  // ============ Mechanism Management ============

  public addMechanism(mechanism: Mechanism): void {
    // Validate position
    const state = this.boardState();
    if (mechanism.position.x < 0 || mechanism.position.x >= state.cols ||
        mechanism.position.y < 0 || mechanism.position.y >= state.rows) {
      console.warn(`Mechanism position out of bounds: (${mechanism.position.x}, ${mechanism.position.y})`);
      return;
    }

    this.boardState.update(s => ({
      ...s,
      mechanisms: [...s.mechanisms, mechanism]
    }));
  }

  public removeMechanism(mechanismId: string): void {
    this.boardState.update(state => ({
      ...state,
      mechanisms: state.mechanisms.filter(m => m.id !== mechanismId)
    }));
  }

  public updateMechanism(mechanismId: string, updates: Partial<Mechanism>): void {
    this.boardState.update(state => ({
      ...state,
      mechanisms: state.mechanisms.map(m =>
        m.id === mechanismId ? { ...m, ...updates } : m
      )
    }));
  }

  public getMechanism(mechanismId: string): Mechanism | undefined {
    return this.boardState().mechanisms.find(m => m.id === mechanismId);
  }

  public getMechanismsAtPosition(position: Position): Mechanism[] {
    return this.boardState().mechanisms.filter(m =>
      m.position.x === position.x && m.position.y === position.y
    );
  }

  // ============ Queries ============

  public getEntitiesAtPosition(position: Position): BoardEntity[] {
    return this.boardState().entities.filter(e =>
      e.position.x === position.x && e.position.y === position.y
    );
  }

  public calculateDistance(pos1: Position, pos2: Position): number {
    return Math.max(
      Math.abs(pos1.x - pos2.x),
      Math.abs(pos1.y - pos2.y)
    );
  }

  public isAdjacent(pos1: Position, pos2: Position): boolean {
    return this.calculateDistance(pos1, pos2) === 1;
  }

  // ============ Reset ============

  public clearBoard(): void {
    this.boardState.update(state => ({
      ...state,
      entities: [],
      mechanisms: [],
      selectedEntityId: undefined,
      draggedEntity: undefined
    }));
  }

  public resetToDefault(): void {
    this.initializeBoard();
  }
}

