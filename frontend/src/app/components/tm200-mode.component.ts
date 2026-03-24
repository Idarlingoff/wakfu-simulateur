import { Component, signal, computed, OnInit, OnDestroy, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TM200EntityType = 'ally' | 'enemy';

export interface TM200Entity {
  id: string;
  type: TM200EntityType;
  name: string;
  icon: string;
  colorClass: string;
  spawnX: number;
  spawnY: number;
  currentX: number;
  currentY: number;
  dead: boolean;
  isBeingDragged: boolean;
}

export interface TM200Crystal {
  id: string;
  x: number;
  y: number;
  color: 'red' | 'blue' | 'green' | 'yellow' | 'purple';
  label: string;
  level: number;
  active: boolean;
  highlighted: boolean;
}

export type TM200CellType = 'floor' | 'wall' | 'void' | 'border' | 'spawn-ally' | 'spawn-enemy' | 'crystal-zone' | 'boss-zone';

interface TM200Cell {
  x: number;
  y: number;
  type: TM200CellType;
  entities: TM200Entity[];
  crystal: TM200Crystal | null;
}

const MAP_MASK: string[] = [
  '.....SSSS......',
  '....SNNNNS.....',
  '....SNNNNNS....',
  '...SNNNNNNNS...',
  '..SNNNNNNNNNS..',
  '.SNNNNNNNNNNNS.',
  'SNNNNNNNNNNNNNS',
  'SNNNNNNNNNNNNNS',
  'SNNNNNNNNNNNNNS',
  'SNNNNNNNNNNNNNS',
  '.SNNNNNNNNNNNNS',
  '..SNNNNNNNNNNNS',
  '...SNNNNNNNNNNS',
  '....SNNNNNNNNNS',
  '.....SNNNNNNNS.',
  '......SSSSSSS..',
];

const COLS = Math.max(...MAP_MASK.map(r => r.length));
const ROWS = MAP_MASK.length;

function maskChar(x: number, y: number): string {
  if (y < 0 || y >= ROWS) return '.';
  const row = MAP_MASK[y];
  if (x < 0 || x >= row.length) return '.';
  return row[x];
}

function isVoid(x: number, y: number): boolean {
  return maskChar(x, y) === '.';
}

const WALL_CELLS: [number, number][] = [];

const CRYSTAL_DEFS: Omit<TM200Crystal, 'active' | 'highlighted' | 'level'>[] = [
  { id: 'crystal_1', x: 7,  y: 3,  color: 'green',  label: 'Cristal 1 (7,3)'  },
  { id: 'crystal_2', x: 11, y: 9,  color: 'yellow', label: 'Cristal 2 (11,9)' },
  { id: 'crystal_3', x: 7,  y: 12, color: 'blue',   label: 'Cristal 3 (7,12)' },
  { id: 'crystal_4', x: 3,  y: 8,  color: 'purple', label: 'Cristal 4 (3,8)'  },
];

function getCrystalZone(cx: number, cy: number, level: number): Set<string> {
  const zone = new Set<string>();
  if (level <= 0) return zone;
  const r = Math.ceil(level / 2);
  const isCross = level % 2 === 1;
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      if (dx === 0 && dy === 0) continue;
      const inZone = isCross
        ? Math.abs(dx) + Math.abs(dy) <= r
        : Math.max(Math.abs(dx), Math.abs(dy)) <= r;
      if (inZone) zone.add(`${cx + dx},${cy + dy}`);
    }
  }
  return zone;
}

const CRYSTAL_LEVEL_LABELS = ['Inactif', 'Croix r1', 'Carre r1', 'Croix r2', 'Carre r2', 'Croix r3'];
const CRYSTAL_LEVEL_ICONS  = ['X', '1', '2', '3', '4', '5'];
const MAX_CRYSTAL_LEVEL = 5;

const ALLY_SPAWN_CELLS: [number, number][] = [
  [6,  14],
  [10, 14],
  [8,  13],
  [10, 11],
  [12, 13],
];

const INITIAL_ENTITIES: Omit<TM200Entity, 'currentX' | 'currentY' | 'dead' | 'isBeingDragged'>[] = [
  { id: 'ally_1', type: 'ally',  name: 'Dpt',     icon: '🧙', colorClass: 'ally-1',    spawnX: 6,  spawnY: 14 },
  { id: 'ally_2', type: 'ally',  name: 'Placeur',  icon: '🧙', colorClass: 'ally-2',    spawnX: 10, spawnY: 14 },
  { id: 'ally_3', type: 'ally',  name: 'Soin',     icon: '🧙', colorClass: 'ally-3',    spawnX: 8,  spawnY: 13 },
  { id: 'enemy_1', type: 'enemy', name: 'Boss',      icon: '👹', colorClass: 'enemy-boss', spawnX: 8,  spawnY: 5  },
  { id: 'enemy_2', type: 'enemy', name: 'Ennemi 1',  icon: '👹', colorClass: 'enemy-1',   spawnX: 7,  spawnY: 8  },
  { id: 'enemy_3', type: 'enemy', name: 'Ennemi 2',  icon: '👹', colorClass: 'enemy-2',   spawnX: 4,  spawnY: 9  },
  { id: 'enemy_4', type: 'enemy', name: 'Ennemi 3',  icon: '👹', colorClass: 'enemy-3',   spawnX: 12, spawnY: 7  },
];

const TURN_ORDER = ['enemy_1', 'ally_3', 'enemy_2', 'ally_2', 'enemy_3', 'ally_1', 'enemy_4'];

