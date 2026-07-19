import { Component, inject, computed, output, effect, input, signal, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineService } from '../services/timeline.service';
import { BuildService } from '../services/build.service';
import { BoardService } from '../services/board.service';
import { SimulationService } from '../services/simulation.service';
import { InteractivePlayService } from '../services/interactive-play.service';
import { ResourceRegenerationService } from '../services/processors/resource-regeneration.service';
import { BoardEntity, Mechanism } from '../models/board.model';
import { Position, TimelineAction } from '../models/timeline.model';
import { Build } from '../models/build.model';
import { Spell } from '../models/spell.model';
import { Passive } from '../models/passive.model';
import { DataCacheService } from '../services/data-cache.service';
import { StatsCalculatorService } from '../services/calculators/stats-calculator.service';
import {getMechanismDisplayName, getMechanismImagePath, isSpellMechanism, getSpellMechanismType} from '../utils/mechanism-utils';
import { getInnateSpellIdsForClass } from '../utils/innate-spells.utils';
import {
  parseSpellShortcut,
  resolveShortcutSpell,
  shortcutRowSize,
  shortcutLabelForIndex,
  innateShortcutLabel,
  deckSlotSpells,
  DECK_ROW_SIZE,
} from '../utils/spell-shortcuts.utils';

interface BoardCell {
  x: number;
  y: number;
  hasEntity: boolean;
  hasMechanism: boolean;
  isAction: boolean;
  actionType?: string;
}

