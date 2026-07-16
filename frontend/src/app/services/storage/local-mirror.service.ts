import { Injectable } from '@angular/core';

export type MirroredCollection = 'builds' | 'timelines';

/**
 * Miroir local des donnees cloud, permettant la lecture hors-ligne.
 *
 * Les cles sont cloisonnees par utilisateur ET distinctes des cles d'invite
 * (wakfu_builds / wakfu_timelines) : sans ce cloisonnement, le cache d'un compte
 * ecraserait les donnees locales de l'invite, ce que la promesse "import non
 * destructif" interdit.
 */
@Injectable({ providedIn: 'root' })
export class LocalMirror {
  private key(userId: string, collection: MirroredCollection): string {
    return `wakfu_cache_${userId}_${collection}`;
  }

  read<T>(userId: string, collection: MirroredCollection): T[] | null {
    try {
      const raw = localStorage.getItem(this.key(userId, collection));
      return raw ? (JSON.parse(raw) as T[]) : null;
    } catch {
      // Cache corrompu ou localStorage indisponible : on se comporte comme un cache
      // vide plutot que de casser la lecture.
      return null;
    }
  }

  write<T>(userId: string, collection: MirroredCollection, data: T[]): void {
    try {
      localStorage.setItem(this.key(userId, collection), JSON.stringify(data));
    } catch {
      /* quota depasse : le cache est un confort, pas une garantie */
    }
  }

  clear(userId: string): void {
    try {
      localStorage.removeItem(this.key(userId, 'builds'));
      localStorage.removeItem(this.key(userId, 'timelines'));
    } catch {
      /* localStorage indisponible */
    }
  }
}
