/**
 * Build Service - IMPLEMENTATION
 * Gère l'état des builds avec logique métier
 */

import { Injectable, signal, computed, effect } from '@angular/core';
import { Build, Spell, BuildStats, SpellBar, PassiveBar, SublimationBar } from '../models/build.model';

@Injectable({
  providedIn: 'root'
})
export class BuildService {
  // State Signals
  private builds = signal<Build[]>([]);
  private selectedBuildIdA = signal<string | null>(null);
  private selectedBuildIdB = signal<string | null>(null);

  // Computed Selectors
  public allBuilds = computed(() => this.builds());

  public selectedBuildA = computed(() => {
    const id = this.selectedBuildIdA();
    return id ? this.builds().find(b => b.id === id) || null : null;
  });

  public selectedBuildB = computed(() => {
    const id = this.selectedBuildIdB();
    return id ? this.builds().find(b => b.id === id) || null : null;
  });

  public activeComparison = computed(() => {
    const a = this.selectedBuildA();
    const b = this.selectedBuildB();
    return (a && b) ? { buildA: a, buildB: b } : null;
  });

  constructor() {
    this.initializeMockData();
    // Auto-persist on changes
    effect(() => {
      this.saveToPersistence();
    });
  }

  /**
   * Initialize with mock data for testing
   */
  private initializeMockData(): void {
    const mockBuilds: Build[] = [
      {
        id: 'build_1',
        name: 'Xélor - Rouage Cycle',
        classId: 'xelor',
        characterLevel: 185,
        spellBar: {
          spells: [
            { id: 'vol_du_temps', name: 'Vol du Temps', classId: 'xelor', level: 1, range: 3, pa: 2, pw: 0, description: 'Inflige dégâts' },
            { id: 'rouage', name: 'Rouage', classId: 'xelor', level: 1, range: 2, pa: 2, pw: 1, description: 'Place un rouage' },
            { id: 'distorsion', name: 'Distorsion', classId: 'xelor', level: 6, range: 1, pa: 2, pw: 1, description: 'Transpose et augmente dégâts' },
            { id: 'cadran', name: 'Cadran', classId: 'xelor', level: 1, range: 2, pa: 2, pw: 0, description: 'Place le cadran' },
            null, null, null, null, null, null, null, null
          ]
        },
        passiveBar: {
          passives: [
            { id: 'p1', name: 'Maître du Cadran', classId: 'xelor', unlockedAtLevel: 1, description: 'Passive 1' },
            { id: 'p2', name: 'Cours du temps', classId: 'xelor', unlockedAtLevel: 1, description: 'Passive 2' },
            null, null, null, null
          ]
        },
        sublimationBar: {
          sublimations: [
            // 10 classic
            { id: 's1', name: 'Rune Classique 1', rarity: 'classic', stats: { dommageInflict: 50 }, description: 'Subli 1' },
            { id: 's2', name: 'Rune Classique 2', rarity: 'classic', stats: { dommageInflict: 50 }, description: 'Subli 2' },
            { id: 's3', name: 'Rune Classique 3', rarity: 'classic', stats: { masteryPrimary: 10 }, description: 'Subli 3' },
            { id: 's4', name: 'Rune Classique 4', rarity: 'classic', stats: { masteryPrimary: 10 }, description: 'Subli 4' },
            { id: 's5', name: 'Rune Classique 5', rarity: 'classic', stats: { ap: 1 }, description: 'Subli 5' },
            null,
            null,
            null,
            null,
            null,
            // 1 epic
            { id: 's_epic', name: 'Rune Épique', rarity: 'epic', stats: { dommageInflict: 100, masteryPrimary: 20 }, description: 'Epic Subli' },
            // 1 relic
            { id: 's_relic', name: 'Rune Relique', rarity: 'relic', stats: { dommageInflict: 200, critRate: 10 }, description: 'Relic Subli' }
          ]
        },
        stats: {
          level: 185,
          masteryPrimary: 300,        // Feu
          masterySecondary: 150,      // Eau
          backMastery: 100,           // Dos
          dommageInflict: 150,        // Dégâts infligés
          critRate: 25,               // Taux de critique (%)
          critMastery: 50,            // Maîtrise critique
          resistance: 10,             // Résistance
          ap: 12,                     // Action Points
          mp: 3,                      // Movement Points
          wp: 0,                      // Power Points
          range: 3                    // Portée
        },
        description: 'Build de test Xélor - Rouage/Distorsion',
        createdAt: new Date()
      }
    ];
    this.builds.set(mockBuilds);
  }

