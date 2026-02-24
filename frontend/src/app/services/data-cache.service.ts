import { Injectable, signal } from '@angular/core';
import { Spell } from '../models/spell.model';
import { Passive } from '../models/passive.model';
import { WakfuApiService } from './wakfu-api.service';
import { canonicalizeInnateSpellId } from '../utils/innate-spells.utils';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Service de cache pour les données de référence (sorts, passis)
 * Évite de recharger les données à chaque fois depuis l'API
 */
@Injectable({
  providedIn: 'root'
})
export class DataCacheService {
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private spellsCache = new Map<string, CacheEntry<Spell[]>>();
  private passivesCache = new Map<string, CacheEntry<Passive[]>>();

  // Signals pour l'état de chargement global
  private loadingSpells = signal(false);
  private loadingPassives = signal(false);

  constructor(private wakfuApi: WakfuApiService) {}

  /**
   * Récupère les sorts avec cache
   * @param classId ID de la classe (optionnel)
   */
  async getSpells(classId?: string): Promise<Spell[]> {
    const cacheKey = classId || 'all';
    console.log('[DataCache] getSpells - classId:', classId, '- cacheKey:', cacheKey);

    // Vérifier le cache
    const cached = this.spellsCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`Sorts récupérés depuis le cache (${cacheKey}) - ${cached.data.length} sort(s)`);
      return cached.data;
    }

    // Charger depuis l'API
    console.log(`Chargement des sorts depuis l'API (${cacheKey})`);
    this.loadingSpells.set(true);

    try {
      const spells = await new Promise<Spell[]>((resolve, reject) => {
        this.wakfuApi.getAllSpells(classId).subscribe({
          next: (data) => resolve(data),
          error: (err) => reject(err)
        });
      });

      console.log(`Réponse API: ${spells.length} sort(s) reçu(s) pour (${cacheKey})`);

      // Ne mettre en cache que si des données sont retournées
      // Évite de cacher un tableau vide en cas d'erreur backend
      if (spells && spells.length > 0) {
        this.spellsCache.set(cacheKey, {
          data: spells,
          timestamp: Date.now()
        });
        console.log(`${spells.length} sort(s) mis en cache pour (${cacheKey})`);
      } else {
        console.warn(`Aucun sort retourné par l'API pour (${cacheKey}) - cache non mis à jour`);
      }

      return spells;
    } catch (error) {
      console.error(`Erreur lors du chargement des sorts pour (${cacheKey}):`, error);
      throw error;
    } finally {
      this.loadingSpells.set(false);
    }
  }

  /**
   * Récupère un sort spécifique par ID
   * @param spellId ID du sort
   */
  async getSpellById(spellId: string): Promise<Spell | undefined> {
    const canonicalSpellId = canonicalizeInnateSpellId(spellId);

    // D'abord chercher dans tous les caches
    for (const entry of this.spellsCache.values()) {
      const spell = entry.data.find(s => s.id === canonicalSpellId || s.id === spellId);
      if (spell) {
        return spell;
      }
    }

    // Si pas trouvé, charger depuis l'API
    try {
      return await new Promise<Spell>((resolve, reject) => {
        this.wakfuApi.getSpellById(canonicalSpellId).subscribe({
          next: (data) => resolve(data),
          error: (err) => reject(err)
        });
      });
    } catch (error) {
      console.error(`Erreur lors du chargement du sort ${spellId}:`, error);
      return undefined;
    }
  }

  /**
   * Récupère les passifs avec cache
   * @param classId ID de la classe (optionnel)
   */
  async getPassives(classId?: string): Promise<Passive[]> {
    const cacheKey = classId || 'all';
    console.log('[DataCache] getPassives - classId:', classId, '- cacheKey:', cacheKey);

    // Vérifier le cache
    const cached = this.passivesCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`Passifs récupérés depuis le cache (${cacheKey}) - ${cached.data.length} passif(s)`);
      return cached.data;
    }

    // Charger depuis l'API
    console.log(`Chargement des passifs depuis l'API (${cacheKey})`);
    this.loadingPassives.set(true);

    try {
      const passives = await new Promise<Passive[]>((resolve, reject) => {
        this.wakfuApi.getAllPassives(classId).subscribe({
          next: (data) => resolve(data),
          error: (err) => reject(err)
        });
      });

      console.log(`Réponse API: ${passives.length} passif(s) reçu(s) pour (${cacheKey})`);

      // Ne mettre en cache que si des données sont retournées
      // Évite de cacher un tableau vide en cas d'erreur backend
      if (passives && passives.length > 0) {
        this.passivesCache.set(cacheKey, {
          data: passives,
          timestamp: Date.now()
        });
        console.log(`${passives.length} passif(s) mis en cache pour (${cacheKey})`);
      } else {
        console.warn(`Aucun passif retourné par l'API pour (${cacheKey}) - cache non mis à jour`);
      }

      return passives;
    } catch (error) {
      console.error(`Erreur lors du chargement des passifs pour (${cacheKey}):`, error);
      throw error;
    } finally {
      this.loadingPassives.set(false);
    }
  }

  /**
   * Récupère un passif spécifique par ID
   * @param passiveId ID du passif
   */
  async getPassiveById(passiveId: string): Promise<Passive | undefined> {
    // D'abord chercher dans tous les caches
    for (const entry of this.passivesCache.values()) {
      const passive = entry.data.find(p => p.id === passiveId);
      if (passive) {
        return passive;
      }
    }

    // Si pas trouvé, charger depuis l'API
    try {
      return await new Promise<Passive>((resolve, reject) => {
        this.wakfuApi.getPassiveById(passiveId).subscribe({
          next: (data) => resolve(data),
          error: (err) => reject(err)
        });
      });
    } catch (error) {
      console.error(`Erreur lors du chargement du passif ${passiveId}:`, error);
      return undefined;
    }
  }

  /**
   * Précharge les données pour une classe spécifique
   * Utile au démarrage de l'application ou lors de la sélection d'une classe
   * @param classId ID de la classe
   */
  async preloadClassData(classId: string): Promise<void> {
    console.log(`Préchargement des données pour la classe ${classId}`);
    await Promise.all([
      this.getSpells(classId),
      this.getPassives(classId)
    ]);
    console.log(`Données préchargées pour ${classId}`);
  }

  /**
   * Vide le cache (utile après une mise à jour des données)
   */
  clearCache(): void {
    console.log('Vidage du cache');
    this.spellsCache.clear();
    this.passivesCache.clear();
  }

  /**
   * Vide le cache des sorts
   */
  clearSpellsCache(): void {
    console.log('Vidage du cache des sorts');
    this.spellsCache.clear();
  }

  /**
   * Vide le cache des passifs
   */
  clearPassivesCache(): void {
    console.log('Vidage du cache des passifs');
    this.passivesCache.clear();
  }

  /**
   * Vérifie si une entrée de cache est encore valide
   */
  private isCacheValid(timestamp: number): boolean {
    return (Date.now() - timestamp) < this.CACHE_DURATION;
  }

  /**
   * Retourne l'état de chargement des sorts
   */
  isLoadingSpells(): boolean {
    return this.loadingSpells();
  }

  /**
   * Retourne l'état de chargement des passifs
   */
  isLoadingPassives(): boolean {
    return this.loadingPassives();
  }

  /**
   * Retourne des statistiques sur le cache
   */
  getCacheStats() {
    return {
      spells: {
        keys: Array.from(this.spellsCache.keys()),
        count: this.spellsCache.size,
        totalItems: Array.from(this.spellsCache.values()).reduce((sum, entry) => sum + entry.data.length, 0)
      },
      passives: {
        keys: Array.from(this.passivesCache.keys()),
        count: this.passivesCache.size,
        totalItems: Array.from(this.passivesCache.values()).reduce((sum, entry) => sum + entry.data.length, 0)
      }
    };
  }
}
