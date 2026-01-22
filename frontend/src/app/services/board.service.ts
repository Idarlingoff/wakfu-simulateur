/**
 * Board Service - IMPLEMENTATION
 * Gère l'état du plateau et positionnement des entités
 */

import { Injectable, signal, computed } from '@angular/core';
import { InteractiveBoardState, BoardEntity, Mechanism, DialHour } from '../models/board.model';
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
    dialHours: [], // Heures du cadran (zones visuelles)
    selectedEntityId: undefined,
  });

  // État initial du plateau (sauvegardé avant toute exécution)
  private initialState = signal<InteractiveBoardState | null>(null);

  // Historique des états pour le undo
  private stateHistory = signal<InteractiveBoardState[]>([]);

  // Heure courante du cadran (1-12, undefined si pas de cadran)
  private _currentDialHour = signal<number | undefined>(undefined);

  // ID du cadran actif
  private _activeDialId = signal<string | undefined>(undefined);

  // Computed Selectors
  public state = computed(() => this.boardState());

  // Exposer l'heure courante comme signal public
  public currentDialHour = computed(() => this._currentDialHour());
  public activeDialId = computed(() => this._activeDialId());

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

  public dialHours = computed(() => {
    return this.boardState().dialHours;
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
          classId: 'XEL',
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
      dialHours: [],
      selectedEntityId: undefined
    };
    this.boardState.set(boardState);
  }

  // ============ Entity Management ============

  public addEntity(entity: BoardEntity): void {
    if ('classId' in entity) {
      console.log('[BoardService] addEntity - classId:', entity.classId, 'name:', entity.name);
    }
    this.boardState.update(state => ({
      ...state,
      entities: [...state.entities, entity]
    }));
  }

  public updateEntity(entityId: string, updates: Partial<BoardEntity>): void {
    if ('classId' in updates) {
      console.log('[BoardService] updateEntity - entityId:', entityId, 'classId:', updates.classId);
    }
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
    if (!entity) {
      console.error(`BoardService: Entity not found: ${entityId}`);
      return;
    }

    // Validate bounds
    const state = this.boardState();
    if (position.x < 0 || position.x >= state.cols || position.y < 0 || position.y >= state.rows) {
      console.warn(`Position out of bounds: (${position.x}, ${position.y})`);
      return;
    }

    console.log(`BoardService: Updating ${entity.name} position to (${position.x}, ${position.y})`);

    this.boardState.update(s => ({
      ...s,
      entities: s.entities.map(e =>
        e.id === entityId ? { ...e, position } : e
      )
    }));

    console.log(`BoardService: Position updated for ${entity.name}`);
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

  public getMechanism(mechanismId: string): Mechanism | undefined {
    return this.boardState().mechanisms.find(m => m.id === mechanismId);
  }

  public removeMechanism(mechanismId: string): void {
    this.boardState.update(state => ({
      ...state,
      mechanisms: state.mechanisms.filter(m => m.id !== mechanismId)
    }));
  }

  /**
   * Met à jour les charges d'un mécanisme
   */
  public updateMechanismCharges(mechanismId: string, charges: number): void {
    this.boardState.update(state => ({
      ...state,
      mechanisms: state.mechanisms.map(m =>
        m.id === mechanismId ? { ...m, charges } : m
      )
    }));
  }

  /**
   * Met à jour la position d'un mécanisme
   */
  public updateMechanismPosition(mechanismId: string, position: Position): void {
    const mechanism = this.getMechanism(mechanismId);
    if (!mechanism) {
      console.error(`BoardService: Mechanism not found: ${mechanismId}`);
      return;
    }

    // Validate bounds
    const state = this.boardState();
    if (position.x < 0 || position.x >= state.cols || position.y < 0 || position.y >= state.rows) {
      console.warn(`Mechanism position out of bounds: (${position.x}, ${position.y})`);
      return;
    }

    console.log(`BoardService: Updating mechanism ${mechanism.type} position to (${position.x}, ${position.y})`);

    this.boardState.update(s => ({
      ...s,
      mechanisms: s.mechanisms.map(m =>
        m.id === mechanismId ? { ...m, position } : m
      )
    }));
  }

  /**
   * Récupère tous les mécanismes d'un type spécifique
   */
  public getMechanismsByType(type: 'cog' | 'sinistro' | 'dial' | 'regulateur'): Mechanism[] {
    return this.boardState().mechanisms.filter(m => m.type === type);
  }

  /**
   * Ajoute des charges à un mécanisme
   */
  public addCharges(mechanismId: string, amount: number): void {
    const mechanism = this.getMechanism(mechanismId);
    if (!mechanism) {
      console.warn(`BoardService: Cannot add charges - mechanism not found: ${mechanismId}`);
      return;
    }
    const newCharges = (mechanism.charges || 0) + amount;
    this.updateMechanismCharges(mechanismId, newCharges);
    console.log(`[BoardService] Added ${amount} charges to ${mechanism.type} (${mechanismId}): total = ${newCharges}`);
  }

  /**
   * Vérifie si une position est sur une heure du cadran
   */
  public isPositionOnDialHour(position: Position, dialId?: string): boolean {
    const dialHours = this.boardState().dialHours;
    return dialHours.some(h =>
      h.position.x === position.x &&
      h.position.y === position.y &&
      (dialId === undefined || h.dialId === dialId)
    );
  }

  /**
   * Récupère l'heure du cadran à une position donnée
   */
  public getDialHourAtPosition(position: Position, dialId?: string): number | null {
    const dialHours = this.boardState().dialHours;
    const dialHour = dialHours.find(h =>
      h.position.x === position.x &&
      h.position.y === position.y &&
      (dialId === undefined || h.dialId === dialId)
    );
    return dialHour ? dialHour.hour : null;
  }

  /**
   * Récupère toutes les heures d'un cadran spécifique
   */
  public getDialHours(dialId: string): any[] {
    return this.boardState().dialHours.filter(h => h.dialId === dialId);
  }

  // ============ Dial Hour Tracking ============

  /**
   * Définit l'heure courante du cadran
   * @param hour L'heure (1-12)
   * @param dialId L'ID du cadran associé
   */
  public setCurrentDialHour(hour: number, dialId?: string): void {
    if (hour < 1 || hour > 12) {
      console.error(`[BoardService] Invalid dial hour: ${hour} (must be 1-12)`);
      return;
    }

    this._currentDialHour.set(hour);

    if (dialId) {
      this._activeDialId.set(dialId);
    }

    console.log(`[BoardService] ⏰ Current dial hour set to ${hour}${dialId ? ` (dial: ${dialId})` : ''}`);
  }

  /**
   * Avance l'heure courante du cadran
   * @param hours Nombre d'heures à avancer (peut être négatif pour reculer)
   * @returns La nouvelle heure et si un wrap (tour complet) s'est produit
   */
  public advanceCurrentDialHour(hours: number): { newHour: number; wrapped: boolean } {
    const currentHour = this._currentDialHour();

    if (currentHour === undefined) {
      console.warn(`[BoardService] Cannot advance dial hour: no active dial`);
      return { newHour: 0, wrapped: false };
    }

    const previousHour = currentHour;
    // Calculer la nouvelle heure (1-12)
    let newHour = ((currentHour - 1 + hours) % 12);
    if (newHour < 0) newHour += 12; // Gérer les heures négatives
    newHour += 1;

    // Détecter le wrap (tour complet)
    const wrapped = hours > 0 ? (previousHour + hours > 12) : (hours < 0 && newHour > previousHour);

    this._currentDialHour.set(newHour);

    console.log(`[BoardService] ⏰ Dial hour advanced: ${previousHour} → ${newHour} (${hours > 0 ? '+' : ''}${hours}h)${wrapped ? ' 🔄 WRAPPED!' : ''}`);

    return { newHour, wrapped };
  }

  /**
   * Récupère la position d'une heure spécifique du cadran
   * @param hour L'heure recherchée (1-12)
   * @param dialId L'ID du cadran (optionnel, utilise le cadran actif par défaut)
   */
  public getDialHourPosition(hour: number, dialId?: string): Position | null {
    const targetDialId = dialId || this._activeDialId();

    if (!targetDialId) {
      console.warn(`[BoardService] Cannot get dial hour position: no active dial`);
      return null;
    }

    const dialHours = this.boardState().dialHours;
    const dialHour = dialHours.find(h =>
      h.hour === hour &&
      h.dialId === targetDialId
    );

    return dialHour ? dialHour.position : null;
  }

  /**
   * Téléporte le joueur sur une heure spécifique du cadran
   * @param hour L'heure cible (1-12)
   * @param dialId L'ID du cadran (optionnel)
   * @returns true si la téléportation a réussi
   */
  public teleportPlayerToDialHour(hour: number, dialId?: string): boolean {
    const position = this.getDialHourPosition(hour, dialId);

    if (!position) {
      console.error(`[BoardService] Cannot teleport player: hour ${hour} not found`);
      return false;
    }

    const player = this.player();
    if (!player) {
      console.error(`[BoardService] Cannot teleport player: no player found`);
      return false;
    }

    this.updateEntityPosition(player.id, position);
    console.log(`[BoardService] 🌀 Player teleported to hour ${hour} at (${position.x}, ${position.y})`);

    return true;
  }

  /**
   * Réinitialise l'état du cadran (quand le cadran est détruit)
   */
  public resetDialState(): void {
    this._currentDialHour.set(undefined);
    this._activeDialId.set(undefined);
    console.log(`[BoardService] 🔄 Dial state reset`);
  }

  // ============ Dial Hours Management ============

  public addDialHour(dialHour: DialHour): void {
    const state = this.boardState();
    // Validate position
    if (dialHour.position.x < 0 || dialHour.position.x >= state.cols ||
        dialHour.position.y < 0 || dialHour.position.y >= state.rows) {
      console.warn(`Dial hour position out of bounds: (${dialHour.position.x}, ${dialHour.position.y})`);
      return;
    }

    this.boardState.update(s => ({
      ...s,
      dialHours: [...s.dialHours, dialHour]
    }));
  }

  public removeDialHoursForDial(dialId: string): void {
    this.boardState.update(state => ({
      ...state,
      dialHours: state.dialHours.filter(h => h.dialId !== dialId)
    }));
  }

  public resetToDefault(): void {
    this.boardState.set({
      cols: 13,
      rows: 13,
      entities: [],
      mechanisms: [],
      dialHours: [],
      selectedEntityId: undefined,
      draggedEntity: undefined
    });
  }

  /**
   * Efface complètement le plateau (entités et mécanismes)
   * Réinitialise le plateau avec les entités par défaut
   */
  public clearBoard(): void {
    this.initializeBoard();
    console.log('✅ Plateau effacé et réinitialisé avec les entités par défaut');
  }

  // ============ State Management (Undo/Redo) ============

  /**
   * Sauvegarde l'état initial du plateau (avant toute exécution)
   */
  public saveInitialState(): void {
    const currentState = this.deepCloneState(this.boardState());
    this.initialState.set(currentState);
    this.stateHistory.set([currentState]);
    console.log('État initial du plateau sauvegardé');
  }

  /**
   * Ajoute l'état actuel du plateau à l'historique
   */
  public pushState(): void {
    const currentState = this.deepCloneState(this.boardState());
    const history = this.stateHistory();
    this.stateHistory.set([...history, currentState]);
    console.log(`État du plateau ajouté à l'historique (total: ${history.length + 1})`);
  }

  /**
   * Restaure l'état à un index donné de l'historique
   */
  public restoreStateAtIndex(index: number): void {
    const history = this.stateHistory();
    if (index >= 0 && index < history.length) {
      const stateToRestore = this.deepCloneState(history[index]);
      this.boardState.set(stateToRestore);
      console.log(`État restauré à l'index ${index}`);
    } else {
      console.warn(`Index d'historique invalide: ${index}`);
    }
  }

  /**
   * Restaure l'état initial du plateau
   */
  public restoreInitialState(): void {
    const initial = this.initialState();
    if (initial) {
      this.boardState.set(this.deepCloneState(initial));
      console.log('Plateau réinitialisé à l\'état initial');
    } else {
      console.warn('Aucun état initial sauvegardé, réinitialisation par défaut');
      this.resetToDefault();
    }
  }
  /**
   * Efface l'historique
   */
  public clearHistory(): void {
    this.stateHistory.set([]);
    this.initialState.set(null);
    console.log('Historique effacé');
  }

  /**
   * Clone profond d'un état (pour éviter les références partagées)
   */
  private deepCloneState(state: InteractiveBoardState): InteractiveBoardState {
    return {
      ...state,
      entities: state.entities.map(e => ({
        ...e,
        position: { ...e.position },
        facing: { ...e.facing }
      })),
      mechanisms: state.mechanisms.map(m => ({
        ...m,
        position: { ...m.position }
      })),
      dialHours: state.dialHours ? state.dialHours.map(h => ({
        ...h,
        position: { ...h.position }
      })) : []
    };
  }

  /**
   * Obtient la taille de l'historique
   */
  public getHistorySize(): number {
    return this.stateHistory().length;
  }
}
