import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BuildService } from '../services/build.service';
import { Build, BuildStats, SpellReference, PassiveReference, Sublimation } from '../models/build.model';
import { SpellSelectorComponent } from '../components/spell-selector.component';
import { PassiveSelectorComponent } from '../components/passive-selector.component';
import { SublimationSelectorComponent } from '../components/sublimation-selector.component';
import { UiButtonComponent } from '../ui/ui-button.component';
import { removeInnateSpellsFromSelection } from '../utils/innate-spells.utils';
import { newEntityId } from '../utils/entity-id.utils';
import { DeckCodeService } from '../services/deck-code.service';
import { DeckCodeFormatError, DeckCodeImportResult, DeckCodeReport, describeImportResult } from '../utils/deck-code.utils';
import { prunePassivesForLevel } from '../utils/passive-slots.utils';

interface FormBuild {
  name: string;
  classId: string;
  characterLevel: number;
  description: string;
  stats: BuildStats;
  spells: (SpellReference | null)[];
  passives: (PassiveReference | null)[];
  sublimations: (Sublimation | null)[];
}

/**
 * Classes jouables en tant que BUILD, volontairement limitees au Xelor.
 *
 * Seul le Xelor a des sorts et des passifs en base : proposer les autres classes ici
 * menait a un build vide, sans rien pour l'expliquer. Cette restriction ne vaut QUE pour
 * le personnage du build ; les alliés et ennemis gardent la liste complete des classes
 * dans `player-form.component.ts`, ou seule la classe affichee compte.
 */
const CLASS_OPTIONS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'XEL', name: 'Xélor' },
];
const LEVELS: ReadonlyArray<number> = [20, 35, 50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 245];

function emptyForm(): FormBuild {
  return {
    name: '', classId: '', characterLevel: 200, description: '',
    stats: {
      level: 200, masteryFire: 0, masteryWater: 0, masteryEarth: 0, masteryAir: 0,
      masterySecondary: 0, backMastery: 0, masteryMelee: 0, masteryDistance: 0, masteryHealing: 0,
      dommageInflict: 0, critRate: 0, critMastery: 0,
      resistance: 0, ap: 12, mp: 3, wp: 0, range: 3,
    },
    spells: new Array(12).fill(null),
    passives: new Array(6).fill(null),
    sublimations: new Array(12).fill(null),
  };
}