  /**
   * Persist builds to localStorage
   */
  private saveToPersistence(): void {
    try {
      localStorage.setItem('wakfu_builds', JSON.stringify(this.builds()));
    } catch (e) {
      console.warn('Failed to save builds to localStorage', e);
    }
  }

  /**
   * Load builds from localStorage
   */
  private loadFromPersistence(): void {
    try {
      const stored = localStorage.getItem('wakfu_builds');
      if (stored) {
        const parsed = JSON.parse(stored) as Build[];
        this.builds.set(parsed);
      }
    } catch (e) {
      console.warn('Failed to load builds from localStorage', e);
    }
  }

  // ============ CRUD Operations ============

  public createBuild(build: Build): Build {
    const newBuild: Build = {
      ...build,
      id: build.id || `build_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.builds.update(builds => [...builds, newBuild]);
    return newBuild;
  }

  public updateBuild(buildId: string, updates: Partial<Build>): void {
    this.builds.update(builds =>
      builds.map(b =>
        b.id === buildId
          ? { ...b, ...updates, updatedAt: new Date() }
          : b
      )
    );
  }

  public deleteBuild(buildId: string): void {
    this.builds.update(builds => builds.filter(b => b.id !== buildId));
    // Clear selection if deleted
    if (this.selectedBuildIdA() === buildId) this.selectedBuildIdA.set(null);
    if (this.selectedBuildIdB() === buildId) this.selectedBuildIdB.set(null);
  }

  public getBuildById(buildId: string): Build | undefined {
    return this.builds().find(b => b.id === buildId);
  }

  // ============ Selection & Comparison ============

  public selectBuildA(build: Build | null): void {
    this.selectedBuildIdA.set(build?.id || null);
  }

  public selectBuildB(build: Build | null): void {
    this.selectedBuildIdB.set(build?.id || null);
  }

  public swapBuildSelection(): void {
    const tempId = this.selectedBuildIdA();
    this.selectedBuildIdA.set(this.selectedBuildIdB());
    this.selectedBuildIdB.set(tempId);
  }

  // ============ Bar Updates ============

  public updateSpellBar(buildId: string, spellBar: SpellBar): void {
    this.updateBuild(buildId, { spellBar });
  }

  public updatePassiveBar(buildId: string, passiveBar: PassiveBar): void {
    this.updateBuild(buildId, { passiveBar });
  }

  public updateSublimationBar(buildId: string, sublimationBar: SublimationBar): void {
    this.updateBuild(buildId, { sublimationBar });
  }

  public addSpellToBar(buildId: string, spell: Spell, slotIndex: number): void {
    const build = this.getBuildById(buildId);
    if (build && slotIndex >= 0 && slotIndex < 12) {
      const newSpells = [...build.spellBar.spells];
      newSpells[slotIndex] = spell;
      this.updateSpellBar(buildId, { spells: newSpells });
    }
  }

  public removeSpellFromBar(buildId: string, slotIndex: number): void {
    const build = this.getBuildById(buildId);
    if (build && slotIndex >= 0 && slotIndex < 12) {
      const newSpells = [...build.spellBar.spells];
      newSpells[slotIndex] = null;
      this.updateSpellBar(buildId, { spells: newSpells });
    }
  }

  // ============ Stats Calculation ============

  public calculateTotalStats(build: Build): BuildStats {
    let stats: BuildStats = { ...build.stats };

    // Add subli bonuses
    build.sublimationBar.sublimations.forEach(subli => {
      if (subli) {
        Object.entries(subli.stats).forEach(([key, value]) => {
          stats[key] = (stats[key] as number || 0) + value;
        });
      }
    });

    return stats;
  }

  // ============ Export/Import ============

  public exportBuild(buildId: string): string {
    const build = this.getBuildById(buildId);
    if (!build) throw new Error('Build not found');
    return JSON.stringify(build, null, 2);
  }

  public importBuild(jsonString: string): Build {
    try {
      const build = JSON.parse(jsonString) as Build;
      return this.createBuild(build);
    } catch (e) {
      throw new Error('Invalid JSON format');
    }
  }
}