const MIN_CELL = 16;
const MAX_CELL = 44;
const BOARD_PADDING = 10;
const BOARD_GAP = 1;

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="board-container">
      <div class="board-header">
        <div class="header-left">
          <h2>🗺️ Carte de Combat</h2>
          @if (mode() === 'timeline') {
          <div class="timeline-indicator" *ngIf="currentTimeline()">
            <span class="timeline-badge">{{ currentTimeline()!.name }}</span>
          </div>
          }
        </div>
        @if (mode() === 'timeline') {
        <div class="board-controls">
          <!-- Nouveau : Bouton pour lancer toute la simulation -->
          <button
            (click)="onRunFullSimulation()"
            [disabled]="isSimulating() || currentStepIndex() > 0 || !hasMinimumBoardSetup()"
            class="btn-run-full"
            title="Exécuter toute la timeline d'un coup">
            @if (isSimulating()) {
              <span>⏳ Simulation en cours...</span>
            } @else {
              <span>▶ Lancer Toute la Simulation</span>
            }
          </button>

          <div class="divider"></div>

          <!-- Contrôles step-by-step -->
          <button (click)="onPreviousStep()" [disabled]="currentStepIndex() === 0 || isSimulating()" class="btn-nav">
            ◀ Étape Précédente
          </button>
          <span class="step-indicator">
            {{ currentStepIndex() === 0 ? 'État initial' : 'Étape ' + currentStepIndex() }} / {{ totalSteps() - 1 }}
          </span>
          <button (click)="onNextStep()" [disabled]="currentStepIndex() >= totalSteps() - 1 || isSimulating() || !hasMinimumBoardSetup()" class="btn-nav">
            Étape Suivante ▶
          </button>

          <div class="divider"></div>

          <!-- Fin de tour explicite : déclenche Permutation momentanée, explosions Rouage/Sinistro, etc. -->
          <button
            (click)="onEndTurn()"
            [disabled]="currentStepIndex() === 0 || isSimulating()"
            class="btn-end-turn"
            title="Terminer le tour : effets de fin de tour (Permutation momentanée, explosion Rouage…) puis début du tour suivant (Horlogerie, Prémonition)">
            ⏭ Fin de tour
          </button>

          <div class="divider"></div>

          <button (click)="onReset()" class="btn-reset" [disabled]="isSimulating()">Réinitialiser</button>
        </div>
        }
      </div>

      <div class="board-setup-warning" *ngIf="currentTimeline() && !hasMinimumBoardSetup()">
        ⚠️ Placement requis: ajoutez au moins 1 allié et 1 ennemi avant de lancer la timeline.
      </div>

      <div class="placement-help" *ngIf="placementMode() !== 'none'">
        📍 {{ getPlacementHelpText() }}
      </div>

      <!-- ═══ BANDEAU MODE INTERACTIF ═══ -->
      @if (mode() === 'freeplay') {
      <div class="interactive-bar"
           [class.active]="interactivePlay.isActive()"
           [class.freeplay]="interactivePlay.isActive() && interactivePlay.isFreeplay() && !isXelorFreeplayActive()"
           [class.xelor-freeplay]="isXelorFreeplayActive() && interactivePlay.isActive()">
        <div class="interactive-bar-left">
          <!-- Bouton Freeplay classique -->
          <button
            class="btn-interactive"
            [class.on]="interactivePlay.isActive() && !isXelorFreeplayActive()"
            [class.freeplay]="interactivePlay.isActive() && interactivePlay.isFreeplay() && !isXelorFreeplayActive()"
            (click)="toggleInteractiveMode()"
            title="{{ interactivePlay.isActive() && !isXelorFreeplayActive() ? 'Désactiver le mode interactif' : 'Activer le mode interactif' }}"
          >
            @if (interactivePlay.isActive() && interactivePlay.isFreeplay() && !isXelorFreeplayActive()) {
              <span>Freeplay ON</span>
            } @else if (interactivePlay.isActive() && !isXelorFreeplayActive()) {
              <span>Mode Interactif ON</span>
            } @else if (hasBuild()) {
              <span>Mode Interactif</span>
            } @else {
              <span>Freeplay (sans build)</span>
            }
          </button>

          <!-- Bouton Freeplay Xel Rouage -->
          <button
            class="btn-interactive btn-xelor-freeplay"
            [class.on]="isXelorFreeplayActive() && interactivePlay.isActive()"
            (click)="toggleXelorFreeplay()"
            title="{{ isXelorFreeplayActive() && interactivePlay.isActive() ? 'Désactiver le mode Freeplay Xel Rouage' : 'Activer le mode Freeplay Xel Rouage (passifs Xelor actifs)' }}"
          >
            @if (isXelorFreeplayActive() && interactivePlay.isActive()) {
              <span>Freeplay Xel ON</span>
            } @else {
              <span>Freeplay Xel Rouage</span>
            }
          </button>

          <!-- Menu Passifs (visible uniquement quand le mode Xel Freeplay est actif) -->
          <div class="passives-menu-wrapper" *ngIf="isXelorFreeplayActive() && interactivePlay.isActive()">
            <button
              class="btn-passives-menu"
              [class.open]="xelorPassivesMenuOpen()"
              (click)="toggleXelorPassivesMenu()"
              title="Configurer les passifs actifs du Freeplay Xel Rouage"
            >⚙ Passifs ({{ activeXelorOptionalCount() }})</button>

            @if (xelorPassivesMenuOpen()) {
              <div class="passives-menu-backdrop" (click)="xelorPassivesMenuOpen.set(false)"></div>
              <div class="passives-menu-panel">
                <div class="passives-menu-title">Passifs Xel Rouage</div>

                <div class="passives-menu-section">Obligatoires</div>
                @for (p of mandatoryXelorPassives(); track p.id) {
                  <div class="passive-row mandatory" [title]="getXelorPassiveDescription(p.id)">
                    <span class="passive-lock">🔒</span>
                    <img *ngIf="getXelorPassiveIconId(p.id)" class="passive-row-icon"
                         [src]="'assets/images/spells/' + getXelorPassiveIconId(p.id) + '.png'"
                         [alt]="getXelorPassiveName(p.id)" (error)="onSpellImgError($event)" />
                    <span class="passive-row-name">{{ getXelorPassiveName(p.id) }}</span>
                  </div>
                }

                <div class="passives-menu-separator"></div>
                <div class="passives-menu-section">Optionnels</div>
                @for (p of optionalXelorPassives(); track p.id) {
                  <button
                    class="passive-row optional"
                    [class.enabled]="isXelorOptionalEnabled(p.id)"
                    [title]="getXelorPassiveDescription(p.id)"
                    (click)="toggleXelorOptionalPassive(p.id)"
                  >
                    <img *ngIf="getXelorPassiveIconId(p.id)" class="passive-row-icon"
                         [src]="'assets/images/spells/' + getXelorPassiveIconId(p.id) + '.png'"
                         [alt]="getXelorPassiveName(p.id)" (error)="onSpellImgError($event)" />
                    <span class="passive-row-name">{{ getXelorPassiveName(p.id) }}</span>
                    <span class="passive-switch" [class.on]="isXelorOptionalEnabled(p.id)">
                      <span class="passive-switch-knob"></span>
                    </span>
                  </button>
                }
              </div>
            }
          </div>

          <button
            *ngIf="interactivePlay.isActive()"
            class="btn-interactive-end-turn"
            (click)="endInteractiveTurn()"
            title="Terminer le tour : Permutation momentanée + effets de fin de tour, puis début du tour suivant (Horlogerie, TP différé Prémonition)"
          >Fin de tour</button>

          <button
            *ngIf="interactivePlay.isActive()"
            class="btn-interactive-reset"
            (click)="resetInteractiveMode()"
            title="Réinitialiser la session interactive"
          >Reset</button>
        </div>
        <div class="interactive-resources" *ngIf="interactivePlay.isActive() && !interactivePlay.isFreeplay()">
          <span class="res-item pa">
            <img src="assets/images/characteristics/AP.png" alt="PA" class="res-icon" />
            {{ interactivePlay.availablePa }}
          </span>
          <span class="res-item pw">
            <img src="assets/images/characteristics/WP.png" alt="PW" class="res-icon" />
            {{ interactivePlay.availablePw }}
          </span>
          <span class="res-item mp">
            <img src="assets/images/characteristics/MP.png" alt="MP" class="res-icon" />
            {{ interactivePlay.availableMp }}
          </span>
        </div>
        <div class="interactive-resources" *ngIf="interactivePlay.isActive() && interactivePlay.isFreeplay() && !isXelorFreeplayActive()">
          <span class="res-item freeplay-badge">Aucune restriction</span>
        </div>
        <div class="interactive-resources" *ngIf="interactivePlay.isActive() && isXelorFreeplayActive()">
          <span class="res-item freeplay-badge xelor-badge">Xel Rouage – passifs actifs</span>
        </div>
        <div class="interactive-hint" *ngIf="interactivePlay.isActive()">
          <span *ngIf="selectedSpellId()">Cliquez sur une case pour lancer <strong>{{ getSpellName(selectedSpellId()!) }}</strong></span>
          <span *ngIf="!selectedSpellId()">Cliquez sur une case pour déplacer le joueur</span>
        </div>
      </div>
      }

      <!-- Map + Panneau sorts côte à côte — toujours affiché -->
      <div class="board-and-spells">

        <!-- MAP -->
        <div class="board-wrapper" #boardWrapper>
          <div class="board" [ngStyle]="gridStyle()"><div
              *ngFor="let cell of boardCells()"
              class="cell"
              [ngStyle]="{ 'grid-column': cell.x + 1, 'grid-row': cell.y + 1 }"
              [class.pending-placement]="placementMode() !== 'none'"
              [class.has-entity]="cell.hasEntity"
              [class.has-mechanism]="cell.hasMechanism"
              [class.has-action]="cell.isAction"
              [class.spell-range-cell]="isCellInSpellRange(cell.x, cell.y)"
              [class.move-range-cell]="isCellInMoveRange(cell.x, cell.y)"
              [class.hover-move-range-cell]="isCellInHoverMoveRange(cell.x, cell.y)"
              [class.interactive-move-cell]="isCellInInteractiveMoveRange(cell.x, cell.y)"
              [class.interactive-spell-cell]="isCellInInteractiveSpellRange(cell.x, cell.y)"
              [class.interactive-pw-move-cell]="isCellInInteractivePwMoveRange(cell.x, cell.y)"
              [title]="'(' + cell.x + ', ' + cell.y + ')'"
              (click)="onCellClick(cell)"
            >
            <span class="coord" *ngIf="cell.x === 0 || cell.y === 0">
              {{ cell.x === 0 ? cell.y : cell.x }}
            </span>
            <div
              *ngIf="getEntityAtPosition(cell.x, cell.y) as entity"
              class="entity"
              [class.player]="entity.type === 'player'"
              [class.enemy]="entity.type === 'enemy'"
              (mouseenter)="onEntityHover(entity)"
              (mouseleave)="clearHover()"
              [title]="entity.name"
            >
              {{ entity.type === 'player' ? '🧙' : '👹' }}
              <span class="entity-label">{{ entity.name }}</span>
            </div>
            <div
              *ngIf="getDialHourAtPosition(cell.x, cell.y) as dialHour"
              class="dial-hour"
              [class.current-hour]="isCurrentDialHour(dialHour.hour)"
              [title]="'Cadran - ' + dialHour.hour + 'h' + (isCurrentDialHour(dialHour.hour) ? ' (HEURE COURANTE)' : '')"
            >
              <img [src]="'assets/images/board/dial/dial_hours-' + dialHour.hour + '.png'" [alt]="'Heure ' + dialHour.hour" class="dial-hour-image" />
              <span *ngIf="isCurrentDialHour(dialHour.hour)" class="current-hour-indicator">⏰</span>
            </div>
            <div
              *ngIf="getMechanismAtPosition(cell.x, cell.y) as mech"
              class="mechanism"
              [ngClass]="[mech.type, (mech.type === 'cog' && (mech.charges || 0) > 0) ? 'has-charges' : '']"
              [title]="getMechanismTitle(mech.type) + (mech.charges ? ' (' + mech.charges + ' charges)' : '')"
            >
              <img [src]="getMechanismImage(mech.type, mech.charges)" [alt]="getMechanismTitle(mech.type)" class="mechanism-image" />
              <span *ngIf="mech.type === 'cog' && (mech.charges || 0) > 0" class="charge-badge">{{ mech.charges }}</span>
            </div>
            <div
              *ngIf="!getMechanismAtPosition(cell.x, cell.y) && getActionAtPosition(cell.x, cell.y) as action"
              class="action-indicator"
              [class]="action.type"
              [title]="action.type"
            >✨</div>
          </div><!-- fin cell -->
        </div><!-- fin .board -->
        </div><!-- fin .board-wrapper -->

        <!-- PANNEAU SORTS -->
        <aside class="spells-panel">

          <!-- Avec un build : la barre de sorts (2 rangees de 6, ordre du deck), pour que
               l'ordre visuel et les raccourcis coincident. Sinon : tri par element. -->
          @if (deckRows().length > 0) {
            <div class="deck-rows">
              @for (row of deckRows(); track $index; let r = $index) {
                <div class="spell-grid deck-row">
                  @for (slot of row; track $index; let c = $index) {
                    @if (slot) {
                      <ng-container
                        *ngTemplateOutlet="spellCard; context: { $implicit: slot, shortcut: deckSlotLabel(r, c) }"
                      ></ng-container>
                    } @else {
                      <div class="spell-icon-card empty-slot" title="Emplacement vide">
                        <span class="shortcut-badge">{{ deckSlotLabel(r, c) }}</span>
                      </div>
                    }
                  }
                </div>
              }
            </div>
          } @else if (buildSpells().length > 0) {
            <div class="spell-group" *ngFor="let group of spellsByElement()">
              <div class="spell-group-label">{{ group.label }}</div>
              <div class="spell-grid">
                <ng-container *ngFor="let spell of group.spells">
                  <ng-container
                    *ngTemplateOutlet="spellCard; context: { $implicit: spell, shortcut: shortcutLabels().get(spell.id) }"
                  ></ng-container>
                </ng-container>
              </div>
            </div>
          } @else {
            <ng-container *ngTemplateOutlet="noSpells"></ng-container>
          }

          <ng-template #spellCard let-spell let-shortcut="shortcut">
            <div
              class="spell-icon-card"
              [class.selected]="selectedSpellId() === spell.id"
              (click)="onSelectSpell(spell)"
              (mouseenter)="showTooltip(spell, $event)"
              (mouseleave)="hideTooltip()"
            >
              <div class="spell-icon-wrapper">
                <img *ngIf="spell.iconId" [src]="'assets/images/spells/' + spell.iconId + '.png'" [alt]="spell.name" class="spell-icon-img" (error)="onSpellImgError($event)" />
                <div *ngIf="!spell.iconId" class="spell-icon-fallback">✨</div>
              </div>
              <div class="spell-cost-band">
                <span *ngIf="spell.paCost > 0" class="cost-item">
                  {{ spell.paCost }}<img src="assets/images/characteristics/AP.png" alt="PA" class="cost-icon" />
                </span>
                <span *ngIf="spell.pwCost > 0" class="cost-item">
                  {{ spell.pwCost }}<img src="assets/images/characteristics/WP.png" alt="PW" class="cost-icon" />
                </span>
              </div>
              <div class="selected-ring" *ngIf="selectedSpellId() === spell.id"></div>
              <span class="shortcut-badge" *ngIf="shortcut">{{ shortcut }}</span>
            </div>
          </ng-template>

          <!-- Sorts innés de la classe -->
          <div class="innate-spells-section" *ngIf="innateSpells().length > 0">
            <div class="innate-spells-label">Sorts innés</div>
            <div class="spell-grid innate-spell-grid">
              <div
                *ngFor="let spell of innateSpells()"
                class="spell-icon-card innate-spell-card"
                [class.selected]="selectedSpellId() === spell.id"
                (click)="onSelectSpell(spell)"
                (mouseenter)="showTooltip(spell, $event)"
                (mouseleave)="hideTooltip()"
              >
                <div class="spell-icon-wrapper">
                  <img *ngIf="spell.iconId" [src]="'assets/images/spells/' + spell.iconId + '.png'" [alt]="spell.name" class="spell-icon-img" (error)="onSpellImgError($event)" />
                  <div *ngIf="!spell.iconId" class="spell-icon-fallback">⚙️</div>
                </div>
                <div class="spell-cost-band">
                  <span *ngIf="spell.paCost > 0" class="cost-item">
                    {{ spell.paCost }}<img src="assets/images/characteristics/AP.png" alt="PA" class="cost-icon" />
                  </span>
                  <span *ngIf="spell.pwCost > 0" class="cost-item">
                    {{ spell.pwCost }}<img src="assets/images/characteristics/WP.png" alt="PW" class="cost-icon" />
                  </span>
                </div>
                <div class="selected-ring" *ngIf="selectedSpellId() === spell.id"></div>
                <span class="shortcut-badge" *ngIf="shortcutLabels().get(spell.id)">{{ shortcutLabels().get(spell.id) }}</span>
              </div>
            </div>
          </div>

          <ng-template #noSpells>
            <div class="no-spells-hint">Aucun sort disponible.</div>
          </ng-template>
        </aside>

      </div><!-- fin .board-and-spells -->

      <div
        class="spell-tooltip-portal"
        *ngIf="tooltipSpell()"
        [ngStyle]="{ top: tooltipY() + 'px', left: tooltipX() + 'px' }"
      >
        <div class="tooltip-name">{{ tooltipSpell()!.name }}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Coût</span>
          <span class="tooltip-costs">
            <span *ngIf="tooltipSpell()!.paCost > 0" class="tooltip-cost-item">
              {{ tooltipSpell()!.paCost }}<img src="assets/images/characteristics/AP.png" alt="PA" class="tooltip-icon" />
            </span>
            <span *ngIf="tooltipSpell()!.pwCost > 0" class="tooltip-cost-item">
              {{ tooltipSpell()!.pwCost }}<img src="assets/images/characteristics/WP.png" alt="PW" class="tooltip-icon" />
            </span>
            <span *ngIf="getMpCost(tooltipSpell()!) > 0" class="tooltip-cost-item">
              {{ getMpCost(tooltipSpell()!) }}<img src="assets/images/characteristics/MP.png" alt="MP" class="tooltip-icon" />
            </span>
          </span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Portée</span>
          <span class="tooltip-range">
            {{ tooltipSpell()!.poMin }} –
            <ng-container *ngIf="tooltipSpell()!.poModifiable && rangeBonus() > 0; else baseRange">
              <span class="range-effective">{{ tooltipSpell()!.poMax + rangeBonus() }}</span>
            </ng-container>
            <ng-template #baseRange>{{ tooltipSpell()!.poMax }}</ng-template>
            <img src="assets/images/characteristics/RANGE.png" alt="Portée" class="tooltip-icon" />
            <img *ngIf="tooltipSpell()!.poModifiable" src="assets/images/characteristics/RANGE_MODIFIABLE.png" alt="Modifiable" class="tooltip-icon" title="Portée modifiable" />
          </span>
        </div>
        <div class="tooltip-row" *ngIf="hasDamage(tooltipSpell()!)">
          <span class="tooltip-label">Cible</span>
          <span class="tooltip-aoe">
            <img *ngIf="isAoe(tooltipSpell()!)" src="assets/images/characteristics/AOE_DMG.png" alt="Zone" class="tooltip-icon" />
            <img *ngIf="!isAoe(tooltipSpell()!)" src="assets/images/characteristics/SINGLE_TARGET_DMG.png" alt="Mono-cible" class="tooltip-icon" />
            <span>{{ isAoe(tooltipSpell()!) ? 'Zone' : 'Mono-cible' }}</span>
          </span>
        </div>
        <div class="tooltip-row" *ngIf="tooltipSpell()!.usePerTurn > 0">
          <span class="tooltip-label">Utilisations/tour</span>
          <span>{{ tooltipSpell()!.usePerTurn }}</span>
        </div>
        <div class="tooltip-row" *ngIf="tooltipSpell()!.usePerTarget > 0">
          <span class="tooltip-label">Utilisations/cible</span>
          <span>{{ tooltipSpell()!.usePerTarget }}</span>
        </div>
        <div class="tooltip-row" *ngIf="tooltipSpell()!.cooldown > 0">
          <span class="tooltip-label">Rechargement</span>
          <span>{{ tooltipSpell()!.cooldown }} tour(s)</span>
        </div>
        <div class="tooltip-desc" *ngIf="tooltipSpell()!.description">{{ tooltipSpell()!.description }}</div>
        <div class="tooltip-ratios" *ngIf="getNormalRatio(tooltipSpell()!) || getCritRatio(tooltipSpell()!) || getPerChargeRatio(tooltipSpell()!)">
          <div class="tooltip-ratio-title">Ratios de dégâts</div>
          <div class="tooltip-row" *ngIf="getNormalRatio(tooltipSpell()!) as nr">
            <span class="tooltip-label">Normal</span>
            <span class="ratio-value">{{ nr }}</span>
          </div>
          <div class="tooltip-row" *ngIf="getCritRatio(tooltipSpell()!) as cr">
            <span class="tooltip-label">Critique</span>
            <span class="ratio-value ratio-crit">{{ cr }}</span>
          </div>
          <div class="tooltip-row" *ngIf="getPerChargeRatio(tooltipSpell()!) as pc">
            <span class="tooltip-label">Par charge</span>
            <span class="ratio-value ratio-per-charge">{{ pc }} / charge</span>
          </div>
        </div>
      </div>

      <!-- Entities Info -->
      <div class="entities-info">
        <h3>Entités</h3>
        <div class="info-grid">
          <div class="entity-info" *ngFor="let entity of boardService.state().entities">
            <div class="entity-header">
              <div class="entity-type" [class]="entity.type">
                {{ entity.type === 'player' ? 'Joueur' : 'Ennemi' }}
              </div>
              <div class="entity-actions">
                <button (click)="onEditEntity(entity)" class="btn-edit" title="Modifier">✏️</button>
                <button (click)="onDeleteEntity(entity)" class="btn-delete" title="Supprimer">🗑️</button>
              </div>
            </div>
            <div class="entity-details">
              <strong>{{ entity.name }}</strong>
              <span *ngIf="entity.classId" class="entity-class">{{ entity.classId }}</span>
              <span>Position: ({{ entity.position.x }}, {{ entity.position.y }})</span>
              <span>Direction: {{ entity.facing.direction }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Mechanisms Info -->
      <div class="mechanisms-info" *ngIf="boardService.mechanisms().length > 0">
        <h3>⚙️ Mécanismes</h3>
        <div class="mechanisms-list">
          <div class="mechanism-info" *ngFor="let mech of boardService.mechanisms()">
            <div class="mech-icon">
              <img
                [src]="getMechanismImage(mech.type, mech.charges)"
                [alt]="getMechanismTitle(mech.type)"
                class="mech-icon-image"
              />
            </div>
            <div class="mech-details">
              <strong>{{ getMechanismTitle(mech.type) }}</strong>
              <span>Position: ({{ mech.position.x }}, {{ mech.position.y }})</span>
              <span>Charges: {{ mech.charges || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .board-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
      background: var(--app-bg);
      border-radius: 12px;
      color: var(--app-text);
    }

    .board-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .board-header h2 {
      margin: 0;
      font-size: 18px;
      color: var(--app-text);
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }

    .timeline-indicator {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .timeline-badge {
      background: linear-gradient(135deg, var(--app-accent), #5ad7f0);
      color: var(--app-accent-contrast);
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 0 12px color-mix(in srgb, var(--app-accent) 40%, transparent);
    }

    .board-controls {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .btn-nav, .btn-reset, .btn-run-full, .btn-end-turn {
      background: var(--app-surface-2);
      border: 1px solid var(--app-border);
      color: var(--app-text);
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }

    .btn-end-turn {
      background: rgba(255, 209, 102, 0.12);
      border-color: rgba(255, 209, 102, 0.5);
      color: #ffd166;
      font-weight: 600;
    }

    .btn-end-turn:hover:not(:disabled) {
      background: rgba(255, 209, 102, 0.25);
      border-color: #ffd166;
    }

    .btn-end-turn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-run-full {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: #667eea;
      font-weight: 600;
      padding: 10px 16px;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .btn-run-full:hover:not(:disabled) {
      background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
    }

    .btn-run-full:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .btn-nav:hover:not(:disabled) {
      background: var(--app-accent);
      color: var(--app-accent-contrast);
      border-color: var(--app-accent);
    }

    .btn-nav:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-reset:hover:not(:disabled) {
      background: #4cc9f0;
      color: var(--app-accent-contrast);
    }

    .btn-reset:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .divider {
      width: 1px;
      height: 24px;
      background: var(--app-border);
      margin: 0 4px;
    }

    .step-indicator {
      font-size: 12px;
      color: var(--app-text-muted);
      min-width: 80px;
      text-align: center;
    }

    /* Legend */
    .board-setup-warning {
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(239, 71, 111, 0.15);
      border: 1px solid rgba(239, 71, 111, 0.5);
      color: #ffb4c4;
      font-size: 13px;
      font-weight: 600;
    }

    .placement-help {
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(76, 201, 240, 0.12);
      border: 1px solid rgba(76, 201, 240, 0.45);
      color: #bdefff;
      font-size: 13px;
      font-weight: 600;
    }

    .legend {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      padding: 12px;
      background: var(--app-surface);
      border-radius: 8px;
      border: 1px solid var(--app-border);
      font-size: 12px;
      position: sticky;
      top: 0;
      z-index: 10;
      width: 100%;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 12px;
      white-space: nowrap;
    }

    .legend-color {
      width: 14px;
      height: 14px;
      min-width: 14px;
      min-height: 14px;
      flex-shrink: 0;
      flex-grow: 0;
      border-radius: 3px;
      border: 1px solid var(--app-border);
    }

    .legend-color.player {
      background: linear-gradient(135deg, var(--app-success), #5ad7f0);
    }

    .legend-color.enemy {
      background: var(--app-danger);
    }

    .legend-color.mechanism {
      background: #ffd166;
    }

    .legend-color.action-spell {
      background: #7aa2f7;
    }

    .legend-color.mechanism-explode {
      background: #ff6b6b;
    }

    /* ══════════════════════════════════════
       Layout principal : map + panneau sorts
       ══════════════════════════════════════ */
    .board-and-spells {
      display: flex;
      flex-direction: row;
      gap: 16px;
      align-items: flex-start;
      width: 100%;
    }

    /* MAP — 58% de la largeur */
    .board-wrapper {
      display: flex;
      flex: 0 0 58%;
      width: 58%;
      justify-content: center;
      padding: 10px;
      background: var(--app-surface);
      border-radius: 12px;
      border: 1px solid var(--app-border);
      overflow: hidden;
      min-height: 420px;
      box-sizing: border-box;
    }

    /* PANNEAU SORTS — prend le reste (≈33%) — sticky, s'aligne avec le haut de la map */
    .spells-panel {
      flex: 1 1 0;
      min-width: 0;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 10px;
      padding: 14px;
      position: sticky;
      top: 8px;
      align-self: flex-start;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
      overflow-x: visible;
      box-sizing: border-box;
    }

    .spells-actions {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 6px;
      margin-bottom: 14px;
    }

    .spells-actions .cancel-btn {
      grid-column: unset;
    }

    .btn-icon {
      width: 14px;
      height: 14px;
      vertical-align: middle;
      margin-right: 2px;
    }

    /* Grille des sorts — icônes 4 par ligne */
    .spell-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      padding: 4px 0;
    }

    .spells-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 12px;
    }

    .spells-actions .cancel-btn {
      grid-column: 1 / -1;
    }

    .btn-icon {
      width: 14px;
      height: 14px;
      vertical-align: middle;
      margin-right: 2px;
    }

    /* Grille des icônes de sorts */
    .spell-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 4px 0;
    }

    /* Regroupement par élément (mode timeline) */
    .spell-group {
      margin-bottom: 10px;
    }
    .spell-group-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--app-text-muted);
      margin-bottom: 4px;
    }

    /* Carte icône de sort */
    .spell-icon-card {
      position: relative;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }

    .spell-icon-wrapper {
      position: relative;
      width: 46px;
      height: 46px;
      overflow: hidden;
    }

    .spell-icon-card:hover .spell-icon-wrapper {
      box-shadow: 0 0 10px color-mix(in srgb, var(--app-accent) 50%, transparent);
    }

    .spell-icon-img {
      width: 46px;
      height: 46px;
      display: block;
      object-fit: cover;
    }

    .spell-icon-fallback {
      width: 46px;
      height: 46px;
      background: #1f2838;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }

    /* Bandeau coût SOUS l'image */
    .spell-cost-band {
      width: 46px;
      background: rgba(0, 0, 0, 0.88);
      border-radius: 0 0 6px 6px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 3px;
      padding: 3px 2px 4px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      line-height: 1;
      box-sizing: border-box;
    }

    .cost-item {
      display: flex;
      align-items: center;
      gap: 1px;
    }

    .cost-icon {
      width: 11px;
      height: 11px;
      object-fit: contain;
    }

    /* Anneau de sélection — positionné sur toute la card (image + bandeau) */
    .selected-ring {
      position: absolute;
      inset: -2px;
      border-radius: 10px;
      border: 2px solid #7aa2f7;
      pointer-events: none;
      animation: ringPulse 1.5s ease-in-out infinite;
    }

    @keyframes ringPulse {
      0%, 100% { box-shadow: 0 0 6px rgba(122, 162, 247, 0.4); }
      50% { box-shadow: 0 0 14px rgba(122, 162, 247, 0.8); }
    }

    /* ═══ Portail Tooltip — position: fixed, jamais dans le flux ═══ */
    .spell-tooltip-portal {
      position: fixed;
      z-index: 9999;
      width: 220px;
      background: #161c2a;
      border: 1px solid #2e3d58;
      border-radius: 8px;
      padding: 8px 10px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.8);
      color: var(--app-text);
      font-size: 11px;
      pointer-events: none;
    }

    .spell-icon-card:hover .spell-tooltip-portal {
      display: block;
    }

    .tooltip-name {
      font-size: 12px;
      font-weight: 700;
      color: var(--app-text);
      margin-bottom: 6px;
      border-bottom: 1px solid #2e3d58;
      padding-bottom: 5px;
    }

    .tooltip-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 11px;
    }

    .tooltip-label {
      color: var(--app-text-muted);
      white-space: nowrap;
      font-size: 10px;
    }

    .tooltip-costs,
    .tooltip-range,
    .tooltip-aoe {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .tooltip-cost-item {
      display: flex;
      align-items: center;
      gap: 2px;
      font-weight: 600;
      background: rgba(255,255,255,0.06);
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 11px;
    }

    .tooltip-icon {
      width: 13px;
      height: 13px;
      object-fit: contain;
      vertical-align: middle;
    }

    .tooltip-desc {
      font-size: 10px;
      color: var(--app-text-muted);
      margin-top: 6px;
      border-top: 1px solid #2e3d58;
      padding-top: 6px;
      line-height: 1.4;
      max-height: 60px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
    }

    .tooltip-ratios {
      margin-top: 6px;
      border-top: 1px solid #2e3d58;
      padding-top: 6px;
    }

    .tooltip-ratio-title {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--app-text-muted);
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .ratio-value {
      font-weight: 700;
      color: #7bd88f;
      font-size: 11px;
    }

    .ratio-crit {
      color: #ffd166;
    }

    .ratio-per-charge {
      color: #4cc9f0;
      font-style: italic;
    }

    .btn-nav.active {
      border-color: #7aa2f7;
      background: #1a2a44;
      box-shadow: 0 0 0 2px rgba(122, 162, 247, 0.35);
    }


    .no-timeline {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      color: var(--app-text-muted);
      text-align: center;
    }

    .no-timeline h3 {
      margin: 0;
      color: var(--app-text);
      font-size: 16px;
    }

    .no-timeline p {
      margin: 0;
      font-size: 13px;
      color: var(--app-text-muted);
    }

    .no-timeline-steps {
      background: var(--app-surface-2);
      border: 1px solid var(--app-border);
      border-radius: 8px;
      padding: 16px;
      text-align: left;
      min-width: 300px;
    }

    .no-timeline-steps ol {
      margin: 0;
      padding-left: 20px;
    }

    .no-timeline-steps li {
      margin-bottom: 8px;
      color: var(--app-text);
      font-size: 13px;
    }

    .board {
      display: grid;
      gap: 1px;
      background: #0f1415;
      padding: 10px;
      border-radius: 8px;
    }

    .no-spells-hint {
      color: var(--app-text-muted);
      padding: 8px;
      font-size: 13px;
    }

    /* Section sorts innés */
    .innate-spells-section {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--app-border);
    }

    .innate-spells-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #ffd166;
      margin-bottom: 8px;
      padding: 0 2px;
    }

    .innate-spell-card:hover .spell-icon-wrapper {
      box-shadow: 0 0 10px rgba(255, 209, 102, 0.5);
    }


    .innate-spell-card.selected .selected-ring {
      border-color: #ffd166;
      animation: ringPulseGold 1.5s ease-in-out infinite;
    }

    .deck-rows { display: flex; flex-direction: column; gap: 8px; }
    .deck-row { display: flex; gap: 6px; }
    .empty-slot {
      opacity: 0.35;
      border: 1px dashed var(--app-border);
      background: transparent;
      cursor: default;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .shortcut-badge {
      position: absolute;
      top: 2px;
      left: 2px;
      padding: 0 4px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      font-size: 10px;
      line-height: 1.5;
      pointer-events: none;
    }
    .empty-slot .shortcut-badge { position: static; background: none; opacity: 0.8; }

    @keyframes ringPulseGold {
      0%, 100% { box-shadow: 0 0 6px rgba(255, 209, 102, 0.4); }
      50% { box-shadow: 0 0 14px rgba(255, 209, 102, 0.8); }
    }

    .cell {
      background: linear-gradient(135deg, #141a24, #0f151f);
      border: 1px solid var(--app-border);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      transition: all 0.2s;
      overflow: hidden;
    }

    .cell:hover {
      background: #1a2236;
      box-shadow: 0 0 8px rgba(76, 201, 240, 0.3);
    }

    .cell.pending-placement:hover {
      box-shadow: 0 0 12px rgba(123, 216, 143, 0.8);
      border-color: var(--app-success);
    }

    .cell.has-entity {
      background: #1e2844;
    }

    .cell.has-action {
      background: #2a3a5a;
      box-shadow: inset 0 0 8px rgba(122, 162, 247, 0.3);
    }

    .cell.spell-range-cell {
      background: rgba(41, 98, 255, 0.35);
      box-shadow: inset 0 0 12px rgba(76, 144, 255, 0.8);
    }

    .cell.move-range-cell,
    .cell.hover-move-range-cell {
      background: rgba(52, 199, 89, 0.3);
      box-shadow: inset 0 0 10px rgba(52, 199, 89, 0.7);
    }

    .cell.has-mechanism {
      background: #3a3a2a;
    }

    .coord {
      position: absolute;
      top: 10%;
      left: 10%;
      font-size: 0.5em;
      color: var(--app-text-muted);
      opacity: 0.5;
    }

    /* Entity */
    .entity {
      font-size: 1.2em;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2em;
      position: relative;
      z-index: 2;
    }

    .entity-label {
      font-size: 0.4em;
      color: var(--app-text);
      background: rgba(0, 0, 0, 0.7);
      padding: 0.25em 0.3em;
      border-radius: 0.2em;
      white-space: nowrap;
    }

    .entity.player {
      filter: drop-shadow(0 0 4px var(--app-success));
    }

    .entity.enemy {
      filter: drop-shadow(0 0 4px var(--app-danger));
    }

    /* Mechanism */
    .legend-color.mechanism {
      background: #ffd166;
    }

    /* Mécanismes dans le board */
    .board .mechanism {
      position: absolute;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      animation: pulse 1.5s ease-in-out infinite;
    }

    .board .mechanism-image {
      width: 80%;
      height: 80%;
      object-fit: contain;
      filter: drop-shadow(0 0 4px rgba(255, 209, 102, 0.6));
    }

    .board .mechanism.cog .mechanism-image {
      filter: drop-shadow(0 0 4px rgba(255, 209, 102, 0.8));
    }

    /* Rouage avec charges - teinte bleue via CSS (remplace rouage-bleu.png corrompu) */
    .board .mechanism.cog.has-charges .mechanism-image {
      filter: drop-shadow(0 0 8px rgba(76, 201, 240, 1))
              hue-rotate(180deg)
              saturate(1.5)
              brightness(1.1);
    }

    /* Badge affichant le nombre de charges */
    .board .mechanism .charge-badge {
      position: absolute;
      bottom: 2px;
      right: 2px;
      background: linear-gradient(135deg, #4cc9f0, #00b4d8);
      color: var(--app-accent-contrast);
      font-size: 10px;
      font-weight: bold;
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      z-index: 10;
    }

    .board .mechanism.cog {
      z-index: 3 !important;
    }

    .board .mechanism.dial .mechanism-image {
      filter: drop-shadow(0 0 6px rgba(167, 139, 250, 0.9));
    }

    .board .mechanism.dial:not(.dial-hour) {
      z-index: 3 !important;
    }

    .board .dial-hour {
      position: absolute;
      z-index: 0 !important;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .board .dial-hour-image {
      width: 60%;
      height: 60%;
      opacity: 0.5;
      object-fit: contain;
      filter: drop-shadow(0 0 3px rgba(167, 139, 250, 0.5));
      animation: hourGlow 3s ease-in-out infinite;
    }

    @keyframes hourGlow {
      0%, 100% {
        opacity: 0.4;
        filter: drop-shadow(0 0 2px rgba(167, 139, 250, 0.4));
      }
      50% {
        opacity: 0.6;
        filter: drop-shadow(0 0 4px rgba(167, 139, 250, 0.6));
      }
    }

    .board .dial-hour.current-hour .dial-hour-image {
      opacity: 1 !important;
      width: 80%;
      height: 80%;
      filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.9)) drop-shadow(0 0 15px rgba(255, 215, 0, 0.6)) !important;
      animation: currentHourPulse 1s ease-in-out infinite !important;
    }

    .board .dial-hour.current-hour {
      z-index: 1 !important;
    }

    .board .current-hour-indicator {
      position: absolute;
      top: -5px;
      right: -5px;
      font-size: 12px;
      animation: currentHourBounce 0.5s ease-in-out infinite alternate;
    }

    @keyframes currentHourPulse {
      0%, 100% {
        opacity: 0.9;
        transform: scale(1);
        filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.9)) drop-shadow(0 0 15px rgba(255, 215, 0, 0.6));
      }
      50% {
        opacity: 1;
        transform: scale(1.1);
        filter: drop-shadow(0 0 12px rgba(255, 215, 0, 1)) drop-shadow(0 0 20px rgba(255, 215, 0, 0.8));
      }
    }

    @keyframes currentHourBounce {
      0% { transform: translateY(0); }
      100% { transform: translateY(-3px); }
    }

    .board .mechanism.sinistro {
      z-index: 3 !important;
    }

    .board .mechanism.sinistro .mechanism-image {
      filter: drop-shadow(0 0 4px rgba(255, 107, 107, 0.8));
    }

    .board .mechanism.regulateur {
      z-index: 3 !important;
    }

    .board .mechanism.regulateur .mechanism-image {
      filter: drop-shadow(0 0 4px rgba(76, 201, 240, 0.8));
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .action-indicator {
      font-size: 0.8em;
      position: absolute;
      z-index: 0;
      animation: sparkle 0.6s ease-out;
    }

    .action-indicator.CastSpell {
      color: #7aa2f7;
    }

    .action-indicator.Move {
      color: #90ee90;
    }

    .action-indicator.Transpose {
      color: #ff69b4;
    }

    @keyframes sparkle {
      0% { transform: scale(0); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    .timeline-display {
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 8px;
      padding: 12px;
    }

    .timeline-display h3 {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: var(--app-accent);
      text-transform: uppercase;
    }

    .actions-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .action-item {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      align-items: center;
      padding: 8px;
      background: var(--app-surface-2);
      border-radius: 6px;
      border-left: 3px solid transparent;
      font-size: 12px;
    }

    .action-type {
      background: #2b344a;
      color: var(--app-text);
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 500;
      min-width: 100px;
    }

    .action-type.CastSpell {
      background: #2a3a5a;
      color: #7aa2f7;
      border-left-color: #7aa2f7;
    }

    .spell-info, .pos-info, .facing-info {
      color: var(--app-text-muted);
    }

    .entities-info,
    .mechanisms-info {
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 8px;
      padding: 12px;
    }

    .entities-info h3,
    .mechanisms-info h3 {
      margin: 0 0 12px 0;
      font-size: 13px;
      color: var(--app-accent);
      text-transform: uppercase;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .entity-info {
      background: var(--app-surface-2);
      border: 1px solid var(--app-border);
      border-radius: 6px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .entity-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .entity-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .entity-info:hover .entity-actions {
      opacity: 1;
    }

    .btn-edit, .btn-delete {
      background: transparent;
      border: 1px solid var(--app-border);
      color: var(--app-text);
      border-radius: 4px;
      padding: 2px 6px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
    }

    .btn-edit:hover {
      background: #4cc9f0;
      color: var(--app-accent-contrast);
      border-color: #4cc9f0;
    }

    .btn-delete:hover {
      background: #ef476f;
      color: white;
      border-color: #ef476f;
    }

    .entity-type {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      white-space: nowrap;
    }

    .entity-type.player {
      background: var(--app-success);
      color: var(--app-accent-contrast);
    }

    .entity-type.enemy {
      background: var(--app-danger);
      color: white;
    }

    .entity-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
    }

    .entity-details strong {
      color: var(--app-text);
    }

    .entity-details span {
      color: var(--app-text-muted);
    }

    .entity-class {
      display: inline-block;
      background: linear-gradient(135deg, var(--app-accent), #5ad5f0);
      color: var(--app-accent-contrast);
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
      width: fit-content;
    }

    .mechanisms-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .mechanism-info {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 8px;
      background: var(--app-surface-2);
      border: 1px solid var(--app-border);
      border-radius: 6px;
    }

    .mech-icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .mech-icon-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 0 2px rgba(255, 209, 102, 0.5));
    }

    .mech-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
    }

    .mech-details strong {
      color: var(--app-text);
    }

    .mech-details span {
      color: var(--app-text-muted);
    }

    @media (max-width: 1400px) {
      .board-and-spells {
        flex-direction: column;
        align-items: center;
      }

      .spells-panel {
        flex: 0 0 auto;
        width: 100%;
        max-width: 600px;
        position: relative;
        top: auto;
        max-height: none;
      }

      .spell-grid {
        grid-template-columns: repeat(6, 1fr);
      }

      .board-wrapper {
        min-height: 0;
      }
    }

    /* ═══ Bandeau Mode Interactif ═══ */
    .interactive-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 14px;
      border-radius: 10px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      transition: all 0.3s;
      flex-wrap: wrap;
    }

    .interactive-bar.active {
      background: rgba(102, 126, 234, 0.1);
      border-color: #667eea;
      box-shadow: 0 0 14px rgba(102, 126, 234, 0.2);
    }

    .interactive-bar-left {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .btn-interactive {
      background: var(--app-surface-2);
      border: 1px solid var(--app-border);
      color: var(--app-text);
      border-radius: 8px;
      padding: 7px 14px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn-interactive.on {
      background: linear-gradient(135deg, #667eea, #764ba2);
      border-color: #667eea;
      color: #fff;
      box-shadow: 0 0 10px rgba(102, 126, 234, 0.5);
    }

    .btn-interactive.freeplay {
      background: linear-gradient(135deg, #f093fb, #f5576c);
      border-color: #f5576c;
      color: #fff;
      box-shadow: 0 0 10px rgba(245, 87, 108, 0.5);
    }

    /* ── Bouton Freeplay Xel Rouage ── */
    .btn-xelor-freeplay {
      background: #1e2a3a !important;
      border-color: #ffd166 !important;
      color: #ffd166 !important;
    }

    .btn-xelor-freeplay.on {
      background: linear-gradient(135deg, #b8860b, #ffd166) !important;
      border-color: #ffd166 !important;
      color: var(--app-accent-contrast) !important;
      box-shadow: 0 0 12px rgba(255, 209, 102, 0.6) !important;
    }

    .btn-xelor-freeplay:hover:not(:disabled) {
      background: linear-gradient(135deg, #b8860b, #ffd166) !important;
      border-color: #ffd166 !important;
      color: var(--app-accent-contrast) !important;
    }

    /* ── Menu Passifs (Freeplay Xel Rouage) ── */
    .passives-menu-wrapper {
      position: relative;
      display: inline-block;
    }

    .btn-passives-menu {
      background: #1a1e2a;
      border: 1px solid #555a6e;
      color: var(--app-text-muted);
      border-radius: 6px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn-passives-menu:hover,
    .btn-passives-menu.open {
      background: rgba(167, 139, 250, 0.2);
      border-color: #a78bfa;
      color: #c4b5fd;
    }

    .passives-menu-backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
    }

    .passives-menu-panel {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      z-index: 50;
      min-width: 248px;
      background: #161a26;
      border: 1px solid #555a6e;
      border-radius: 8px;
      padding: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    }

    .passives-menu-title {
      font-size: 12px;
      font-weight: 700;
      color: #ffd166;
      padding: 2px 4px 6px;
    }

    .passives-menu-section {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #6b7280;
      padding: 4px 4px 2px;
    }

    .passives-menu-separator {
      height: 1px;
      background: #2a2f3e;
      margin: 6px 2px;
    }

    .passive-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 5px 6px;
      border-radius: 6px;
      text-align: left;
      font-size: 12px;
      color: #c7cdda;
      background: transparent;
      border: 1px solid transparent;
    }

    .passive-row.mandatory {
      color: var(--app-text-muted);
      cursor: default;
    }

    .passive-row.optional {
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }

    .passive-row.optional:hover {
      background: rgba(167, 139, 250, 0.1);
      border-color: rgba(167, 139, 250, 0.4);
    }

    .passive-row.optional.enabled {
      color: #e8ebf2;
    }

    .passive-row-icon {
      width: 22px;
      height: 22px;
      border-radius: 4px;
      object-fit: cover;
      flex-shrink: 0;
    }

    .passive-lock {
      font-size: 11px;
      width: 16px;
      text-align: center;
      flex-shrink: 0;
    }

    .passive-row-name {
      flex: 1;
    }

    .passive-switch {
      width: 34px;
      height: 18px;
      border-radius: 9px;
      background: #3a3f4e;
      position: relative;
      flex-shrink: 0;
      transition: background 0.2s;
    }

    .passive-switch.on {
      background: #a78bfa;
    }

    .passive-switch-knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.2s;
    }

    .passive-switch.on .passive-switch-knob {
      transform: translateX(16px);
    }

    /* ── Bandeau Xel Rouage actif ── */
    .interactive-bar.xelor-freeplay {
      background: rgba(255, 209, 102, 0.07);
      border-color: #ffd166;
      box-shadow: 0 0 14px rgba(255, 209, 102, 0.2);
    }

    /* ── Badge Xel Rouage ── */
    .res-item.xelor-badge {
      color: #ffd166 !important;
      background: rgba(255, 209, 102, 0.12) !important;
      border: 1px solid rgba(255, 209, 102, 0.35) !important;
    }

    .interactive-bar.freeplay {
      background: rgba(245, 87, 108, 0.08);
      border-color: #f5576c;
      box-shadow: 0 0 14px rgba(245, 87, 108, 0.2);
    }

    .res-item.freeplay-badge {
      color: #f5576c;
      font-weight: 700;
      font-size: 12px;
      background: rgba(245, 87, 108, 0.1);
      border: 1px solid rgba(245, 87, 108, 0.3);
      border-radius: 6px;
      padding: 3px 10px;
    }

    .btn-interactive:hover:not(:disabled) {
      background: linear-gradient(135deg, #667eea, #764ba2);
      border-color: #667eea;
      color: #fff;
    }

    .btn-interactive:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .btn-interactive-reset {
      background: #2a1e3a;
      border: 1px solid #764ba2;
      color: #c4a0f7;
      border-radius: 7px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
    }

    .btn-interactive-reset:hover {
      background: #3b2060;
    }

    .interactive-resources {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .res-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(255,255,255,0.06);
    }

    .res-item.pa { color: #ffd166; }
    .res-item.pw { color: #4cc9f0; }
    .res-item.mp { color: #7bd88f; }

    .res-icon {
      width: 14px;
      height: 14px;
      object-fit: contain;
    }

    .interactive-hint {
      flex: 1;
      font-size: 12px;
      color: var(--app-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .interactive-hint strong {
      color: #c4a0f7;
    }

    /* ═══ Highlights des cellules en mode interactif ═══ */

    /* Déplacement PM (vert clair) */
    .cell.interactive-move-cell {
      background: rgba(52, 199, 89, 0.25);
      box-shadow: inset 0 0 10px rgba(52, 199, 89, 0.6);
      cursor: pointer;
    }

    .cell.interactive-move-cell:hover {
      background: rgba(52, 199, 89, 0.5);
      box-shadow: inset 0 0 14px rgba(52, 199, 89, 0.9);
    }

    /* Déplacement PW via heure cadran (or/mauve) */
    .cell.interactive-pw-move-cell {
      background: rgba(167, 139, 250, 0.3);
      box-shadow: inset 0 0 10px rgba(167, 139, 250, 0.7);
      cursor: pointer;
    }

    .cell.interactive-pw-move-cell:hover {
      background: rgba(167, 139, 250, 0.5);
      box-shadow: inset 0 0 14px rgba(167, 139, 250, 0.9);
    }

    /* Portée de sort interactif (bleu) */
    .cell.interactive-spell-cell {
      background: rgba(122, 162, 247, 0.28);
      box-shadow: inset 0 0 12px rgba(122, 162, 247, 0.7);
      cursor: crosshair;
    }

    .cell.interactive-spell-cell:hover {
      background: rgba(122, 162, 247, 0.5);
      box-shadow: inset 0 0 16px rgba(122, 162, 247, 1);
    }
  `]
})
export class BoardComponent implements AfterViewInit, OnDestroy {
  readonly mode = input<'timeline' | 'freeplay'>('timeline');

  timelineService = inject(TimelineService);
  buildService = inject(BuildService);
  boardService = inject(BoardService);
  simulationService = inject(SimulationService);
  interactivePlay = inject(InteractivePlayService);
  regenerationService = inject(ResourceRegenerationService);
  dataCacheService = inject(DataCacheService);
  statsCalculator = inject(StatsCalculatorService);

  /** Bonus de portée issu du build sélectionné (0 si aucun build) */
  rangeBonus = computed(() => {
    const build = this.buildService.selectedBuildA();
    if (!build) return 0;
    return this.statsCalculator.calculateTotalStats(build).range ?? 0;
  });

  spellsCache = signal<Map<string, Spell>>(new Map());
  selectedSpellId = signal<string | null>(null);
  selectedInteractionMode = signal<'none' | 'spell' | 'move' | 'pwMove'>('none');
  hoveredPlayerId = signal<string | null>(null);

  /**
   * Passifs proposés dans le menu du Freeplay Xel Rouage.
   * `mandatory` = imposé (verrouillé, toujours actif) ; sinon togglable.
   * L'ordre définit l'affichage du menu.
   */
  readonly xelorFreeplayPassives: ReadonlyArray<{ id: string; mandatory: boolean }> = [
    { id: 'XEL_MAITRE_CADRAN', mandatory: true },
    { id: 'XEL_MECANISMES_SPECIALISES', mandatory: true },
    { id: 'XEL_COURS_TEMPS', mandatory: true },
    { id: 'XEL_REMANENCE', mandatory: false },
    { id: 'XEL_HORLOGERIE', mandatory: false },
    { id: 'XEL_PERMUTATION_MOMENTANEE', mandatory: false },
  ];

  /** État activé des passifs optionnels du Freeplay Xel Rouage (défaut : tous ON). */
  xelorOptionalPassivesEnabled = signal<Record<string, boolean>>({
    XEL_REMANENCE: true,
    XEL_HORLOGERIE: true,
    XEL_PERMUTATION_MOMENTANEE: true,
  });

  /** Ouverture du panneau de configuration des passifs. */
  xelorPassivesMenuOpen = signal<boolean>(false);

  /** Données passifs Xélor (nom/icône/description) résolues depuis Passives.json. */
  xelorPassivesData = signal<Passive[]>([]);

  /** Tooltip portal */
  tooltipSpell = signal<Spell | null>(null);
  tooltipX = signal<number>(0);
  tooltipY = signal<number>(0);

  editPlayer = output<BoardEntity>();
  editEnemy = output<BoardEntity>();
  deleteEntity = output<BoardEntity>();
  boardCellClick = output<Position>();
  placementMode = input<'none' | 'player' | 'enemy' | 'player-edit' | 'enemy-edit' | 'cog'>('none');

  currentTimeline = computed(() => this.timelineService.currentTimeline());
  currentStepIndex = computed(() => this.timelineService.currentStepIndex());

  isSimulating = computed(() => this.simulationService.isRunning());
  hasMinimumBoardSetup = computed(() => this.boardService.hasMinimumSetup());

  private lastObservedTimelineId: string | null = null;

  constructor() {
    effect(() => {
      const timelineId = this.timelineService.currentTimelineId();
      const timeline = this.currentTimeline();

      if (timelineId === this.lastObservedTimelineId) {
        return;
      }

      this.lastObservedTimelineId = timelineId;
      this.simulationService.clearSimulation();
      this.regenerationService.clearHistory();

      if (timeline) {
        console.log('🗑️ Timeline changée:', timeline.name, '- cache simulation/régénération réinitialisé');
      }
    });

    effect(() => {
      const build = this.buildService.selectedBuildA();
      if (build?.classId) {
        this.loadSpells(build.classId);
      } else {
        const player = this.boardService.player();
        if (player?.classId) {
          this.loadSpells(player.classId);
        }
      }
    });

    // Recalcule la taille de case quand cols/rows changent. La 1re exécution a lieu
    // avant ngAfterViewInit (boardWrapperRef indéfini) : le garde dans
    // recomputeCellSize la rend inoffensive ; queueMicrotask laisse le DOM se mettre
    // à jour avant la mesure.
    effect(() => {
      this.boardService.gridSize(); // dépendance : recalcul quand cols/rows changent
      queueMicrotask(() => this.recomputeCellSize());
    });

    // Précharge les passifs Xélor pour alimenter le menu du Freeplay Xel Rouage.
    this.loadXelorPassivesData();

    // Restaure l'UI du Freeplay Xél Rouage si une session est déjà active (le composant
    // a pu être recréé après une navigation). La session persiste dans le service : on
    // reconstitue l'état activé des passifs optionnels et on recharge les sorts Xélor.
    if (this.interactivePlay.isXelorFreeplay()) {
      const enabledIds = new Set(this.interactivePlay.getXelorOptionalPassiveIds());
      const restored: Record<string, boolean> = {};
      for (const p of this.optionalXelorPassives()) {
        restored[p.id] = enabledIds.has(p.id);
      }
      this.xelorOptionalPassivesEnabled.set(restored);
      this.loadSpells('XEL');
    }
  }

  ngAfterViewInit(): void {
    const el = this.boardWrapperRef?.nativeElement;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.recomputeCellSize());
      this.resizeObserver.observe(el);
    }
    this.recomputeCellSize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private recomputeCellSize(): void {
    const el = this.boardWrapperRef?.nativeElement;
    if (!el) return;
    const { cols, rows } = this.boardService.gridSize();
    const style = getComputedStyle(el);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    // padX/padY = padding du .board-wrapper (mesuré) ; BOARD_PADDING/BOARD_GAP =
    // padding et gap internes du .board (constantes de module couplées au CSS).
    const availW = el.clientWidth - padX;
    const availH = el.clientHeight - padY;
    const usableW = availW - BOARD_PADDING * 2 - BOARD_GAP * (cols - 1);
    const usableH = availH - BOARD_PADDING * 2 - BOARD_GAP * (rows - 1);
    const perCol = usableW / cols;
    const perRow = usableH / rows;
    const size = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(Math.min(perCol, perRow))));
    this.cellSize.set(Number.isFinite(size) && size > 0 ? size : MIN_CELL);
  }

  /** Charge les passifs Xélor (nom/icône/description) depuis le cache de données. */
  private async loadXelorPassivesData(): Promise<void> {
    try {
      this.xelorPassivesData.set(await this.dataCacheService.getPassives('XEL'));
    } catch {
      // Données indisponibles : le menu retombera sur les ids bruts.
    }
  }

  /** Classe effective : build sélectionné ou joueur par défaut sur le board */
  private get effectiveClassId(): string | undefined {
    return this.buildService.selectedBuildA()?.classId
      ?? this.boardService.player()?.classId;
  }

  buildSpells = computed(() => {
    const build = this.buildService.selectedBuildA();
    const cache = this.spellsCache();

    if (build) {
      return build.spellBar.spells
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map(s => cache.get(s.spellId))
        .filter((s): s is Spell => !!s);
    }

    return Array.from(cache.values())
      .filter(s => !getInnateSpellIdsForClass(this.boardService.player()?.classId ?? '').includes(s.id));
  });

  /** Ordre canonique des lignes d'éléments dans le panneau de sorts (mode timeline). */
  private readonly ELEMENT_ORDER: ReadonlyArray<{ key: string; label: string }> = [
    { key: 'fire', label: 'Feu' },
    { key: 'water', label: 'Eau' },
    { key: 'earth', label: 'Terre' },
    { key: 'air', label: 'Air' },
    { key: 'neutral', label: 'Neutre' },
  ];

  /** Normalise la valeur d'élément d'un sort (données hétérogènes) vers une clé canonique. */
  private normalizeElement(el?: string): string {
    const e = (el ?? '').toLowerCase();
    if (e === 'fire' || e === 'feu') return 'fire';
    if (e === 'water' || e === 'eau') return 'water';
    if (e === 'earth' || e === 'terre') return 'earth';
    if (e === 'air') return 'air';
    return 'neutral';
  }

  /** Sorts du build regroupés par élément (lignes non vides seulement), pour le mode timeline. */
  spellsByElement = computed(() => {
    const spells = this.buildSpells();
    return this.ELEMENT_ORDER
      .map(g => ({ key: g.key, label: g.label, spells: spells.filter(s => this.normalizeElement(s.element) === g.key) }))
      .filter(g => g.spells.length > 0);
  });

  innateSpells = computed(() => {
    const build = this.buildService.selectedBuildA();
    const cache = this.spellsCache();
    const classId = build?.classId ?? this.boardService.player()?.classId ?? '';
    if (!classId) return [] as Spell[];
    const innateIds = getInnateSpellIdsForClass(classId);
    return innateIds
      .map(id => cache.get(id))
      .filter((s): s is Spell => !!s);
  });

  /**
   * Les sorts adressables au clavier, dans l'ordre des raccourcis.
   * Avec un build : les emplacements du deck, trous preserves (index = numero
   * d'emplacement). Sans build : l'ordre affiche, limite a 12.
   */
  shortcutSpells = computed<(Spell | null)[]>(() => {
    const build = this.buildService.selectedBuildA();
    const cache = this.spellsCache();
    if (build) {
      return deckSlotSpells(build.spellBar.spells, (id: string) => cache.get(id));
    }
    // Sans build, les raccourcis suivent l'ORDRE AFFICHE (tri par element), sinon les
    // badges paraitraient tires au hasard : ils viendraient de l'ordre du cache alors
    // que les cartes sont rangees par element.
    return this.spellsByElement().flatMap(group => group.spells);
  });

  /**
   * Sorts par rangee. Le deck garde 6 (comme en jeu, touche = emplacement). Sans build,
   * on coupe la liste affichee en deux : 15 sorts -> 8 puis 7, et cela suit le total.
   */
  shortcutRowSize = computed<number>(() =>
    this.buildService.selectedBuildA()
      ? DECK_ROW_SIZE
      : shortcutRowSize(this.shortcutSpells().length),
  );

  /** Le deck decoupe en rangees de 6, pour l'affichage facon barre de sorts. */
  deckRows = computed<(Spell | null)[][]>(() => {
    // La barre de deck n'a de sens qu'avec un build : elle reproduit SES emplacements.
    // Sans build, on rend la liste vide pour laisser le tri par element s'afficher.
    if (!this.buildService.selectedBuildA()) {
      return [];
    }
    const slots = this.shortcutSpells();
    const rows: (Spell | null)[][] = [];
    for (let i = 0; i < slots.length; i += DECK_ROW_SIZE) {
      rows.push(slots.slice(i, i + DECK_ROW_SIZE));
    }
    return rows;
  });

  /** spellId -> libelle du raccourci ('1', 'alt+4', 'ctrl+2'), pour les badges. */
  shortcutLabels = computed<Map<string, string>>(() => {
    const labels = new Map<string, string>();
    const rowSize = this.shortcutRowSize();
    this.shortcutSpells().forEach((spell, index) => {
      if (spell) {
        labels.set(spell.id, shortcutLabelForIndex(index, rowSize));
      }
    });
    this.innateSpells().forEach((spell, index) => {
      labels.set(spell.id, innateShortcutLabel(index));
    });
    return labels;
  });

  /** Libelle du raccourci d'un emplacement du deck, y compris vide. */
  deckSlotLabel(rowIndex: number, colIndex: number): string {
    return shortcutLabelForIndex(rowIndex * DECK_ROW_SIZE + colIndex, DECK_ROW_SIZE);
  }

  currentStep = computed(() => {
    const timeline = this.currentTimeline();
    if (!timeline) return null;
    const idx = this.currentStepIndex();
    return idx > 0 && idx <= timeline.steps.length ? timeline.steps[idx - 1] || null : null;
  });

  totalSteps = computed(() => {
    const stepsCount = this.currentTimeline()?.steps.length || 0;
    return stepsCount + 1;
  });

  boardCells = computed(() => {
    const { cols, rows } = this.boardService.gridSize();
    const cells: BoardCell[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        cells.push({
          x,
          y,
          hasEntity: !!this.getEntityAtPosition(x, y),
          hasMechanism: !!this.getMechanismAtPosition(x, y),
          isAction: !!this.getActionAtPosition(x, y)
        });
      }
    }
    return cells;
  });

  cellSize = signal<number>(MAX_CELL);

  gridStyle = computed(() => {
    const { cols, rows } = this.boardService.gridSize();
    const size = this.cellSize();
    return {
      'grid-template-columns': `repeat(${cols}, ${size}px)`,
      'grid-template-rows': `repeat(${rows}, ${size}px)`
    };
  });

  @ViewChild('boardWrapper') boardWrapperRef?: ElementRef<HTMLElement>;
  private resizeObserver?: ResizeObserver;

  getEntityAtPosition(x: number, y: number) {
    return this.boardService.state().entities.find(
      e => e.position.x === x && e.position.y === y
    );
  }

  getMechanismAtPosition(x: number, y: number) {
    return this.boardService.state().mechanisms.find(
      m => m.position.x === x && m.position.y === y
    );
  }

  getDialHourAtPosition(x: number, y: number) {
    return this.boardService.dialHours().find(
      h => h.position.x === x && h.position.y === y
    );
  }

  isCurrentDialHour(hour: number): boolean {
    const currentHour = this.boardService.currentDialHour();
    return currentHour !== undefined && currentHour === hour;
  }

  getCurrentDialHour(): number | undefined {
    return this.boardService.currentDialHour();
  }

  getPlacementHelpText(): string {
    const mode = this.placementMode();
    if (mode === 'player') return 'Cliquez sur une case de la carte pour placer le joueur.';
    if (mode === 'enemy') return "Cliquez sur une case de la carte pour placer l'ennemi.";
    if (mode === 'player-edit') return 'Validez votre modification puis cliquez sur une case pour déplacer le joueur.';
    if (mode === 'enemy-edit') return "Validez votre modification puis cliquez sur une case pour déplacer l'ennemi.";
    return 'Cliquez sur une case de la carte pour placer le rouage.';
  }

  getActionAtPosition(x: number, y: number) {
    if (!this.currentStep()) return null;

    const actions = this.currentStep()?.actions || [];
    return actions.find(a => {
      if (a.targetPosition?.x !== x || a.targetPosition?.y !== y) {
        return false;
      }

      if (a.type === 'Move' || a.type === 'Transpose') {
        return false;
      }

      return !(a.type === 'CastSpell' && a.spellId && isSpellMechanism(a.spellId));
    });
  }

  getMechanismImage(type: string, charges?: number): string {
    return getMechanismImagePath(type, charges);
  }

  getMechanismTitle(type: string): string {
    return getMechanismDisplayName(type);
  }

  getSpellName(spellId: string): string {
    return this.spellsCache().get(spellId)?.name || spellId;
  }

  private async loadSpells(classId: string): Promise<void> {
    const spells = await this.dataCacheService.getSpells(classId);
    const cache = new Map<string, Spell>();
    spells.forEach(spell => cache.set(spell.id, spell));

    const innateIds = getInnateSpellIdsForClass(classId);
    for (const innateId of innateIds) {
      if (!cache.has(innateId)) {
        const innateSpell = await this.dataCacheService.getSpellById(innateId);
        if (innateSpell) {
          cache.set(innateSpell.id, innateSpell);
        }
      }
    }

    this.spellsCache.set(cache);
  }

  /**
   * Raccourcis clavier facon Wakfu : selectionne le sort, exactement comme un clic sur
   * sa carte. La case cible reste choisie a la souris — aucun nouveau chemin de lancement.
   */
  @HostListener('window:keydown', ['$event'])
  onSpellShortcut(event: KeyboardEvent): void {
    const shortcut = parseSpellShortcut(event);
    if (!shortcut) {
      return;
    }
    const spell = resolveShortcutSpell(
      shortcut,
      this.shortcutSpells(),
      this.innateSpells(),
      this.shortcutRowSize(),
    );
    if (!spell) {
      return;
    }
    // preventDefault seulement quand un raccourci a ete reconnu ET resolu, pour ne pas
    // neutraliser des frappes qui ne nous concernent pas.
    event.preventDefault();
    this.onSelectSpell(spell);
  }

  onSelectSpell(spell: Spell): void {
    if (this.selectedSpellId() === spell.id) {
      this.selectedSpellId.set(null);
      this.selectedInteractionMode.set('none');
    } else {
      this.selectedSpellId.set(spell.id);
      if (!this.interactivePlay.isActive()) {
        this.selectedInteractionMode.set('spell');
      }
    }
  }

  onSpellImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  showTooltip(spell: Spell, event: MouseEvent): void {
    const TOOLTIP_WIDTH = 220;
    const TOOLTIP_HEIGHT = 280;
    const MARGIN = 8;
    let x = event.clientX - TOOLTIP_WIDTH - MARGIN;
    let y = event.clientY;
    if (x < 8) x = event.clientX + MARGIN;
    if (y + TOOLTIP_HEIGHT > window.innerHeight - 8) {
      y = window.innerHeight - TOOLTIP_HEIGHT - 8;
    }
    this.tooltipSpell.set(spell);
    this.tooltipX.set(x);
    this.tooltipY.set(y);
  }

  hideTooltip(): void {
    this.tooltipSpell.set(null);
  }

  /** Coût en PM (si le sort déplace) — pour l'instant 0, extensible */
  getMpCost(_spell: Spell): number {
    return 0;
  }

  /** Retourne vrai si le sort fait des dégâts de zone (AOE) — basé sur le champ is_aoe en BDD */
  isAoe(spell: Spell): boolean {
    return spell.isAoe ?? false;
  }

  /** Retourne vrai si le sort inflige des dégâts (au moins un breakpoint avec ratio > 0) */
  hasDamage(spell: Spell): boolean {
    return spell.breakpoints?.some(b => b.ratio > 0) ?? false;
  }

  /** Ratio de dégâts normal — depuis le breakpoint kind=NORMAL */
  getNormalRatio(spell: Spell): number | null {
    const bp = spell.breakpoints?.find(b => b.kind === 'NORMAL');
    return (bp && bp.ratio > 0) ? bp.ratio : null;
  }

  /** Ratio de dégâts critique — depuis le breakpoint kind=CRIT */
  getCritRatio(spell: Spell): number | null {
    const bp = spell.breakpoints?.find(b => b.kind === 'CRIT');
    return (bp && bp.ratio > 0) ? bp.ratio : null;
  }

  /** Ratio par charge (mécanismes comme le Rouage) — depuis le breakpoint kind=PER_CHARGE */
  getPerChargeRatio(spell: Spell): number | null {
    const bp = spell.breakpoints?.find(b => b.kind === 'PER_CHARGE');
    return (bp && bp.ratio > 0) ? bp.ratio : null;
  }

  selectMoveMode(mode: 'move' | 'pwMove'): void {
    this.selectedSpellId.set(null);
    this.selectedInteractionMode.set(mode);
  }

  clearSelectedInteraction(): void {
    this.selectedSpellId.set(null);
    this.selectedInteractionMode.set('none');
  }

  onEntityHover(entity: BoardEntity): void {
    if (entity.type === 'player') {
      this.hoveredPlayerId.set(entity.id);
    }
  }

  clearHover(): void {
    this.hoveredPlayerId.set(null);
  }

  isCellInSpellRange(x: number, y: number): boolean {
    if (this.selectedInteractionMode() !== 'spell') return false;
    return this.computeSpellRange(x, y, this.selectedSpellId());
  }

  /**
   * Calcul effectif de la portée d'un sort.
   * En freeplay (sans build) : toute la map est accessible.
   */
  private computeSpellRange(x: number, y: number, spellId: string | null): boolean {
    // Freeplay : aucune restriction de portée
    if (this.interactivePlay.isFreeplay()) return true;

    const spell = spellId ? this.spellsCache().get(spellId) : null;
    const player = this.boardService.state().entities.find(e => e.type === 'player');
    if (!spell || !player) return false;

    const bonus = spell.poModifiable ? this.rangeBonus() : 0;
    const effectivePoMax = spell.poMax + bonus;
    const effectivePoMin = Math.max(0, spell.poMin);

    const dist = Math.abs(player.position.x - x) + Math.abs(player.position.y - y);
    const isSelfCast = dist === 0 && spell.selfCastable === true;
    if (!isSelfCast && (dist < effectivePoMin || dist > effectivePoMax)) return false;

    const dx = x - player.position.x;
    const dy = y - player.position.y;

    switch ((spell.direction || 'NONE').toUpperCase()) {
      case 'LINE':
        if (dx !== 0 && dy !== 0) return false;
        break;
      case 'CROSS':
        if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false;
        break;
      default:
        break;
    }

    if (spell.lineOfSight) {
      return this.hasLineOfSightOnBoard(player.position, { x, y });
    }

    return true;
  }

  /**
   * Vérifie la ligne de vue entre deux positions via Bresenham
   * sur l'état courant du board (entités + mécanismes comme obstacles)
   */
  private hasLineOfSightOnBoard(
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): boolean {
    if (from.x === to.x && from.y === to.y) return true;

    const state = this.boardService.state();

    // En session interactive (dont Freeplay Xel Rouage), les passifs actifs vivent
    // dans le contexte de la session ; sinon on retombe sur le build sélectionné.
    const sessionPassiveIds = this.interactivePlay.context()?.activePassiveIds;
    const buildPassiveIds = this.buildService.selectedBuildA()?.passiveBar.passives
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map(p => p.passiveId);
    const activePassiveIds = sessionPassiveIds ?? buildPassiveIds ?? [];
    const hasRemanence = activePassiveIds.some(id =>
      id.toLowerCase().replace(/é/g, 'e').includes('remanence')
    );

    const blockers = new Set<string>();

    for (const entity of state.entities) {
      if (entity.position.x !== from.x || entity.position.y !== from.y) {
        blockers.add(`${entity.position.x},${entity.position.y}`);
      }
    }
    if (!hasRemanence) {
      for (const mech of state.mechanisms) {
        blockers.add(`${mech.position.x},${mech.position.y}`);
      }
    }

    let x0 = from.x, y0 = from.y;
    const x1 = to.x, y1 = to.y;
    const adx = Math.abs(x1 - x0), ady = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = adx - ady;

    while (true) {
      const e2 = 2 * err;
      if (e2 > -ady) { err -= ady; x0 += sx; }
      if (e2 < adx)  { err += adx; y0 += sy; }
      if (x0 === x1 && y0 === y1) break;
      if (blockers.has(`${x0},${y0}`)) return false;
    }

    return true;
  }

  isCellInMoveRange(x: number, y: number): boolean {
    const mode = this.selectedInteractionMode();
    if (mode !== 'move' && mode !== 'pwMove') return false;
    const player = this.boardService.state().entities.find(e => e.type === 'player');
    if (!player) return false;
    const maxRange = mode === 'move' ? 3 : 2;
    const dist = Math.abs(player.position.x - x) + Math.abs(player.position.y - y);
    return dist > 0 && dist <= maxRange;
  }

  isCellInHoverMoveRange(x: number, y: number): boolean {
    if (!this.hoveredPlayerId()) return false;
    if (this.interactivePlay.isActive()) return false;
    const player = this.boardService.state().entities.find(e => e.id === this.hoveredPlayerId());
    if (!player) return false;
    const dist = Math.abs(player.position.x - x) + Math.abs(player.position.y - y);
    const mp = this.interactivePlay.availableMp > 0
      ? this.interactivePlay.availableMp
      : 3;
    return dist > 0 && dist <= mp;
  }

  private async pushInteractionAction(cell: BoardCell): Promise<void> {
    const timeline = this.currentTimeline();
    if (!timeline) return;

    const mode = this.selectedInteractionMode();
    if (mode === 'none') return;

    let action: TimelineAction | null = null;
    if (mode === 'spell' && this.selectedSpellId() && this.isCellInSpellRange(cell.x, cell.y)) {
      action = {
        id: `action_${Date.now()}`,
        type: 'CastSpell',
        order: 1,
        spellId: this.selectedSpellId()!,
        targetPosition: { x: cell.x, y: cell.y }
      };
    }

    if ((mode === 'move' || mode === 'pwMove') && this.isCellInMoveRange(cell.x, cell.y)) {
      action = {
        id: `action_${Date.now()}`,
        type: 'Move',
        order: 1,
        targetPosition: { x: cell.x, y: cell.y },
        details: { via: mode === 'pwMove' ? 'PW' : 'PM', mpCost: mode === 'pwMove' ? 0 : 1, pwCost: mode === 'pwMove' ? 1 : 0 }
      };
    }

    if (!action) return;

    const step = { id: `step_${Date.now()}`, actions: [action], description: 'Ajout map interactive' };
    await this.timelineService.updateTimeline(timeline.id, { steps: [...timeline.steps, step] });
  }

  hasBuild(): boolean {
    return !!this.buildService.selectedBuildA();
  }

  /** Le mode Freeplay Xel Rouage est-il actif ? Source de vérité : la session du service (persiste à la navigation). */
  isXelorFreeplayActive(): boolean {
    return this.interactivePlay.isXelorFreeplay();
  }

  toggleInteractiveMode(): void {
    if (this.interactivePlay.isActive()) {
      this.interactivePlay.stopSession();
      return;
    }

    if (!this.boardService.hasMinimumSetup()) {
      alert('Placez au moins 1 allié et 1 ennemi sur le board avant d\'activer le mode interactif.');
      return;
    }

    this.boardService.saveInitialState();
    const build = this.buildService.selectedBuildA();
    if (build) {
      this.interactivePlay.startSession(build);
    } else {
      this.interactivePlay.startSessionFreeplay();
    }
  }

  /** Termine le tour courant en jeu interactif (fin de tour puis début du tour suivant). */
  async endInteractiveTurn(): Promise<void> {
    await this.interactivePlay.endTurn();
  }

  toggleXelorFreeplay(): void {
    if (this.interactivePlay.isActive() && this.isXelorFreeplayActive()) {
      this.interactivePlay.stopSession();
      return;
    }

    if (this.interactivePlay.isActive()) {
      // Arrêter l'autre mode d'abord
      this.interactivePlay.stopSession();
    }

    if (!this.boardService.hasMinimumSetup()) {
      alert('Placez au moins 1 allié et 1 ennemi sur le board avant d\'activer le mode Freeplay Xel Rouage.');
      return;
    }

    this.boardService.saveInitialState();
    this.interactivePlay.startSessionXelorFreeplay(this.enabledOptionalXelorPassiveIds());

    // Charger les sorts du Xelor
    this.loadSpells('XEL');
  }

  /** Passifs imposés du Freeplay Xel Rouage (toujours actifs). */
  mandatoryXelorPassives(): ReadonlyArray<{ id: string; mandatory: boolean }> {
    return this.xelorFreeplayPassives.filter(p => p.mandatory);
  }

  /** Passifs optionnels du Freeplay Xel Rouage (togglables dans le menu). */
  optionalXelorPassives(): ReadonlyArray<{ id: string; mandatory: boolean }> {
    return this.xelorFreeplayPassives.filter(p => !p.mandatory);
  }

  /** Ids des passifs optionnels actuellement activés. */
  enabledOptionalXelorPassiveIds(): string[] {
    const enabled = this.xelorOptionalPassivesEnabled();
    return this.optionalXelorPassives()
      .filter(p => enabled[p.id])
      .map(p => p.id);
  }

  /** Indique si un passif optionnel donné est activé. */
  isXelorOptionalEnabled(id: string): boolean {
    return !!this.xelorOptionalPassivesEnabled()[id];
  }

  /** Nombre de passifs optionnels actifs (affiché sur le bouton du menu). */
  activeXelorOptionalCount(): number {
    return this.enabledOptionalXelorPassiveIds().length;
  }

  getXelorPassiveName(id: string): string {
    return this.xelorPassivesData().find(p => p.id === id)?.name ?? id;
  }

  getXelorPassiveIconId(id: string): number | undefined {
    return this.xelorPassivesData().find(p => p.id === id)?.iconId;
  }

  getXelorPassiveDescription(id: string): string {
    return this.xelorPassivesData().find(p => p.id === id)?.description ?? '';
  }

  toggleXelorPassivesMenu(): void {
    this.xelorPassivesMenuOpen.update(open => !open);
  }

  /**
   * Active/désactive un passif optionnel. Si une session Xel Rouage est en cours,
   * elle est relancée avec le nouvel ensemble de passifs (le board revient à son
   * état initial, comme pour l'ancien toggle Rémanence).
   */
  toggleXelorOptionalPassive(id: string): void {
    const current = this.xelorOptionalPassivesEnabled();
    this.xelorOptionalPassivesEnabled.set({ ...current, [id]: !current[id] });

    if (this.interactivePlay.isActive() && this.isXelorFreeplayActive()) {
      this.boardService.restoreInitialState();
      this.boardService.saveInitialState();
      this.interactivePlay.startSessionXelorFreeplay(this.enabledOptionalXelorPassiveIds());
    }
  }

  resetInteractiveMode(): void {
    if (!this.boardService.restoreMap()) {
      this.boardService.restoreInitialState();
    }
    if (this.isXelorFreeplayActive()) {
      this.interactivePlay.startSessionXelorFreeplay(this.enabledOptionalXelorPassiveIds());
    } else {
      const build = this.buildService.selectedBuildA();
      this.interactivePlay.resetSession(build ?? null);
    }
  }

  /**
   * Portée de déplacement PM en mode interactif — visible uniquement au hover sur le joueur.
   * Si le joueur est sur une heure du cadran, les cases heures→heures sont gérées par PW.
   */
  isCellInInteractiveMoveRange(x: number, y: number): boolean {
    if (!this.interactivePlay.isActive()) return false;
    if (this.selectedSpellId()) return false;
    if (!this.hoveredPlayerId()) return false;
    const player = this.boardService.state().entities.find(e => e.type === 'player');
    if (!player || player.id !== this.hoveredPlayerId()) return false;
    const dist = Math.abs(player.position.x - x) + Math.abs(player.position.y - y);
    if (dist === 0) return false;
    // Freeplay : toute la map est accessible
    if (this.interactivePlay.isFreeplay()) return true;
    const playerOnDialHour = this.boardService.isPositionOnDialHour(player.position);
    const targetIsDialHour = this.boardService.isPositionOnDialHour({ x, y });
    if (playerOnDialHour && targetIsDialHour) return false;
    return dist <= Math.max(this.interactivePlay.availableMp, 0);
  }

  isCellInInteractivePwMoveRange(x: number, y: number): boolean {
    if (!this.interactivePlay.isActive()) return false;
    if (this.selectedSpellId()) return false;
    if (!this.hoveredPlayerId()) return false;
    const player = this.boardService.state().entities.find(e => e.type === 'player');
    if (!player || player.id !== this.hoveredPlayerId()) return false;
    const dist = Math.abs(player.position.x - x) + Math.abs(player.position.y - y);
    if (dist === 0) return false;
    // Freeplay : toutes les heures du cadran sont accessibles
    if (this.interactivePlay.isFreeplay()) {
      return this.boardService.isPositionOnDialHour({ x, y });
    }
    if (!this.boardService.isPositionOnDialHour(player.position)) return false;
    if (!this.boardService.isPositionOnDialHour({ x, y })) return false;
    return this.interactivePlay.availablePw > 0;
  }

  /**
   * Portée de sort en mode interactif (utilise computeSpellRange sans check du mode)
   */
  isCellInInteractiveSpellRange(x: number, y: number): boolean {
    if (!this.interactivePlay.isActive()) return false;
    if (!this.selectedSpellId()) return false;

    return this.computeSpellRange(x, y, this.selectedSpellId());
  }

  /**
   * Gestion du clic en mode interactif
   */
  private async handleInteractiveCellClick(cell: BoardCell): Promise<void> {
    const spellId = this.selectedSpellId();

    if (spellId) {
      if (!this.computeSpellRange(cell.x, cell.y, spellId)) {
        console.warn('[Interactive] La case est hors de portée du sort');
        return;
      }

      const result = await this.interactivePlay.castSpell(spellId, { x: cell.x, y: cell.y });

      if (result) {
        const build = this.buildService.selectedBuildA();
        const fakeAction: TimelineAction = {
          id: `iplay_visual_${Date.now()}`,
          type: 'CastSpell',
          order: 1,
          spellId,
          targetPosition: { x: cell.x, y: cell.y },
        };
        // applyVisualAction n'utilise pas vraiment le build (seulement pour les logs),
        // on passe un build factice si nécessaire
        if (build) {
          await this.applyVisualAction(fakeAction, build, this.simulationService.cachedSteps().length - 1);
        } else {
          await this.applyVisualActionFreeplay(fakeAction, this.simulationService.cachedSteps().length - 1);
        }
        this.boardService.pushState();
      }

      if (result?.success) {
        this.selectedSpellId.set(null);
        this.selectedInteractionMode.set('none');
      }
    } else {
      const player = this.boardService.state().entities.find(e => e.type === 'player');
      if (!player) return;

      const playerOnDialHour = this.boardService.isPositionOnDialHour(player.position);
      const targetIsDialHour = this.boardService.isPositionOnDialHour({ x: cell.x, y: cell.y });
      const via: 'PM' | 'PW' = (playerOnDialHour && targetIsDialHour) ? 'PW' : 'PM';

      const inRange = via === 'PW'
        ? this.isInInteractivePwMoveRangeRaw(cell.x, cell.y, player)
        : this.isInInteractiveMoveRangeRaw(cell.x, cell.y, player);

      if (!inRange) {
        console.warn('[Interactive] La case est hors de portée du déplacement');
        return;
      }

      await this.interactivePlay.move({ x: cell.x, y: cell.y }, via);
      this.boardService.pushState();
    }
  }

  /** Validation PM pure (sans check hover) */
  private isInInteractiveMoveRangeRaw(x: number, y: number, player: BoardEntity): boolean {
    if (this.interactivePlay.isFreeplay()) {
      return Math.abs(player.position.x - x) + Math.abs(player.position.y - y) > 0;
    }
    const playerOnDialHour = this.boardService.isPositionOnDialHour(player.position);
    const targetIsDialHour = this.boardService.isPositionOnDialHour({ x, y });
    if (playerOnDialHour && targetIsDialHour) return false;
    const dist = Math.abs(player.position.x - x) + Math.abs(player.position.y - y);
    return dist > 0 && dist <= Math.max(this.interactivePlay.availableMp, 0);
  }

  /** Validation PW pure (sans check hover) */
  private isInInteractivePwMoveRangeRaw(x: number, y: number, player: BoardEntity): boolean {
    if (this.interactivePlay.isFreeplay()) {
      return this.boardService.isPositionOnDialHour({ x, y }) &&
        Math.abs(player.position.x - x) + Math.abs(player.position.y - y) > 0;
    }
    if (!this.boardService.isPositionOnDialHour(player.position)) return false;
    if (!this.boardService.isPositionOnDialHour({ x, y })) return false;
    const dist = Math.abs(player.position.x - x) + Math.abs(player.position.y - y);
    return dist > 0 && this.interactivePlay.availablePw > 0;
  }

  async onNextStep(): Promise<void> {
    const timeline = this.currentTimeline();
    const build = this.buildService.selectedBuildA();
    const currentIndex = this.currentStepIndex();

    console.log('');
    console.log('🔵 [onNextStep] DÉBUT - Index actuel:', currentIndex);

    if (!timeline || !build) {
      console.warn('⚠️ Timeline ou Build manquant');
      return;
    }
    if (!this.boardService.hasMinimumSetup()) {
      alert('Placez au moins 1 allié et 1 ennemi sur le board avant de simuler.');
      return;
    }

    if (currentIndex === 0) {
      console.log('💾 Sauvegarde de l\'état initial du board');
      this.boardService.saveInitialState();
    }

    if (currentIndex >= timeline.steps.length) {
      console.warn('⚠️ Aucun step suivant disponible');
      return;
    }

    const realStepIndex = currentIndex;
    console.log(`\n🔹 [onNextStep] Exécution du step ${realStepIndex + 1}/${timeline.steps.length}...`);

    const success = await this.simulationService.executeStep(build, timeline, realStepIndex);

    if (!success) {
      console.error(`❌ Le step ${realStepIndex + 1} a échoué`);
      const stepResult = this.simulationService.getStepResult(realStepIndex);
      const failedAction = stepResult?.actions.find((a: any) => !a.success);
      const errorMessage = failedAction?.message || 'Action impossible à exécuter';

      alert(`⚠️ Erreur au step ${realStepIndex + 1}:\n${errorMessage}`);

      console.log('🚫 Map non mise à jour (step échoué)');
      return;
    }

    console.log(`✅ Step ${realStepIndex + 1} exécuté avec succès`);

    this.timelineService.nextStep();

    const step = timeline.steps[realStepIndex];
    for (const action of step.actions) {
      await this.applyVisualAction(action, build, realStepIndex);
    }

    this.boardService.pushState();

    if (this.currentStepIndex() >= timeline.steps.length) {
      this.logFinalSimulationSummaryFromCache(timeline.steps.length);
    }

    const stepResult = this.simulationService.getStepResult(realStepIndex);
    if (stepResult) {
      const contextAfter = stepResult.contextAfter;
      if (contextAfter) {
        console.log('📈 Ressources restantes:', {
          PA: contextAfter.availablePa,
          WP: contextAfter.availablePw,
          MP: contextAfter.availableMp
        });
      }
    }

    console.log('🔵 [onNextStep] FIN');
    console.log('');
  }

  /**
   * Affiche un récapitulatif final basé sur le cache de simulation
   * Utilisé pour le mode étape par étape lorsqu'on atteint le dernier step
   */
  private logFinalSimulationSummaryFromCache(totalSteps: number): void {
    const stats = this.simulationService.getCacheStats();
    if (!stats) return;

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 SIMULATION ÉTAPE PAR ÉTAPE TERMINÉE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Résultats finaux:');
    console.log(`  ✅ Steps exécutés: ${stats.stepsExecuted}/${totalSteps}`);
    console.log(`  💥 Dégâts totaux: ${stats.totalDamage}`);
    if (stats.totalHeal > 0)   console.log(`  💚 Soins totaux: ${stats.totalHeal}`);
    if (stats.totalShield > 0) console.log(`  🛡️ Armure totale: ${stats.totalShield}`);
    console.log(`  ⚡ PA utilisés: ${stats.totalPaUsed}`);
    console.log(`  🔮 WP utilisés: ${stats.totalPwUsed}`);
    console.log(`  🏃 MP utilisés: ${stats.totalMpUsed}`);

    this.logRegenerationSummary(stats.totalPaUsed, stats.totalPwUsed);

    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  }

  private async applyVisualActionFreeplay(action: TimelineAction, stepIndex: number): Promise<void> {
    // Même logique qu'applyVisualAction, le build n'est pas utilisé
    await this.applyVisualAction(action, null as any, stepIndex);
  }

  private async applyVisualAction(action: TimelineAction, _build: Build, stepIndex: number): Promise<void> {
    if (action.type === 'CastSpell' && action.spellId) {

      console.log(`🔍 Analyse du sort: "${action.spellId}"`);
      const mechanismType = getSpellMechanismType(action.spellId);
      console.log(`🎯 Type de mécanisme détecté: ${mechanismType || 'aucun'}`);

      if (mechanismType && action.targetPosition) {
        const existingMechanisms = this.boardService.getMechanismsByType(mechanismType);

        if (existingMechanisms.length > 0) {
          console.log(`ℹ️ Mécanisme ${mechanismType} déjà créé par la stratégie de classe - pas de doublon`);

          if (mechanismType === 'dial') {
            const dialHours = this.boardService.dialHours();
            if (dialHours.length > 0) {
              console.log(`ℹ️ Heures du cadran déjà créées (${dialHours.length} heures) - pas de doublon`);
            }
          }
          return;
        }

        console.log(`✅ Création d'un mécanisme ${mechanismType} à la position (${action.targetPosition.x}, ${action.targetPosition.y})`);

        const mechanism: Mechanism = {
          id: `mechanism_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          type: mechanismType,
          position: action.targetPosition,
          charges: 0,
          turn: stepIndex + 1,
          spellId: action.spellId
        };

        this.boardService.addMechanism(mechanism);
        console.log('🎉 Mécanisme créé et ajouté au plateau:', mechanism);

        if (mechanismType === 'dial') {
          const playerEntity = this.boardService.player();
          const playerPosition = playerEntity?.position || { x: 6, y: 6 };
          this.createDialHours(mechanism.id, action.targetPosition, playerPosition);
        }
      }
    }
  }

  /**
   * Crée les 12 heures autour d'un cadran
   */
  private createDialHours(dialId: string, centerPosition: Position, playerPosition: Position): void {
    console.log(`🕐 [DIAL_HOURS] Creating 12 hours around dial at (${centerPosition.x}, ${centerPosition.y})`);

    const dx = centerPosition.x - playerPosition.x;
    const dy = centerPosition.y - playerPosition.y;

    let rotation = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      rotation = dx > 0 ? 1 : 3;
    } else {
      rotation = dy > 0 ? 2 : 0;
    }

    const baseHourPositions = [
      { hour: 12, offsetX: 0, offsetY: -3 },
      { hour: 1, offsetX: +1, offsetY: -2 },
      { hour: 2, offsetX: +2, offsetY: -1 },
      { hour: 3, offsetX: +3, offsetY: 0 },
      { hour: 4, offsetX: +2, offsetY: +1 },
      { hour: 5, offsetX: +1, offsetY: +2 },
      { hour: 6, offsetX: 0, offsetY: +3 },
      { hour: 7, offsetX: -1, offsetY: +2 },
      { hour: 8, offsetX: -2, offsetY: +1 },
      { hour: 9, offsetX: -3, offsetY: 0 },
      { hour: 10, offsetX: -2, offsetY: -1 },
      { hour: 11, offsetX: -1, offsetY: -2 }
    ];

    baseHourPositions.forEach(({ hour, offsetX, offsetY }) => {
      let rotatedX = offsetX;
      let rotatedY = offsetY;

      for (let i = 0; i < rotation; i++) {
        const newX = -rotatedY;
        const newY = rotatedX;
        rotatedX = newX;
        rotatedY = newY;
      }

      const hourPosition = {
        x: centerPosition.x + rotatedX,
        y: centerPosition.y + rotatedY
      };

      if (hourPosition.x >= 0 && hourPosition.x < 13 && hourPosition.y >= 0 && hourPosition.y < 13) {
        const dialHour = {
          id: `dial_hour_${hour}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          dialId: dialId,
          hour: hour,
          position: hourPosition
        };

        this.boardService.addDialHour(dialHour);
        console.log(`  ✅ Hour ${hour} created at (${hourPosition.x}, ${hourPosition.y})`);
      }
    });
  }

  /**
   * Fin de tour explicite en navigation timeline : applique les effets de fin de tour
   * (Permutation momentanée, explosions Rouage/Sinistro, Régulateur) puis le début du tour suivant
   * (Horlogerie, TP Prémonition) sur l'état courant. Le moteur mute le board directement ;
   * on resynchronise la position du joueur depuis le contexte renvoyé.
   */
  onEndTurn(): void {
    const build = this.buildService.selectedBuildA();
    if (!build) {
      console.warn('⚠️ [onEndTurn] Build manquant');
      return;
    }
    if (this.currentStepIndex() === 0) {
      return; // aucun tour en cours (état initial)
    }

    const result = this.simulationService.endTimelineTurn(build);
    if (!result) {
      return;
    }

    // Le board a été muté par le moteur (échanges, explosions) ; on aligne la position du joueur.
    const player = this.boardService.player();
    const ctxPlayer = result.contextAfter.entities?.find(e => e.type === 'player');
    if (player && ctxPlayer &&
        (ctxPlayer.position.x !== player.position.x || ctxPlayer.position.y !== player.position.y)) {
      this.boardService.updateEntityPosition(player.id, ctxPlayer.position);
    }

    console.log(`⏭️ [onEndTurn] Fin de tour appliquée → tour ${result.contextAfter.turn}`);
  }

  onPreviousStep(): void {
    const currentIndex = this.currentStepIndex();

    if (currentIndex > 0) {
      this.timelineService.previousStep();

      const newIndex = this.currentStepIndex();
      this.boardService.restoreStateAtIndex(newIndex);

      this.simulationService.trimSimulationCacheToStep(newIndex);

      console.log(`⏮️ Retour à l'étape ${newIndex} - Cache de simulation tronqué`);
    }
  }

  onReset(): void {
    this.timelineService.resetTimeline();

    if (!this.boardService.restoreMap()) {
      this.boardService.restoreInitialState();
    }

    this.simulationService.clearSimulation();

    this.regenerationService.clearHistory();

    console.log('🔄 Timeline et Board réinitialisés');
  }

  /**
   * Lance toute la simulation d'un coup
   * Exécute tous les steps avec validation à chaque étape
   * Met à jour le board à chaque step réussi
   * S'arrête et retourne l'erreur si un step échoue
   */
  async onRunFullSimulation(): Promise<void> {
    const timeline = this.currentTimeline();
    const build = this.buildService.selectedBuildA();

    if (!timeline || !build) {
      console.warn('⚠️ Timeline ou Build manquant');
      return;
    }

    if (!this.boardService.hasMinimumSetup()) {
      alert('Placez au moins 1 allié et 1 ennemi sur le board avant de simuler.');
      return;
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 LANCEMENT SIMULATION COMPLÈTE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 Timeline:', timeline.name);
    console.log('🔢 Nombre de steps:', timeline.steps.length);

    this.boardService.saveInitialState();
    console.log('💾 État initial sauvegardé');

    this.simulationService.clearSimulation();

    for (let stepIndex = 0; stepIndex < timeline.steps.length; stepIndex++) {
      const step = timeline.steps[stepIndex];
      console.log('');
      console.log(`┌───────────────────────────────────────────────────────┐`);
      console.log(`│  🔹 STEP ${stepIndex + 1}/${timeline.steps.length}: ${step.description || step.id}`);
      console.log(`└───────────────────────────────────────────────────────┘`);

      const success = await this.simulationService.executeStep(build, timeline, stepIndex);

      if (!success) {
        const stepResult = this.simulationService.getStepResult(stepIndex);
        const failedAction = stepResult?.actions.find((a: any) => !a.success);
        const errorMessage = failedAction?.message || 'Action impossible à exécuter';

        console.error(`❌ Step ${stepIndex + 1} échoué`);
        console.log(`❌ Simulation arrêtée au step ${stepIndex + 1}`);

        alert(`⚠️ Simulation arrêtée au step ${stepIndex + 1}:\n${errorMessage}`);
        return;
      }

      console.log(`✅ Step ${stepIndex + 1} exécuté avec succès`);

      const stepResult = this.simulationService.getStepResult(stepIndex);
      if (stepResult) {
        const contextAfter = stepResult.contextAfter;
        if (contextAfter) {
          console.log('📈 Ressources restantes:', {
            PA: contextAfter.availablePa,
            WP: contextAfter.availablePw,
            MP: contextAfter.availableMp
          });
        }
      }

      this.timelineService.nextStep();

      for (const action of step.actions) {
        await this.applyVisualAction(action, build, stepIndex);
      }

      this.boardService.pushState();

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const stats = this.simulationService.getCacheStats();
    if (stats) {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('🎉 SIMULATION COMPLÈTE TERMINÉE AVEC SUCCÈS');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📊 Résultats finaux:');
      console.log(`  ✅ Steps exécutés: ${stats.stepsExecuted}/${timeline.steps.length}`);
      console.log(`  💥 Dégâts totaux: ${stats.totalDamage}`);
      if (stats.totalHeal > 0)   console.log(`  💚 Soins totaux: ${stats.totalHeal}`);
      if (stats.totalShield > 0) console.log(`  🛡️ Armure totale: ${stats.totalShield}`);
      console.log(`  ⚡ PA utilisés: ${stats.totalPaUsed}`);
      console.log(`  🔮 WP utilisés: ${stats.totalPwUsed}`);
      console.log(`  🏃 MP utilisés: ${stats.totalMpUsed}`);

      this.logRegenerationSummary(stats.totalPaUsed, stats.totalPwUsed);

      console.log('═══════════════════════════════════════════════════════');
      console.log('');
    }
  }

  /**
   * Affiche le résumé de régénération de ressources depuis le service centralisé
   */
  private logRegenerationSummary(totalPaUsed: number, totalWpUsed: number): void {
    const regenSummary = this.regenerationService.getRegenerationSummary();
    if (regenSummary.totalPaRegenerated <= 0 && regenSummary.totalPwRegenerated <= 0) return;

    console.log('');
    console.log('💫 RÉGÉNÉRATION TOTALE:');
    console.log(`  💫 ⚡ PA régénérés: +${regenSummary.totalPaRegenerated}`);
    console.log(`  💫 🔮 PW régénérés: +${regenSummary.totalPwRegenerated}`);
    console.log(`  📈 Bilan net PA: ${regenSummary.totalPaRegenerated - totalPaUsed}`);
    console.log(`  📈 Bilan net PW: ${regenSummary.totalPwRegenerated - totalWpUsed}`);

    if (regenSummary.bySource.size > 0) {
      console.log('');
      console.log('💫 Détail par source:');
      regenSummary.bySource.forEach((sourceStats, source) => {
        const parts: string[] = [];
        if (sourceStats.pa > 0) parts.push(`+${sourceStats.pa} PA`);
        if (sourceStats.pw > 0) parts.push(`+${sourceStats.pw} PW`);
        console.log(`  💫   • ${source}: ${parts.join(', ')}`);
      });
    }
  }

  /**
   * Entity management
   */
  onEditEntity(entity: any): void {
    if (entity.type === 'player') {
      this.editPlayer.emit(entity);
    } else {
      this.editEnemy.emit(entity);
    }
  }

  onDeleteEntity(entity: any): void {
    if (confirm(`Supprimer ${entity.type === 'player' ? 'le joueur' : "l'ennemi"} "${entity.name}" ?`)) {
      this.boardService.removeEntity(entity.id);
    }
  }

  async onCellClick(cell: BoardCell): Promise<void> {
    if (this.interactivePlay.isActive() && this.placementMode() === 'none') {
      await this.handleInteractiveCellClick(cell);
      return;
    }

    if (this.placementMode() === 'none' && this.selectedInteractionMode() !== 'none') {
      await this.pushInteractionAction(cell);
      return;
    }

    this.boardCellClick.emit({ x: cell.x, y: cell.y });
  }
}
