/**
 * Board Service - IMPLEMENTATION
 * Gère l'état du plateau et positionnement des entités
 */

import { Injectable, signal, computed } from '@angular/core';
import { InteractiveBoardState, BoardEntity, Mechanism, DialHour } from '../models/board.model';
import { Position, Facing, TimelineBoardSetup } from '../models/timeline.model';

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

  // Historique de l'heure du dial (synchronisé avec stateHistory)
  private dialHourHistory = signal<Array<{ hour: number | undefined; dialId: string | undefined }>>([]);
  private initialDialState = signal<{ hour: number | undefined; dialId: string | undefined } | null>(null);

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
    this.boardState.set(this.createEmptyBoardState());
  }

  private createEmptyBoardState(): InteractiveBoardState {
    return {      cols: 13,
      rows: 13,
      entities: [],
      mechanisms: [],
      dialHours: [],
      selectedEntityId: undefined,
      draggedEntity: undefined
    };
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

  /**
   * Récupère l'entité à une position donnée (s'il y en a une)
   * @param position La position à vérifier
   * @returns L'entité à cette position ou undefined
   */
  public getEntityAtPosition(position: Position): BoardEntity | undefined {
    return this.boardState().entities.find(e =>
      e.position.x === position.x && e.position.y === position.y
    );
  }

  /**
   * Récupère le mécanisme à une position donnée (s'il y en a un)
   * @param position La position à vérifier
   * @returns Le mécanisme à cette position ou undefined
   */
  public getMechanismAtPosition(position: Position): Mechanism | undefined {
    return this.boardState().mechanisms.find(m =>
      m.position.x === position.x && m.position.y === position.y
    );
  }

  /**
   * Échange la position d'une entité avec celle d'un mécanisme
   * @param entityId ID de l'entité
   * @param mechanismId ID du mécanisme
   * @returns true si l'échange a réussi
   */
  public swapEntityWithMechanism(entityId: string, mechanismId: string): boolean {
    const entity = this.getEntity(entityId);
    const mechanism = this.getMechanism(mechanismId);

    if (!entity || !mechanism) {
      console.error(`[BoardService] Cannot swap: entity or mechanism not found (entity: ${entityId}, mechanism: ${mechanismId})`);
      return false;
    }

    const entityPos = { ...entity.position };
    const mechanismPos = { ...mechanism.position };

    console.log(`[BoardService] 🔄 Swapping entity/mechanism: ${entity.name} (${entityPos.x}, ${entityPos.y}) <-> ${mechanism.type} (${mechanismPos.x}, ${mechanismPos.y})`);

    this.boardState.update(state => {
      console.log(`[BoardService] 📍 BEFORE UPDATE - mechanisms:`, state.mechanisms.map(m => ({ id: m.id, type: m.type, pos: m.position })));

      const newState = {
        ...state,
        entities: state.entities.map(e =>
          e.id === entityId ? { ...e, position: mechanismPos } : e
        ),
        mechanisms: state.mechanisms.map(m =>
          m.id === mechanismId ? { ...m, position: entityPos } : m
        )
      };

      console.log(`[BoardService] 📍 AFTER UPDATE - mechanisms:`, newState.mechanisms.map(m => ({ id: m.id, type: m.type, pos: m.position })));
      return newState;
    });

    console.log(`[BoardService] ✅ Entity/Mechanism swap successful`);
    return true;
  }

  /**
   * Échange les positions de deux entités
   * @param entityId1 ID de la première entité
   * @param entityId2 ID de la deuxième entité
   * @returns true si l'échange a réussi
   */
  public swapEntityPositions(entityId1: string, entityId2: string): boolean {
    const entity1 = this.getEntity(entityId1);
    const entity2 = this.getEntity(entityId2);

    if (!entity1 || !entity2) {
      console.error(`[BoardService] Cannot swap positions: entity not found (${entityId1} or ${entityId2})`);
      return false;
    }

    const pos1 = { ...entity1.position };
    const pos2 = { ...entity2.position };

    console.log(`[BoardService] 🔄 Swapping positions: ${entity1.name} (${pos1.x}, ${pos1.y}) <-> ${entity2.name} (${pos2.x}, ${pos2.y})`);

    this.boardState.update(state => ({
      ...state,
      entities: state.entities.map(e => {
        if (e.id === entityId1) {
          return { ...e, position: pos2 };
        }
        if (e.id === entityId2) {
          return { ...e, position: pos1 };
        }
        return e;
      })
    }));

    console.log(`[BoardService] ✅ Positions swapped successfully`);
    return true;
  }

  /**
   * Échange les positions de deux mécanismes
   * @param mechanismId1 ID du premier mécanisme
   * @param mechanismId2 ID du deuxième mécanisme
   * @returns true si l'échange a réussi
   */
  public swapMechanismPositions(mechanismId1: string, mechanismId2: string): boolean {
    const mechanism1 = this.getMechanism(mechanismId1);
    const mechanism2 = this.getMechanism(mechanismId2);

    if (!mechanism1 || !mechanism2) {
      console.error(`[BoardService] Cannot swap mechanism positions: mechanism not found (${mechanismId1} or ${mechanismId2})`);
      return false;
    }

    const pos1 = { ...mechanism1.position };
    const pos2 = { ...mechanism2.position };

    console.log(`[BoardService] 🔄 Swapping mechanism positions: ${mechanism1.type} (${pos1.x}, ${pos1.y}) <-> ${mechanism2.type} (${pos2.x}, ${pos2.y})`);

    this.boardState.update(state => ({
      ...state,
      mechanisms: state.mechanisms.map(m => {
        if (m.id === mechanismId1) {
          return { ...m, position: pos2 };
        }
        if (m.id === mechanismId2) {
          return { ...m, position: pos1 };
        }
        return m;
      })
    }));

    console.log(`[BoardService] ✅ Mechanism positions swapped successfully`);
    return true;
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

    // Check if a mechanism of the same type already exists at this position
    const existingMechanism = state.mechanisms.find(
      m => m.position.x === mechanism.position.x &&
           m.position.y === mechanism.position.y &&
           m.type === mechanism.type
    );

    if (existingMechanism) {
      console.warn(`Mechanism of type ${mechanism.type} already exists at position (${mechanism.position.x}, ${mechanism.position.y})`);
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
    this.boardState.set(this.createEmptyBoardState());
  }

  /**
   * Efface complètement le plateau (entités et mécanismes)
   * Réinitialise le plateau avec les entités par défaut
   */
  public clearBoard(): void {
    this.initializeBoard();
    console.log('✅ Plateau effacé et réinitialisé');
  }



  public applyTimelineSetup(setup?: TimelineBoardSetup): void {
    this.clearHistory();
    this.resetDialState();

    if (!setup || setup.entities.length === 0) {
      this.resetToDefault();
      return;
    }

    this.boardState.update(state => ({
      ...state,
      entities: setup.entities.map(entity => ({
        id: entity.id,
        type: entity.type,
        name: entity.name,
        classId: entity.classId,
        position: { ...entity.position },
        facing: { ...entity.facing }
      })),
      mechanisms: [],
      dialHours: [],
      selectedEntityId: undefined,
      draggedEntity: undefined
    }));
  }

  public exportCurrentSetup(): TimelineBoardSetup {
    const state = this.boardState();
    return {
      entities: state.entities.map(entity => ({
        id: entity.id,
        type: entity.type,
        name: entity.name,
        classId: entity.classId,
        position: { ...entity.position },
        facing: { ...entity.facing }
      }))
    };
  }

  public hasMinimumSetup(): boolean {
    const entities = this.boardState().entities;
    const allies = entities.filter(entity => entity.type === 'player').length;
    const enemies = entities.filter(entity => entity.type === 'enemy').length;
    return allies >= 1 && enemies >= 1;  }

  // ============ State Management (Undo/Redo) ============

  /**
   * Sauvegarde l'état initial du plateau (avant toute exécution)
   */
  public saveInitialState(): void {
    const currentState = this.deepCloneState(this.boardState());
    this.initialState.set(currentState);
    this.stateHistory.set([currentState]);

    // Sauvegarder l'état initial du dial
    const dialState = { hour: this._currentDialHour(), dialId: this._activeDialId() };
    this.initialDialState.set(dialState);
    this.dialHourHistory.set([dialState]);

    console.log('État initial du plateau sauvegardé (heure dial:', dialState.hour, ')');
  }

  /**
   * Ajoute l'état actuel du plateau à l'historique
   */
  public pushState(): void {
    const currentState = this.deepCloneState(this.boardState());
    const history = this.stateHistory();
    this.stateHistory.set([...history, currentState]);

    // Sauvegarder l'état du dial dans l'historique
    const dialState = { hour: this._currentDialHour(), dialId: this._activeDialId() };
    const dialHistory = this.dialHourHistory();
    this.dialHourHistory.set([...dialHistory, dialState]);

    console.log(`État du plateau ajouté à l'historique (total: ${history.length + 1}, heure dial: ${dialState.hour})`);
  }

  /**
   * Restaure l'état à un index donné de l'historique
   * IMPORTANT: Tronque l'historique pour permettre une ré-exécution propre des steps
   */
  public restoreStateAtIndex(index: number): void {
    const history = this.stateHistory();
    if (index >= 0 && index < history.length) {
      const stateToRestore = this.deepCloneState(history[index]);
      this.boardState.set(stateToRestore);

      // Restaurer l'état du dial
      const dialHistory = this.dialHourHistory();
      if (index < dialHistory.length) {
        const dialState = dialHistory[index];
        this._currentDialHour.set(dialState.hour);
        this._activeDialId.set(dialState.dialId);

        // Tronquer l'historique du dial pour ne garder que jusqu'à l'index restauré
        this.dialHourHistory.set(dialHistory.slice(0, index + 1));
      }

      // Tronquer l'historique du board pour ne garder que jusqu'à l'index restauré
      this.stateHistory.set(history.slice(0, index + 1));

      console.log(`État restauré à l'index ${index} (heure dial: ${this._currentDialHour()}) - Historique tronqué`);
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

      // Restaurer l'état initial du dial
      const initialDial = this.initialDialState();
      if (initialDial) {
        this._currentDialHour.set(initialDial.hour);
        this._activeDialId.set(initialDial.dialId);
      } else {
        this._currentDialHour.set(undefined);
        this._activeDialId.set(undefined);
      }

      console.log('Plateau réinitialisé à l\'état initial (heure dial:', initialDial?.hour, ')');
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
    this.dialHourHistory.set([]);
    this.initialDialState.set(null);
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
