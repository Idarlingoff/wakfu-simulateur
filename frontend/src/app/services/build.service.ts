import { Injectable, signal, computed } from '@angular/core';
import { Build, BuildStats, SpellBar, PassiveBar, SublimationBar, SpellReference } from '../models/build.model';
import { WakfuApiService } from './wakfu-api.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BuildService {
  // State Signals
  private readonly builds = signal<Build[]>([]);
  private readonly selectedBuildIdA = signal<string | null>(null);
  private readonly selectedBuildIdB = signal<string | null>(null);
  private readonly isLoading = signal<boolean>(false);
  private readonly loadError = signal<string | null>(null);

  // Computed Selectors
  public allBuilds = computed(() => this.builds());
  public loading = computed(() => this.isLoading());
  public error = computed(() => this.loadError());

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

  constructor(private readonly api: WakfuApiService) {
    this.loadBuilds();
  }

  /**
   * Charge les builds depuis le localStorage (via WakfuApiService)
   */
  async loadBuilds(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);
    try {
      const builds = await firstValueFrom(this.api.getAllBuilds());
      this.builds.set(builds);
    } catch (e: any) {
      this.loadError.set(e.message);
    } finally {
      this.isLoading.set(false);
    }
  }

  // ============ CRUD Operations ============

  public async createBuild(build: Build): Promise<Build | null> {
    const created = await firstValueFrom(this.api.createBuild(build));
    this.builds.update(bs => [...bs, created]);
    return created;
  }

  public async updateBuild(buildId: string, updates: Partial<Build>): Promise<boolean> {
    const build = this.builds().find(b => b.id === buildId);
    if (!build) return false;
    const updated = { ...build, ...updates, updatedAt: new Date() } as Build;
    await firstValueFrom(this.api.updateBuild(buildId, updated));
    this.builds.update(bs => bs.map(b => b.id === buildId ? updated : b));
    return true;
  }

  public async deleteBuild(buildId: string): Promise<boolean> {
    await firstValueFrom(this.api.deleteBuild(buildId));
    this.builds.update(bs => bs.filter(b => b.id !== buildId));
    if (this.selectedBuildIdA() === buildId) this.selectedBuildIdA.set(null);
    if (this.selectedBuildIdB() === buildId) this.selectedBuildIdB.set(null);
    return true;
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

  public addSpellToBar(buildId: string, spellReference: SpellReference, slotIndex: number): void {
    const build = this.getBuildById(buildId);
    if (build && slotIndex >= 0 && slotIndex < 12) {
      const newSpells = [...build.spellBar.spells];
      newSpells[slotIndex] = spellReference;
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
    for (const subli of build.sublimationBar.sublimations) {
      if (subli) {
        for (const [key, value] of Object.entries(subli.stats)) {
          stats[key] = (stats[key] as number || 0) + value;
        }
      }
    }
    return stats;
  }

  // ============ Export/Import ============

  public exportBuild(buildId: string): string {
    const build = this.getBuildById(buildId);
    if (!build) throw new Error('Build not found');
    return JSON.stringify(build, null, 2);
  }

  public async importBuild(jsonString: string): Promise<Build | null> {
    try {
      const build = JSON.parse(jsonString) as Build;
      return await this.createBuild(build);
    } catch (e) {
      console.error('Invalid JSON format:', e);
      return null;
    }
  }
}

