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
    // Charger depuis le backend au démarrage
    // Note: Appel async dans le constructeur - à améliorer si nécessaire
    this.loadFromBackend();
  }

  /**
   * Charger les builds depuis le backend
   */
  async loadFromBackend(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);

    // Charger d'abord depuis localStorage
    this.loadFromPersistence();

    try {
      const backendBuilds = await firstValueFrom(this.api.getAllBuilds());
      this.builds.set(backendBuilds);
      this.saveToPersistence();
      console.log('✅ Builds chargés depuis le backend:', backendBuilds.length);
    } catch (error: any) {
      const errorMsg = `Erreur de chargement depuis le backend: ${error.message}`;
      this.loadError.set(errorMsg);
      console.error('❌', errorMsg);
      console.warn('⚠️ Utilisation des builds depuis localStorage');
      // Les builds de localStorage sont déjà chargés
    } finally {
      this.isLoading.set(false);
    }
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

  // ============ Helper Methods ============

  /**
   * Prépare un build pour l'envoi au backend
   * Convertit les objets Date en ISO strings
   */
  private prepareBuildForBackend(build: Build): any {
    return {
      ...build,
      createdAt: build.createdAt ? new Date(build.createdAt).toISOString() : undefined,
      updatedAt: build.updatedAt ? new Date(build.updatedAt).toISOString() : undefined
    };
  }

  /**
   * Convertit un build reçu du backend en objet Build
   */
  private parseBuildFromBackend(data: any): Build {
    return {
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined
    };
  }

  // ============ CRUD Operations ============

  public async createBuild(build: Build): Promise<Build | null> {
    // Ajouter immédiatement au state local
    this.builds.update(builds => [...builds, build]);
    this.saveToPersistence();
    console.log('✅ Build créé localement:', build.id);

    // Tenter de synchroniser avec le backend en arrière-plan
    try {
      const buildForBackend = this.prepareBuildForBackend(build);
      const created = await firstValueFrom(this.api.createBuild(buildForBackend));
      const parsedBuild = this.parseBuildFromBackend(created);

      // Remplacer par la version backend si elle diffère
      this.builds.update(builds =>
        builds.map(b => b.id === build.id ? parsedBuild : b)
      );
      this.saveToPersistence();
      console.log('✅ Build synchronisé avec le backend:', created.id);
      return parsedBuild;
    } catch (error) {
      console.warn('⚠️ Impossible de synchroniser avec le backend, build gardé en local:', error);
      return build; // Retourner le build local même si backend échoue
    }
  }

  public async updateBuild(buildId: string, updates: Partial<Build>): Promise<boolean> {
    const build = this.builds().find(b => b.id === buildId);
    if (!build) return false;

    const updated = { ...build, ...updates, updatedAt: new Date() } as Build;

    // Mettre à jour immédiatement en local
    this.builds.update(builds =>
      builds.map(b => b.id === buildId ? updated : b)
    );
    this.saveToPersistence();
    console.log('✅ Build mis à jour localement:', buildId);

    // Tenter de synchroniser avec le backend en arrière-plan
    try {
      const buildForBackend = this.prepareBuildForBackend(updated);
      const result = await firstValueFrom(this.api.updateBuild(buildId, buildForBackend));
      const parsedBuild = this.parseBuildFromBackend(result);

      this.builds.update(builds =>
        builds.map(b => b.id === buildId ? parsedBuild : b)
      );
      this.saveToPersistence();
      console.log('✅ Build synchronisé avec le backend:', buildId);
      return true;
    } catch (error) {
      console.warn('⚠️ Impossible de synchroniser avec le backend, build gardé en local:', error);
      return true; // Retourner true car la mise à jour locale a réussi
    }
  }

  public async deleteBuild(buildId: string): Promise<boolean> {
    // Supprimer immédiatement en local
    this.builds.update(builds => builds.filter(b => b.id !== buildId));

    // Clear selection if deleted
    if (this.selectedBuildIdA() === buildId) this.selectedBuildIdA.set(null);
    if (this.selectedBuildIdB() === buildId) this.selectedBuildIdB.set(null);

    this.saveToPersistence();
    console.log('✅ Build supprimé localement:', buildId);

    // Tenter de synchroniser avec le backend en arrière-plan
    try {
      await firstValueFrom(this.api.deleteBuild(buildId));
      console.log('✅ Build supprimé du backend:', buildId);
      return true;
    } catch (error) {
      console.warn('⚠️ Impossible de synchroniser avec le backend, build supprimé en local:', error);
      return true; // Retourner true car la suppression locale a réussi
    }
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

    // Add subli bonuses
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