@Component({
  selector: 'app-build-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, SpellSelectorComponent, PassiveSelectorComponent, SublimationSelectorComponent, UiButtonComponent],
  template: `
    <div class="editor">
      <header class="editor-head">
        <h1>{{ editingId ? 'Modifier le build' : 'Nouveau build' }}</h1>
      </header>

      <div class="editor-grid">
        <div class="editor-form">
          <section class="card">
            <h2>Identité</h2>
            <div class="field">
              <label>Nom *</label>
              <input type="text" [(ngModel)]="form.name" name="name" placeholder="ex: Xélor — Rouage Cycle" />
            </div>
            <div class="field">
              <label>Classe *</label>
              <select [(ngModel)]="form.classId" name="classId">
                <option value="">— Sélectionner —</option>
                @for (c of classOptions; track c.id) { <option [value]="c.id">{{ c.name }}</option> }
              </select>
            </div>
            <div class="field">
              <label>Niveau</label>
              <select [ngModel]="form.characterLevel" (ngModelChange)="onLevelChange($event)" name="level">
                @for (l of levels; track l) { <option [ngValue]="l">{{ l }}</option> }
              </select>
            </div>
            <div class="field">
              <label>Description</label>
              <textarea [(ngModel)]="form.description" name="description" rows="2" placeholder="Notes sur le build…"></textarea>
            </div>
          </section>

          <section class="card">
            <h2>Code deck</h2>
            <p class="deck-help">
              Colle un code deck du jeu pour remplir sorts et passifs d'un coup, ou copie
              le tien pour l'exporter.
            </p>
            @if (!form.classId) {
              <p class="deck-help deck-help-warn">Sélectionne d'abord une classe.</p>
            }
            <div class="deck-row">
              <input
                type="text"
                class="deck-input"
                [(ngModel)]="deckCodeInput"
                name="deckCode"
                aria-label="Code deck"
                [disabled]="!form.classId"
                placeholder="2839-5344-767-771-765-…"
              />
              <button ui-button variant="primary" [disabled]="!form.classId" (click)="importDeckCode()">Importer</button>
              <button ui-button variant="ghost" [disabled]="!form.classId" (click)="copyDeckCode()">
                {{ deckCodeCopied ? 'Copié ✓' : 'Copier' }}
              </button>
            </div>
            @if (deckCodeFallback) {
              <input type="text" class="deck-input deck-fallback" [value]="deckCodeFallback" readonly />
            }
            @if (deckCodeReport) {
              <p class="deck-report" [class]="'deck-report-' + deckCodeReport.tone">{{ deckCodeReport.message }}</p>
            }
          </section>

          <section class="card">
            <h2>Sorts</h2>
            <app-spell-selector
              [classId]="form.classId"
              [selectedSpells]="form.spells"
              (spellsChange)="onSpellsChange($event)"
            ></app-spell-selector>
          </section>

          <section class="card">
            <h2>Passifs</h2>
            <app-passive-selector
              [classId]="form.classId"
              [characterLevel]="form.characterLevel"
              [selectedPassives]="form.passives"
              (passivesChange)="onPassivesChange($event)"
            ></app-passive-selector>
          </section>

          <section class="card">
            <h2>Sublimations</h2>
            <app-sublimation-selector
              [selectedSublimations]="form.sublimations"
              (sublimationsChange)="onSublimationsChange($event)"
            ></app-sublimation-selector>
          </section>

          <section class="card">
            <h2>Stats</h2>
            <h3>Maîtrises élémentaires</h3>
            <div class="stat-grid">
              <div class="field"><label><img class="stat-icon" src="assets/images/characteristics/DMG_FIRE_PERCENT.png" alt="Feu" />Feu</label><input type="number" [(ngModel)]="form.stats.masteryFire" name="mFire" /></div>
              <div class="field"><label><img class="stat-icon" src="assets/images/characteristics/DMG_WATER_PERCENT.png" alt="Eau" />Eau</label><input type="number" [(ngModel)]="form.stats.masteryWater" name="mWater" /></div>
              <div class="field"><label><img class="stat-icon" src="assets/images/characteristics/DMG_EARTH_PERCENT.png" alt="Terre" />Terre</label><input type="number" [(ngModel)]="form.stats.masteryEarth" name="mEarth" /></div>
              <div class="field"><label><img class="stat-icon" src="assets/images/characteristics/DMG_AIR_PERCENT.png" alt="Air" />Air</label><input type="number" [(ngModel)]="form.stats.masteryAir" name="mAir" /></div>
            </div>
            <h3>Offensif</h3>
            <div class="stat-grid">
              <div class="field"><label><img class="stat-icon" src="assets/images/characteristics/FINAL_DMG_IN_PERCENT.png" alt="Dégâts infligés" />Dégâts infligés</label><input type="number" [(ngModel)]="form.stats.dommageInflict" name="dmg" /></div>
              <div class="field"><label><img class="stat-icon" src="assets/images/characteristics/FEROCITY.png" alt="Taux critique" />Taux critique (%)</label><input type="number" [(ngModel)]="form.stats.critRate" name="crit" /></div>
              <div class="field"><label><img class="stat-icon" src="assets/images/characteristics/CRITICAL_BONUS.png" alt="Maîtrise critique" />Maîtrise critique</label><input type="number" [(ngModel)]="form.stats.critMastery" name="critM" /></div>
              <div class="field"><label>Maîtrise secondaire</label><input type="number" [(ngModel)]="form.stats.masterySecondary" name="mSec" /></div>
              <div class="field"><label>Maîtrise mêlée</label><input type="number" [(ngModel)]="form.stats.masteryMelee" name="mMelee" /></div>
              <div class="field"><label>Maîtrise distance</label><input type="number" [(ngModel)]="form.stats.masteryDistance" name="mDist" /></div>
              <div class="field"><label>Maîtrise soin</label><input type="number" [(ngModel)]="form.stats.masteryHealing" name="mHeal" /></div>
              <div class="field"><label><img class="stat-icon" src="assets/images/characteristics/BACKSTAB_BONUS.png" alt="Maîtrise dos" />Maîtrise dos</label><input type="number" [(ngModel)]="form.stats.backMastery" name="mBack" /></div>
            </div>
            <h3>Défense</h3>
            <div class="stat-grid">
              <div class="field"><label>Résistance</label><input type="number" [(ngModel)]="form.stats.resistance" name="res" /></div>
            </div>
            <h3>Ressources & portée</h3>
            <div class="stat-grid">
              <div class="field"><label><img class="stat-icon" src="assets/images/characteristics/AP.png" alt="PA" />PA</label><input type="number" [(ngModel)]="form.stats.ap" name="ap" /></div>
              <div class="field"><label><img class="stat-icon" src="assets/images/characteristics/MP.png" alt="PM" />PM</label><input type="number" [(ngModel)]="form.stats.mp" name="mp" /></div>
              <div class="field"><label><img class="stat-icon" src="assets/images/characteristics/WP.png" alt="PW" />PW</label><input type="number" [(ngModel)]="form.stats.wp" name="wp" /></div>
              <div class="field"><label><img class="stat-icon" src="assets/images/characteristics/RANGE.png" alt="Portée" />Portée</label><input type="number" [(ngModel)]="form.stats.range" name="range" /></div>
            </div>
          </section>
        </div>

        <aside class="editor-summary">
          <div class="summary-card">
            <h2>Résumé</h2>
            <div class="sum-name">{{ form.name || 'Sans nom' }}</div>
            <div class="sum-meta">{{ classLabel() }} · niveau {{ form.characterLevel }}</div>
            <div class="sum-res">
              <span>{{ form.stats.ap }} PA</span>
              <span>{{ form.stats.mp }} PM</span>
              <span>{{ form.stats.wp }} PW</span>
            </div>
            <div class="sum-mast">
              <span>Feu {{ form.stats.masteryFire }}</span>
              <span>Eau {{ form.stats.masteryWater }}</span>
              <span>Terre {{ form.stats.masteryEarth }}</span>
              <span>Air {{ form.stats.masteryAir }}</span>
            </div>
            <div class="sum-actions">
              <button ui-button variant="primary" (click)="save()">Enregistrer</button>
              <button ui-button variant="ghost" (click)="cancel()">Annuler</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .editor { max-width: 1200px; margin: 0 auto; padding: 20px; color: var(--app-text); }
    .editor-head h1 { margin: 0 0 16px; }
    .editor-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 18px; align-items: start; }
    .editor-form { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .card { background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 12px; padding: 16px; }
    .card h2 { margin: 0 0 12px; font-size: 16px; }
    .card h3 { margin: 14px 0 8px; font-size: 13px; color: var(--app-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    .field label { font-size: 13px; color: var(--app-text-muted); }
    .stat-icon { width: 18px; height: 18px; object-fit: contain; vertical-align: -4px; margin-right: 6px; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
    .stat-grid .field { margin-bottom: 0; }
    .editor-summary { position: sticky; top: 16px; }
    .summary-card { background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .summary-card h2 { margin: 0; font-size: 14px; color: var(--app-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .sum-name { font-weight: 600; font-size: 18px; }
    .sum-meta { color: var(--app-text-muted); font-size: 13px; }
    .sum-res { display: flex; gap: 12px; font-size: 14px; margin-top: 4px; }
    .sum-mast { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--app-text-muted); }
    .sum-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    @media (max-width: 860px) { .editor-grid { grid-template-columns: 1fr; } .editor-summary { position: static; } }
    .deck-help { margin: 0 0 10px; font-size: 13px; color: var(--app-text-muted); }
    .deck-help-warn { color: var(--app-warning); }
    .deck-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .deck-input { flex: 1 1 260px; min-width: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .deck-fallback { margin-top: 8px; width: 100%; }
    .deck-report { margin: 10px 0 0; font-size: 13px; }
    .deck-report-ok { color: var(--app-success); }
    .deck-report-warn { color: var(--app-warning); }
    .deck-report-error { color: var(--app-danger); }
  `],
})
export class BuildEditorComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly buildService = inject(BuildService);
  private readonly deckCodeService = inject(DeckCodeService);

  protected readonly classOptions = CLASS_OPTIONS;
  protected readonly levels = LEVELS;
  editingId: string | null = null;
  form: FormBuild = emptyForm();
  deckCodeInput = '';
  deckCodeReport: DeckCodeReport | null = null;
  deckCodeCopied = false;
  /** Code affiche en lecture seule quand l'API presse-papier est indisponible. */
  deckCodeFallback = '';
  /** Minuterie du badge « Copié ✓ », a nettoyer pour ne pas ecrire dans une vue detruite. */
  private deckCodeCopiedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const build = this.buildService.getBuildById(id);
      if (!build) { this.router.navigate(['/builds']); return; }
      this.editingId = id;
      this.form = {
        name: build.name,
        classId: build.classId,
        characterLevel: build.characterLevel,
        description: build.description || '',
        stats: { ...build.stats },
        spells: removeInnateSpellsFromSelection(build.classId, [...build.spellBar.spells]),
        passives: [...build.passiveBar.passives],
        sublimations: [...build.sublimationBar.sublimations],
      };
    }
  }

  ngOnDestroy(): void {
    this.clearDeckCodeCopiedTimer();
  }

  private clearDeckCodeCopiedTimer(): void {
    if (this.deckCodeCopiedTimer !== null) {
      clearTimeout(this.deckCodeCopiedTimer);
      this.deckCodeCopiedTimer = null;
    }
  }

  classLabel(): string {
    return this.classOptions.find(c => c.id === this.form.classId)?.name ?? '—';
  }

  /**
   * Le niveau conditionne les emplacements de passifs deverrouilles : on vide ici ceux qui
   * viennent de se verrouiller, avant de propager le niveau au selecteur.
   *
   * Cette regle appartient au parent, qui possede `form.passives` : la faire appliquer par
   * le selecteur l'obligerait a emettre depuis son `ngOnChanges`, en pleine detection de
   * changement, et le parent modifierait alors un binding deja verifie (NG0100).
   */
  onLevelChange(level: number): void {
    this.form.characterLevel = level;
    this.form.passives = prunePassivesForLevel(this.form.passives, level);
  }

  onSpellsChange(spells: (SpellReference | null)[]): void { this.form.spells = spells; }
  onPassivesChange(passives: (PassiveReference | null)[]): void { this.form.passives = passives; }
  onSublimationsChange(subs: (Sublimation | null)[]): void { this.form.sublimations = subs; }

  /**
   * Applique un code deck : remplacement TOTAL des sorts et passifs, comme en jeu.
   *
   * Un code invalide ou dont rien n'est reconnu ne touche a rien : vider la barre entiere
   * sur une faute de frappe serait destructeur.
   */
  async importDeckCode(): Promise<void> {
    if (!this.form.classId) {
      return;
    }
    const code = this.deckCodeInput.trim();
    if (!code) {
      this.deckCodeReport = { tone: 'error', message: 'Colle un code deck avant d’importer.' };
      return;
    }

    let result: DeckCodeImportResult;
    try {
      result = await this.deckCodeService.decode(code, this.form.classId);
    } catch (error) {
      this.deckCodeReport = {
        tone: 'error',
        message: error instanceof DeckCodeFormatError
          ? error.message
          : 'Impossible de charger les données de la classe. Réessaie.',
      };
      return;
    }

    const placed = result.spells.filter(s => s !== null).length + result.passives.filter(p => p !== null).length;
    if (placed === 0) {
      this.deckCodeReport = {
        tone: 'error',
        message: `Aucun sort ni passif reconnu pour ${this.classLabel()}. Vérifie que le code correspond bien à cette classe.`,
      };
      return;
    }

    // Le code deck porte toujours 6 passifs, mais un personnage de bas niveau n'a pas
    // encore debloque tous les emplacements. Sans ce filtre, un passif resterait dans un
    // emplacement que le selecteur n'affiche pas, et save() le persisterait quand meme.
    const passives = prunePassivesForLevel(result.passives, this.form.characterLevel);
    const lockedOut = result.passives.filter((p, i) => p !== null && passives[i] === null).length;

    this.onSpellsChange(result.spells);
    this.onPassivesChange(passives);

    const report = describeImportResult(result);
    this.deckCodeReport = lockedOut === 0
      ? report
      : {
          tone: report.tone === 'ok' ? 'warn' : report.tone,
          message: `${report.message} — ${lockedOut} passif(s) ignoré(s) : emplacement verrouillé à ce niveau`,
        };
  }

  async copyDeckCode(): Promise<void> {
    if (!this.form.classId) {
      return;
    }
    const code = await this.deckCodeService.encode(this.form.spells, this.form.passives, this.form.classId);

    // navigator.clipboard est absent hors contexte securise : on ne peut pas se contenter
    // d'un try/catch, un `await undefined` reussirait silencieusement.
    const clipboard = navigator.clipboard;
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(code);
        this.deckCodeFallback = '';
        // Sinon le message « sélectionne le code ci-dessous » survit au champ qu'il designe.
        this.deckCodeReport = null;
        this.deckCodeCopied = true;
        // Une seconde copie rapide ne doit pas laisser la minuterie precedente eteindre
        // le badge en avance.
        this.clearDeckCodeCopiedTimer();
        this.deckCodeCopiedTimer = setTimeout(() => {
          this.deckCodeCopied = false;
          this.deckCodeCopiedTimer = null;
        }, 2000);
        return;
      } catch {
        // Permission refusee : on retombe sur le champ manuel.
      }
    }

    this.deckCodeFallback = code;
    this.deckCodeCopied = false;
    this.deckCodeReport = {
      tone: 'warn',
      message: 'Copie automatique indisponible : sélectionne le code ci-dessous et copie-le manuellement.',
    };
  }

  save(): void {
    if (!this.form.name || !this.form.classId) {
      alert('Veuillez remplir les champs obligatoires (nom, classe).');
      return;
    }
    const sanitizedSpells = removeInnateSpellsFromSelection(this.form.classId, this.form.spells);
    if (this.editingId) {
      this.buildService.updateBuild(this.editingId, {
        name: this.form.name,
        classId: this.form.classId,
        characterLevel: this.form.characterLevel,
        description: this.form.description,
        spellBar: { spells: sanitizedSpells },
        passiveBar: { passives: this.form.passives },
        sublimationBar: { sublimations: this.form.sublimations },
        stats: this.form.stats,
      });
    } else {
      const newBuild: Build = {
        id: newEntityId(),
        name: this.form.name,
        classId: this.form.classId,
        characterLevel: this.form.characterLevel,
        description: this.form.description,
        spellBar: { spells: sanitizedSpells },
        passiveBar: { passives: this.form.passives },
        sublimationBar: { sublimations: this.form.sublimations },
        stats: this.form.stats,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.buildService.createBuild(newBuild);
    }
    this.location.back();
  }

  cancel(): void {
    this.location.back();
  }
}