@Component({
  selector: 'app-tm200-mode',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tm200-overlay">
      <div class="tm200-panel">

        <div class="tm200-header">
          <div class="tm200-title">
            <span class="tm200-badge">TM 200</span>
            <span class="tm200-subtitle">Salle des Cristaux - Irradiation Cristalline</span>
          </div>
          <div class="tm200-turn-info">
            @if (isPlacementPhase()) {
              <span class="placement-badge">Phase de placement</span>
              <span class="placement-hint">Cliquez sur un spawn pour placer vos allies</span>
            } @else {
              <span class="turn-label">Tour {{ turnNumber() }}</span>
              <span class="current-turn-badge" [style.background]="currentEntityColor()">
                {{ currentEntityIcon() }} {{ currentEntityName() }}
              </span>
            }
          </div>
          <div class="tm200-controls">
            @if (isPlacementPhase()) {
              <button class="btn-tm ctrl-btn primary" (click)="startCombat()" [disabled]="!allAlliesPlaced()">Lancer le combat</button>
            } @else {
              <button class="btn-tm ctrl-btn" (click)="prevTurn()" [disabled]="turnNumber() <= 1">Prec.</button>
              <button class="btn-tm ctrl-btn primary" (click)="nextTurn()">Suiv.</button>
              <button class="btn-tm ctrl-btn" [class.active-mode]="isHighlightMode()" (click)="toggleHighlightMode()">
                {{ isHighlightMode() ? 'Surb. ON' : 'Surb.' }}
              </button>
              @if (highlighted().size > 0) {
                <button class="btn-tm ctrl-btn" (click)="clearAllHighlights()">Surb. X</button>
              }
            }
            <button class="btn-tm ctrl-btn reset" (click)="resetDungeon()">Reset</button>
            <button class="btn-tm ctrl-btn back-btn" (click)="close.emit()">Retour</button>
          </div>
        </div>

        <div class="tm200-body">

          <div class="tm200-map-wrapper">
            <div class="tm200-map"
                 (dragover)="onDragOver($event)"
                 (drop)="onDrop($event)">
              @for (cell of cells(); track cell.x + '_' + cell.y) {
                <div
                  class="tm200-cell"
                  [ngClass]="getCellClasses(cell)"
                  [style.grid-column]="cell.x + 1"
                  [style.grid-row]="cell.y + 1"
                  [attr.data-x]="cell.x"
                  [attr.data-y]="cell.y"
                  (click)="onCellClick(cell)"
                  (dragover)="onDragOver($event)"
                  (drop)="onDrop($event)"
                >
                  @if (cell.crystal && cell.crystal.x === cell.x && cell.crystal.y === cell.y) {
                    <div class="crystal-pin"
                         [class]="'cpin-' + cell.crystal.color"
                         [class.cpin-inactive]="cell.crystal.level === 0"
                         [class.cpin-max]="cell.crystal.level === 5"
                         [title]="cell.crystal.label + ' - ' + crystalLevelLabel(cell.crystal.level)"
                         (click)="onCrystalClick(cell.crystal, $event)">
                      <span class="cpin-icon">{{ crystalLevelIcon(cell.crystal.level) }}</span>
                      @if (cell.crystal.level > 0) {
                        <span class="cpin-level">{{ cell.crystal.level }}</span>
                      }
                    </div>
                  }

                  @for (entity of cell.entities; track entity.id) {
                    @if (!entity.dead) {
                      <div
                        class="tm200-entity"
                        [ngClass]="[entity.colorClass, entity.isBeingDragged ? 'dragging' : '', (entity.id === currentEntityId() && entity.type === 'ally') ? 'active-turn' : '']"
                        [title]="entity.name"
                        draggable="true"
                        (dragstart)="onDragStart(entity, $event)"
                        (dragend)="onDragEnd(entity)"
                        (click)="onEntityClick(entity, $event)"
                      >
                        <span class="entity-icon">{{ entity.icon }}</span>
                        <span class="entity-name-tag">{{ entity.name }}</span>
                      </div>
                    }
                  }

                  @if (showCoords()) {
                    <span class="coord-hint">{{cell.x}},{{cell.y}}</span>
                  }
                </div>
              }
            </div>

            <div class="map-footer">
              <div class="map-legend">
                <span class="leg"><span class="ld ally-dot"></span>Allie</span>
                <span class="leg"><span class="ld enemy-dot"></span>Ennemi</span>
                <span class="leg"><span class="ld crystal-dot"></span>Cristal</span>
                <span class="leg"><span class="ld border-dot"></span>Bordure</span>
              </div>
              <button class="btn-coords" (click)="showCoords.set(!showCoords())">
                {{ showCoords() ? 'Masquer coords' : 'Coords' }}
              </button>
            </div>
          </div>

          <div class="tm200-sidebar">

            @if (isPlacementPhase()) {
              <div class="side-panel placement-panel">
                <div class="side-title">Placement des allies</div>
                @for (e of allies(); track e.id) {
                  <div class="placement-row" [class.placed]="e.currentX !== -1">
                    <span class="ent-icon">{{ e.icon }}</span>
                    <span class="ent-name">{{ e.name }}</span>
                    @if (e.currentX !== -1) {
                      <span class="ent-pos placed-pos">({{e.currentX}},{{e.currentY}})</span>
                      <button class="btn-unplace" (click)="unplaceAlly(e)">Retirer</button>
                    } @else {
                      <span class="ent-pos">non placé</span>
                    }
                  </div>
                }
                <div class="spawn-list">
                  <div class="spawn-list-title">Spawns disponibles :</div>
                  @for (sp of allySpawnSlots(); track sp.x + '_' + sp.y) {
                    <div class="spawn-slot" [class.taken]="sp.taken">
                      <span class="spawn-coord">({{sp.x}}, {{sp.y}})</span>
                      @if (sp.taken) {
                        <span class="spawn-who">{{ sp.entityName }}</span>
                      } @else {
                        <span class="spawn-free">libre</span>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            <div class="side-panel allies-panel">
              <div class="side-title">Allies ({{ aliveAllies() }}/{{ allies().length }})</div>
              @for (e of allies(); track e.id) {
                <div class="ent-row" [class.dead-row]="e.dead" [class.active-row]="e.id === currentEntityId()">
                  <span class="ent-icon">{{ e.icon }}</span>
                  <span class="ent-name">{{ e.name }}</span>
                  <span class="ent-pos" *ngIf="!e.dead">{{e.currentX}},{{e.currentY}}</span>
                  <span class="ent-dead" *ngIf="e.dead">mort</span>
                  <button class="btn-toggle-dead" [class.revive]="e.dead" (click)="toggleDead(e)">
                    {{ e.dead ? 'Revive' : 'Tuer' }}
                  </button>
                </div>
              }
            </div>

            <div class="side-panel enemies-panel">
              <div class="side-title">Ennemis ({{ aliveEnemies() }}/{{ enemies().length }})</div>
              @for (e of enemies(); track e.id) {
                <div class="ent-row" [class.dead-row]="e.dead" [class.active-row]="e.id === currentEntityId()">
                  <span class="ent-icon">{{ e.icon }}</span>
                  <span class="ent-name">{{ e.name }}</span>
                  <span class="ent-pos" *ngIf="!e.dead">{{e.currentX}},{{e.currentY}}</span>
                  <span class="ent-dead" *ngIf="e.dead">mort</span>
                  <button class="btn-toggle-dead" [class.revive]="e.dead" (click)="toggleDead(e)">
                    {{ e.dead ? 'Revive' : 'Tuer' }}
                  </button>
                </div>
              }
            </div>

            <div class="side-panel crystals-panel">
              <div class="side-title">Cristaux - Irradiation</div>
              @for (c of crystals(); track c.id) {
                <div class="cry-row" [class.cry-inactive]="c.level === 0" [class.cry-max]="c.level === 5">
                  <span class="cry-state-icon">{{ crystalLevelIcon(c.level) }}</span>
                  <div class="cry-info">
                    <span class="cry-name">{{ c.label }}</span>
                    <span class="cry-state-label" [class]="'cry-lv-' + c.level">{{ crystalLevelLabel(c.level) }}</span>
                  </div>
                  <div class="cry-bar">
                    @for (step of [0,1,2,3,4,5]; track step) {
                      <div class="cry-bar-step" [class.filled]="step <= c.level" [class]="step <= c.level ? 'cry-bar-step filled cpin-' + c.color : 'cry-bar-step'"></div>
                    }
                  </div>
                  <div class="cry-ctrl">
                    <button class="btn-level" (click)="decLevel(c)" [disabled]="c.level <= 0">-</button>
                    <button class="btn-level up" (click)="incLevel(c)" [disabled]="c.level >= 5">+</button>
                  </div>
                </div>
              }
              <div class="irrad-info">
                <div class="irrad-states">
                  <span><b>0</b> Inactif | <b>1</b> Croix r1 | <b>2</b> Carre r1</span>
                  <span><b>3</b> Croix r2 | <b>4</b> Carre r2 | <b>5</b> Croix r3</span>
                </div>
              </div>
            </div>

            <div class="side-panel log-panel">
              <div class="side-title">Journal <button class="btn-clear-log" (click)="turnLog.set([])">Vider</button></div>
              <div class="turn-log">
                @for (log of turnLog(); track $index) {
                  <div class="log-entry" [class.log-ally]="log.startsWith('Tour') && isAllyTurn(log)"
                                         [class.log-enemy]="log.startsWith('Tour') && !isAllyTurn(log)">
                    {{ log }}
                  </div>
                }
                @if (turnLog().length === 0) {
                  <div class="log-empty">Aucune action.</div>
                }
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tm200-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.82);
      z-index: 3000;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(3px);
    }

    .tm200-panel {
      background: #0c0f14;
      border: 1px solid #2a2f3a;
      border-radius: 14px;
      width: min(1180px, 98vw);
      max-height: 97vh;
      overflow: hidden;
      display: flex; flex-direction: column;
      box-shadow: 0 28px 90px rgba(0,0,0,0.8), 0 0 40px rgba(100,200,100,0.08);
    }

    .tm200-header {
      display: flex; align-items: center; gap: 14px;
      padding: 10px 16px;
      background: #12161e;
      border-bottom: 1px solid #2a2f3a;
      flex-wrap: wrap;
    }
    .tm200-title { display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; }
    .tm200-badge { font-size: 15px; font-weight: 800; color: #ffd166; letter-spacing: 1px; }
    .tm200-subtitle { font-size: 10px; color: #6b7a94; }

    .tm200-turn-info { display: flex; align-items: center; gap: 10px; flex: 1; justify-content: center; }
    .turn-label { font-size: 12px; color: #8c9bb3; font-weight: 600; }
    .current-turn-badge {
      font-size: 12px; font-weight: 800;
      padding: 3px 14px; border-radius: 20px; color: #0b1220;
      min-width: 120px; text-align: center;
    }

    .tm200-controls { display: flex; gap: 6px; }
    .btn-tm {
      border: none; border-radius: 6px; padding: 6px 12px;
      cursor: pointer; font-size: 11px; font-weight: 700; transition: all 0.15s;
    }
    .ctrl-btn { background: #1e2840; color: #c8d4e8; border: 1px solid #2a3850; }
    .ctrl-btn:hover:not(:disabled) { background: #28375a; }
    .ctrl-btn.primary { background: #3a5acc; color: #fff; }
    .ctrl-btn.primary:hover { background: #4a6adc; }
    .ctrl-btn.reset { background: #1e3020; color: #7bd88f; border-color: #2a4828; }
    .ctrl-btn.reset:hover { background: #2a4828; }
    .back-btn { background: #1a1a2e; color: #a0aec0; border: 1px solid #2d3748; }
    .back-btn:hover { background: #252540; color: #e2e8f0; }
    .close-btn { background: #2a1818; color: #ef476f; border: 1px solid #4a2020; font-size: 14px; padding: 4px 10px; }
    .close-btn:hover { background: #4a2020; }
    .btn-tm:disabled { opacity: 0.35; cursor: not-allowed; }

    .tm200-body {
      display: flex; overflow: hidden; flex: 1; min-height: 0;
    }

    .tm200-map-wrapper {
      display: flex; flex-direction: column; align-items: center;
      gap: 6px; padding: 10px 6px 6px 10px; flex-shrink: 0;
      overflow: auto;
    }

    .tm200-map {
      display: grid;
      grid-template-columns: repeat(15, 44px);
      grid-template-rows:    repeat(16, 44px);
      gap: 2px;
    }

    .tm200-cell {
      width: 44px; height: 44px;
      border-radius: 5px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      position: relative; overflow: visible;
      cursor: pointer;
      transition: filter 0.12s, transform 0.1s;
      font-size: 8px;
      box-sizing: border-box;
    }

    .c-void    { background: transparent; border: none; cursor: default; pointer-events: none; }
    .c-floor   { background: #16202e; border: 1px solid #1e2c40; }
    .c-floor:hover { background: #1c2a3e; filter: brightness(1.15); }
    .c-border  { background: #0e1824; border: 1px solid #3a5a7a; box-shadow: inset 0 0 0 1px rgba(80,160,220,0.15); }
    .c-border:hover { background: #162030; filter: brightness(1.1); }
    .c-wall    { background: #0a0d10; border: 1px solid #111518; cursor: default; }
    .c-spawn-ally   { background: rgba(76,201,240,0.1); border: 1px solid rgba(76,201,240,0.4); }
    .c-spawn-ally:hover { background: rgba(76,201,240,0.18); }
    .c-spawn-enemy  { background: rgba(239,71,111,0.1); border: 1px solid rgba(239,71,111,0.4); }
    .c-spawn-enemy:hover { background: rgba(239,71,111,0.18); }
    .c-crystal-zone { background: rgba(100,220,120,0.07); border: 1px solid rgba(100,220,120,0.25); }
    .c-crystal-zone:hover { background: rgba(100,220,120,0.14); }
    .c-boss-zone { background: rgba(255,200,60,0.07); border: 1px dashed rgba(255,200,60,0.3); }
    .c-boss-zone:hover { background: rgba(255,200,60,0.13); }

    .c-active-turn {
      box-shadow: inset 0 0 0 2px #ffd166;
      animation: activePulse 1s ease-in-out infinite alternate;
    }
    @keyframes activePulse {
      from { box-shadow: inset 0 0 0 2px rgba(255,209,102,0.5); }
      to   { box-shadow: inset 0 0 0 2px rgba(255,209,102,1); }
    }

    .crystal-pin {
      display: flex; flex-direction: column; align-items: center;
      position: relative; z-index: 2; cursor: pointer;
      transition: transform 0.15s;
    }
    .crystal-pin:hover { transform: scale(1.3); }
    .cpin-inactive { opacity: 0.45; filter: grayscale(0.8); }
    .cpin-max { filter: drop-shadow(0 0 5px #ef476f); }
    .cpin-icon { font-size: 18px; line-height: 1; }
    .cpin-level {
      position: absolute; top: -5px; right: -7px;
      background: #0b1220; border: 1px solid currentColor;
      border-radius: 50%; width: 13px; height: 13px;
      font-size: 8px; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
    }
    .cpin-green  { color: #5dde7a; }
    .cpin-yellow { color: #ffd166; }
    .cpin-blue   { color: #4cc9f0; }
    .cpin-purple { color: #c4a0f7; }
    .cpin-red    { color: #ef476f; }

    .cry-row {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 7px; background: #181d28; border-radius: 6px;
      border: 1px solid #1e2838; transition: border-color 0.2s;
    }
    .cry-inactive { opacity: 0.5; }
    .cry-max { border-color: rgba(239,71,111,0.5) !important; background: rgba(239,71,111,0.06) !important; }
    .cry-state-icon { font-size: 16px; flex-shrink: 0; min-width: 20px; text-align: center; }
    .cry-info { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
    .cry-name { font-size: 10px; font-weight: 700; color: #d8e4f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cry-state-label { font-size: 9px; font-weight: 600; }
    .cry-lv-0 { color: #3a4558; }
    .cry-lv-1 { color: #7bd88f; }
    .cry-lv-2 { color: #ffd166; }
    .cry-lv-3 { color: #4cc9f0; }
    .cry-lv-4 { color: #ff8250; }
    .cry-lv-5 { color: #ef476f; font-weight: 800; }

    .cry-bar { display: flex; gap: 2px; flex-shrink: 0; }
    .cry-bar-step { width: 7px; height: 12px; border-radius: 2px; background: #1e2838; border: 1px solid #2a3040; transition: background 0.15s; }
    .cry-bar-step.filled { border-color: currentColor; }
    .cry-bar-step.filled.cpin-green  { background: rgba(93,222,122,0.6); }
    .cry-bar-step.filled.cpin-yellow { background: rgba(255,209,102,0.6); }
    .cry-bar-step.filled.cpin-blue   { background: rgba(76,201,240,0.6); }
    .cry-bar-step.filled.cpin-purple { background: rgba(196,160,247,0.6); }
    .cry-bar-step.filled.cpin-red    { background: rgba(239,71,111,0.6); }

    .cry-ctrl { display: flex; gap: 3px; flex-shrink: 0; }
    .btn-level {
      background: #1e2840; border: 1px solid #2a3850; color: #aac;
      border-radius: 3px; width: 18px; height: 18px; font-size: 12px;
      cursor: pointer; padding: 0; display: flex; align-items: center;
      justify-content: center; font-weight: 700; line-height: 1;
    }
    .btn-level:hover:not(:disabled) { background: #253060; }
    .btn-level.up:hover:not(:disabled) { background: #1a3520; border-color: #2a5030; color: #7bd88f; }
    .btn-level:disabled { opacity: 0.3; cursor: default; }

    .irrad-info {
      display: flex; gap: 5px; align-items: flex-start; margin-top: 4px;
      font-size: 9px; color: #5a6a80; padding: 5px 7px;
      background: rgba(76,201,240,0.04); border-radius: 4px;
      border: 1px solid rgba(76,201,240,0.1);
    }
    .irrad-states { display: flex; flex-direction: column; gap: 2px; }
    .irrad-states b { color: #8c9bb3; }

    .tm200-entity {
      display: flex; flex-direction: column; align-items: center; gap: 0;
      cursor: grab; z-index: 4; border-radius: 4px;
      padding: 1px 3px; max-width: 50px;
      transition: transform 0.12s;
    }
    .tm200-entity:hover { transform: scale(1.18); z-index: 10; }
    .tm200-entity.dragging { opacity: 0.35; }
    .tm200-entity.active-turn {
      outline: 2px solid #ffd166;
      animation: entityGlow 0.8s ease-in-out infinite alternate;
    }
    @keyframes entityGlow {
      from { outline-color: rgba(255,209,102,0.4); }
      to   { outline-color: #ffd166; }
    }
    .entity-icon     { font-size: 20px; line-height: 1; }
    .entity-name-tag {
      font-size: 7px; font-weight: 700;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 48px;
      text-align: center; line-height: 1.1;
    }

    .ally-1    { background: rgba(76,201,240,0.22);  border: 1px solid #4cc9f0; color: #4cc9f0; }
    .ally-2    { background: rgba(90,215,240,0.18);  border: 1px solid #5ad7f0; color: #90e8ff; }
    .ally-3    { background: rgba(123,216,143,0.18); border: 1px solid #7bd88f; color: #9ff0b0; }
    .enemy-1   { background: rgba(239,71,111,0.22);  border: 1px solid #ef476f; color: #ff7090; }
    .enemy-2   { background: rgba(255,130,80,0.18);  border: 1px solid #ff8250; color: #ffaa80; }
    .enemy-3   { background: rgba(180,100,240,0.18); border: 1px solid #b464f0; color: #d090ff; }
    .enemy-boss{ background: rgba(255,200,50,0.22);  border: 2px solid #ffd166; color: #ffd166; }

    .coord-hint {
      position: absolute; bottom: 1px; right: 2px;
      font-size: 7px; color: rgba(200,200,200,0.35);
      pointer-events: none;
    }

    .map-footer { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0 4px; }
    .map-legend { display: flex; gap: 12px; font-size: 10px; color: #6b7a94; }
    .leg { display: flex; align-items: center; gap: 4px; }
    .ld { width: 10px; height: 10px; border-radius: 2px; display: inline-block; flex-shrink: 0; }
    .ally-dot    { background: rgba(76,201,240,0.5);  border: 1px solid #4cc9f0; }
    .enemy-dot   { background: rgba(239,71,111,0.5);  border: 1px solid #ef476f; }
    .crystal-dot { background: rgba(100,220,120,0.5); border: 1px solid #5dde7a; }
    .border-dot  { background: rgba(80,160,220,0.3);  border: 1px solid #3a5a7a; }

    .btn-coords {
      font-size: 10px; background: #1e2840; color: #8c9bb3;
      border: 1px solid #2a3850; border-radius: 5px; padding: 3px 8px; cursor: pointer;
    }
    .btn-coords:hover { background: #253050; color: #aabbcc; }

    .tm200-sidebar {
      flex: 1; display: flex; flex-direction: column; gap: 6px;
      padding: 10px 10px 10px 6px; overflow-y: auto;
      min-width: 230px; max-width: 270px;
      border-left: 1px solid #2a2f3a;
    }

    .side-panel {
      background: #12161e; border: 1px solid #242a38;
      border-radius: 8px; padding: 8px;
      display: flex; flex-direction: column; gap: 4px;
    }

    .side-title {
      font-size: 10px; font-weight: 800; letter-spacing: 0.5px;
      text-transform: uppercase; color: #6b7a94; margin-bottom: 3px;
      display: flex; align-items: center; gap: 6px;
    }
    .allies-panel .side-title   { color: #4cc9f0; }
    .enemies-panel .side-title  { color: #ef476f; }
    .crystals-panel .side-title { color: #5dde7a; }

    .ent-row {
      display: flex; align-items: center; gap: 5px;
      padding: 3px 6px; background: #181d28; border-radius: 5px;
      font-size: 11px; transition: background 0.12s;
    }
    .ent-row:hover { background: #1e2838; }
    .active-row { background: rgba(255,209,102,0.08) !important; border: 1px solid rgba(255,209,102,0.3); }
    .dead-row { opacity: 0.45; }
    .ent-icon { font-size: 14px; flex-shrink: 0; }
    .ent-name { font-weight: 700; color: #d8e4f0; flex: 1; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ent-pos  { font-size: 9px; color: #5a6a80; flex-shrink: 0; }
    .ent-dead { font-size: 10px; color: #ef476f; flex-shrink: 0; }

    .btn-toggle-dead {
      background: rgba(239,71,111,0.1); border: 1px solid rgba(239,71,111,0.3);
      color: #ef476f; border-radius: 4px; padding: 1px 6px;
      cursor: pointer; font-size: 11px; flex-shrink: 0; transition: all 0.12s;
    }
    .btn-toggle-dead:hover { background: rgba(239,71,111,0.3); }
    .btn-toggle-dead.revive { background: rgba(123,216,143,0.1); border-color: rgba(123,216,143,0.3); color: #7bd88f; }
    .btn-toggle-dead.revive:hover { background: rgba(123,216,143,0.3); }

    .log-panel { flex: 1; min-height: 80px; }
    .turn-log { max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
    .log-entry { font-size: 9px; color: #6b7a94; padding: 2px 5px; background: #181d28; border-radius: 3px; }
    .log-ally  { border-left: 2px solid #4cc9f0; }
    .log-enemy { border-left: 2px solid #ef476f; }
    .log-empty { font-size: 10px; color: #3a4558; font-style: italic; padding: 4px; }

    .btn-clear-log {
      margin-left: auto; font-size: 9px; background: transparent;
      border: 1px solid #2a3040; color: #4a5568; border-radius: 3px;
      padding: 1px 6px; cursor: pointer;
    }
    .btn-clear-log:hover { background: #1e2838; color: #8c9bb3; }

    .c-highlight {
      background: rgba(255,255,255,0.18) !important;
      border: 2px solid rgba(255,255,255,0.85) !important;
      box-shadow: inset 0 0 8px rgba(255,255,255,0.25), 0 0 6px rgba(255,255,255,0.3);
    }
    .c-hl-mode { cursor: crosshair !important; }
    .c-hl-mode:hover { background: rgba(255,255,255,0.10) !important; border-color: rgba(255,255,255,0.4) !important; }
    .c-highlight.c-hl-mode:hover { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.5) !important; }
    .btn-tm.active-mode { background: rgba(255,255,255,0.12) !important; border-color: rgba(255,255,255,0.6) !important; color: #ffffff !important; }

    .placement-badge {
      font-size: 13px; font-weight: 800; color: #4cc9f0;
      padding: 3px 12px; border-radius: 20px;
      background: rgba(76,201,240,0.12); border: 1px solid rgba(76,201,240,0.35);
    }
    .placement-hint { font-size: 10px; color: #6b7a94; font-style: italic; }

    .c-spawn-free {
      background: rgba(76,201,240,0.18) !important;
      border: 2px dashed rgba(76,201,240,0.7) !important;
      cursor: pointer !important;
      animation: spawnPulse 1.2s ease-in-out infinite alternate;
    }
    @keyframes spawnPulse {
      from { border-color: rgba(76,201,240,0.3); background: rgba(76,201,240,0.08); }
      to   { border-color: rgba(76,201,240,0.9); background: rgba(76,201,240,0.25); }
    }
    .c-spawn-taken { border: 2px solid rgba(76,201,240,0.4) !important; }

    .placement-panel { border-color: rgba(76,201,240,0.3); }
    .placement-panel .side-title { color: #4cc9f0; }
    .placement-row {
      display: flex; align-items: center; gap: 5px;
      padding: 3px 6px; background: #181d28; border-radius: 5px; font-size: 11px;
    }
    .placement-row.placed { background: rgba(76,201,240,0.08); border: 1px solid rgba(76,201,240,0.2); }
    .placed-pos { color: #4cc9f0 !important; font-weight: 700; }

    .btn-unplace {
      background: rgba(76,201,240,0.1); border: 1px solid rgba(76,201,240,0.3);
      color: #4cc9f0; border-radius: 4px; padding: 1px 6px;
      cursor: pointer; font-size: 11px; flex-shrink: 0;
    }
    .btn-unplace:hover { background: rgba(76,201,240,0.25); }

    .spawn-list { margin-top: 5px; display: flex; flex-direction: column; gap: 2px; }
    .spawn-list-title { font-size: 9px; color: #4a5568; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .spawn-slot { display: flex; align-items: center; gap: 6px; padding: 2px 6px; background: #181d28; border-radius: 4px; font-size: 10px; border: 1px solid #1e2838; }
    .spawn-slot.taken { border-color: rgba(76,201,240,0.25); }
    .spawn-coord { color: #8c9bb3; font-weight: 700; min-width: 48px; }
    .spawn-free  { color: #3a6a3a; font-style: italic; }
    .spawn-who   { color: #4cc9f0; font-weight: 700; }
  `]
})
export class TM200ModeComponent implements OnInit, OnDestroy {

  readonly close = output<void>();

  showCoords        = signal(false);
  turnNumber        = signal(1);
  isPlacementPhase  = signal(true);
  isHighlightMode   = signal(false);
  private _highlighted    = signal<Set<string>>(new Set());
  private _entities       = signal<TM200Entity[]>([]);
  private _crystals       = signal<TM200Crystal[]>([]);
  private _turnIdx        = signal(0);
  private _crystalTurnIdx = signal(0);
  private _crystalHistory: { levels: number[]; crystalIdx: number }[] = [];
  turnLog = signal<string[]>([]);

  allies      = computed(() => this._entities().filter(e => e.type === 'ally'));
  enemies     = computed(() => this._entities().filter(e => e.type === 'enemy'));
  crystals    = computed(() => this._crystals());
  highlighted = computed(() => this._highlighted());
  aliveAllies  = computed(() => this.allies().filter(e => !e.dead).length);
  aliveEnemies = computed(() => this.enemies().filter(e => !e.dead).length);

  allAlliesPlaced = computed(() => this.allies().every(e => e.currentX !== -1));

  /** Slots de spawn alliés avec leur état (libre / occupé) */
  allySpawnSlots = computed(() => {
    const allies = this.allies();
    return ALLY_SPAWN_CELLS.map(([x, y]) => {
      const occupant = allies.find(e => e.currentX === x && e.currentY === y);
      return { x, y, taken: !!occupant, entityName: occupant?.name ?? '' };
    });
  });

  activeTurnOrder = computed(() =>
    TURN_ORDER.filter(id => {
      const e = this._entities().find(x => x.id === id);
      return e && !e.dead;
    })
  );

  currentEntityId = computed(() => {
    const order = this.activeTurnOrder();
    if (!order.length) return null;
    return order[this._turnIdx() % order.length];
  });

  currentEntityName  = computed(() => this._entities().find(x => x.id === this.currentEntityId())?.name ?? '-');
  currentEntityIcon  = computed(() => this._entities().find(x => x.id === this.currentEntityId())?.icon ?? '');
  currentEntityColor = computed(() => {
    const e = this._entities().find(x => x.id === this.currentEntityId());
    if (!e) return '#333';
    if (e.id === 'enemy_1') return '#ffd166';
    return e.type === 'ally' ? '#4cc9f0' : '#ef476f';
  });

  cells = computed<TM200Cell[]>(() => {
    const entities = this._entities();
    const crystals = this._crystals();
    const result: TM200Cell[] = [];

    // Construire la map de toutes les cases en zone de cristal (dynamique selon niveau)
    const crystalZoneMap = new Map<string, TM200Crystal>(); // clé "x,y" → cristal responsable
    for (const c of crystals) {
      if (c.level > 0) {
        const zone = getCrystalZone(c.x, c.y, c.level);
        for (const key of zone) crystalZoneMap.set(key, c);
      }
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = maskChar(x, y);
        if (ch === '.') {
          result.push({ x, y, type: 'void', entities: [], crystal: null });
          continue;
        }
        const isBorder    = ch === 'S';
        const isWall      = WALL_CELLS.some(([wx, wy]) => wx === x && wy === y);
        const isAllySpawn = ALLY_SPAWN_CELLS.some(([ax, ay]) => ax === x && ay === y);
        const crystal     = crystals.find(c => c.x === x && c.y === y) ?? null;
        const inCrysZone  = crystal !== null || crystalZoneMap.has(`${x},${y}`);

        let type: TM200CellType = 'floor';
        if (isWall)           type = 'wall';
        else if (isBorder)    type = 'border';
        else if (inCrysZone)  type = 'crystal-zone';
        else if (isAllySpawn) type = 'spawn-ally';

        const cellEntities = entities.filter(e => e.currentX === x && e.currentY === y);
        result.push({ x, y, type, entities: cellEntities, crystal });
      }
    }
    return result;
  });

  ngOnInit()    { this.initDungeon(); }
  ngOnDestroy() {}

  initDungeon(): void {
    // Les alliés démarrent à (-1,-1) : non placés
    // Les ennemis sont placés directement à leur spawn
    this._entities.set(INITIAL_ENTITIES.map(e => ({
      ...e,
      currentX: e.type === 'ally' ? -1 : e.spawnX,
      currentY: e.type === 'ally' ? -1 : e.spawnY,
      dead: false,
      isBeingDragged: false,
    })));
    this._crystals.set(CRYSTAL_DEFS.map(c => ({ ...c, active: true, highlighted: false, level: 1 })));
    this._highlighted.set(new Set());
    this._crystalHistory = [];
    this._turnIdx.set(0);
    this._crystalTurnIdx.set(0);
    this.turnNumber.set(1);
    this.isPlacementPhase.set(true);
    this.turnLog.set(['Phase de placement - choisissez vos positions de depart.']);
  }

  resetDungeon(): void {
    if (!confirm('Reinitialiser toute la salle ?')) return;
    this.initDungeon();
  }

  startCombat(): void {
    if (!this.allAlliesPlaced()) return;
    this.isPlacementPhase.set(false);
    const first = this._entities().find(x => x.id === TURN_ORDER[0]);
    this.turnLog.update(l => [`Combat lance ! Tour 1 - ${first?.name ?? ''} joue.`, ...l]);
  }

  nextTurn(): void {
    const order = this.activeTurnOrder();
    if (!order.length) return;

    // Sauvegarde un snapshot des niveaux avant de les modifier
    this._crystalHistory.push({
      levels:     this._crystals().map(c => c.level),
      crystalIdx: this._crystalTurnIdx(),
    });

    // Progression du cristal courant
    this.advanceCrystal();

    const next = (this._turnIdx() + 1) % order.length;
    this._turnIdx.set(next);
    const tn = this.turnNumber() + 1;
    this.turnNumber.set(tn);
    const e = this._entities().find(x => x.id === order[next]);
    if (e) this.addLog(`Tour ${tn} - ${e.name} joue.`);
  }

  /** +1 sur le cristal courant (si < max), puis passe au cristal suivant. */
  private advanceCrystal(): void {
    const crystals = this._crystals();
    const idx = this._crystalTurnIdx();
    const c = crystals[idx];
    if (!c) return;

    if (c.level < MAX_CRYSTAL_LEVEL) {
      const newLevel = c.level + 1;
      this._crystals.update(l => l.map(x =>
        x.id === c.id ? { ...x, level: newLevel, active: true } : x
      ));
      this.addLog(`${c.label} -> ${CRYSTAL_LEVEL_LABELS[newLevel]}`);
    }

    // Toujours passer au cristal suivant
    this._crystalTurnIdx.set((idx + 1) % crystals.length);
  }

  prevTurn(): void {
    const order = this.activeTurnOrder();
    if (!order.length || this.turnNumber() <= 1) return;

    // Restaure le snapshot de radiation précédent
    const snapshot = this._crystalHistory.pop();
    if (snapshot) {
      this._crystals.update(l => l.map((c, i) => ({
        ...c,
        level:  snapshot.levels[i],
        active: snapshot.levels[i] > 0,
      })));
      this._crystalTurnIdx.set(snapshot.crystalIdx);
    }

    const prev = (this._turnIdx() - 1 + order.length) % order.length;
    this._turnIdx.set(prev);
    const tn = Math.max(1, this.turnNumber() - 1);
    this.turnNumber.set(tn);
    const e = this._entities().find(x => x.id === order[prev]);
    if (e) this.addLog(`Retour tour ${tn} - ${e.name}.`);
  }

  toggleDead(entity: TM200Entity): void {
    const wasDead = entity.dead;
    this._entities.update(l => l.map(e => e.id === entity.id ? { ...e, dead: !e.dead } : e));
    this.addLog(wasDead ? `${entity.name} revenu.` : `${entity.name} mort.`);
  }

  onEntityClick(entity: TM200Entity, event: MouseEvent): void {
    event.stopPropagation();
  }

  toggleCrystal(c: TM200Crystal): void {
    const newLevel = c.level === 0 ? 1 : 0;
    this._crystals.update(l => l.map(x =>
      x.id === c.id ? { ...x, level: newLevel, active: newLevel > 0 } : x
    ));
    this.addLog(newLevel === 0 ? `${c.label} -> Inactif` : `${c.label} -> ${CRYSTAL_LEVEL_LABELS[newLevel]}`);
  }

  incLevel(c: TM200Crystal): void {
    if (c.level >= MAX_CRYSTAL_LEVEL) return;
    const newLevel = c.level + 1;
    this._crystals.update(l => l.map(x =>
      x.id === c.id ? { ...x, level: newLevel, active: newLevel > 0 } : x
    ));
    this.addLog(`${c.label} -> ${CRYSTAL_LEVEL_LABELS[newLevel]}`);
  }

  decLevel(c: TM200Crystal): void {
    if (c.level <= 0) return;
    const newLevel = c.level - 1;
    this._crystals.update(l => l.map(x =>
      x.id === c.id ? { ...x, level: newLevel, active: newLevel > 0 } : x
    ));
    this.addLog(`${c.label} -> ${CRYSTAL_LEVEL_LABELS[newLevel]}`);
  }

  onCrystalClick(c: TM200Crystal, event: MouseEvent): void {
    event.stopPropagation();
    this.incLevel(c);
  }

  crystalLevelLabel(level: number): string { return CRYSTAL_LEVEL_LABELS[level] ?? '?'; }
  crystalLevelIcon(level: number):  string { return CRYSTAL_LEVEL_ICONS[level]  ?? '?'; }

  private draggingEntity: TM200Entity | null = null;

  onDragStart(entity: TM200Entity, event: DragEvent): void {
    this.draggingEntity = entity;
    this._entities.update(l => l.map(e => e.id === entity.id ? { ...e, isBeingDragged: true } : e));
    event.dataTransfer?.setData('text/plain', entity.id);
    event.dataTransfer!.effectAllowed = 'move';
  }

  onDragEnd(entity: TM200Entity): void {
    this._entities.update(l => l.map(e => e.id === entity.id ? { ...e, isBeingDragged: false } : e));
    this.draggingEntity = null;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const el = event.target as HTMLElement;
    const cellEl = el.closest('[data-x]') as HTMLElement | null;
    if (!cellEl || !this.draggingEntity) return;

    const x = parseInt(cellEl.getAttribute('data-x') ?? '-1', 10);
    const y = parseInt(cellEl.getAttribute('data-y') ?? '-1', 10);
    if (x < 0 || y < 0) return;
    if (isVoid(x, y)) return;
    if (WALL_CELLS.some(([wx, wy]) => wx === x && wy === y)) return;

    const from = { x: this.draggingEntity.currentX, y: this.draggingEntity.currentY };
    const name = this.draggingEntity.name;
    const id   = this.draggingEntity.id;

    this._entities.update(l => l.map(e => e.id === id
      ? { ...e, currentX: x, currentY: y, isBeingDragged: false }
      : e
    ));
    this.draggingEntity = null;
    this.addLog(`${name} : (${from.x},${from.y}) -> (${x},${y})`);
  }

  onCellClick(cell: TM200Cell): void {
    if (cell.type === 'void' || cell.type === 'wall') return;

    if (this.isHighlightMode()) {
      const key = `${cell.x},${cell.y}`;
      this._highlighted.update(s => {
        const next = new Set(s);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      return;
    }

    if (this.isPlacementPhase()) {
      const isAllySpawn = ALLY_SPAWN_CELLS.some(([ax, ay]) => ax === cell.x && ay === cell.y);
      if (!isAllySpawn) return;
      const alreadyOccupied = this.allies().some(e => e.currentX === cell.x && e.currentY === cell.y);
      if (alreadyOccupied) return;
      const unplaced = this.allies().find(e => e.currentX === -1);
      if (!unplaced) return;
      this._entities.update(l => l.map(e =>
        e.id === unplaced.id ? { ...e, currentX: cell.x, currentY: cell.y } : e
      ));
      this.addLog(`${unplaced.name} place en (${cell.x},${cell.y})`);
    }
  }

  toggleHighlightMode(): void {
    this.isHighlightMode.update(v => !v);
  }

  clearAllHighlights(): void {
    this._highlighted.set(new Set());
  }

  unplaceAlly(entity: TM200Entity): void {
    this._entities.update(l => l.map(e =>
      e.id === entity.id ? { ...e, currentX: -1, currentY: -1 } : e
    ));
    this.addLog(`${entity.name} retire de sa position.`);
  }

  getCellClasses(cell: TM200Cell): Record<string, boolean> {
    const curId = this.currentEntityId();
    const hasActiveTurn = cell.entities.some(e => e.id === curId && !e.dead && e.type === 'ally');
    const isAllySpawn   = ALLY_SPAWN_CELLS.some(([ax, ay]) => ax === cell.x && ay === cell.y);
    const isSpawnFree   = this.isPlacementPhase() && isAllySpawn
                          && !this.allies().some(e => e.currentX === cell.x && e.currentY === cell.y);
    const isSpawnTaken  = this.isPlacementPhase() && isAllySpawn && !isSpawnFree;
    const isHighlighted = this._highlighted().has(`${cell.x},${cell.y}`);
    return {
      [`c-${cell.type}`]: true,
      'c-active-turn': hasActiveTurn,
      'c-spawn-free':  isSpawnFree,
      'c-spawn-taken': isSpawnTaken,
      'c-highlight':   isHighlighted,
      'c-hl-mode':     this.isHighlightMode() && cell.type !== 'void' && cell.type !== 'wall',
    };
  }

  isAllyTurn(log: string): boolean {
    return this.allies().some(a => log.includes(a.name));
  }

  private addLog(msg: string): void {
    this.turnLog.update(l => [msg, ...l].slice(0, 60));
  }
}
