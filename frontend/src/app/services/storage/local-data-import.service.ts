import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Build } from '../../models/build.model';
import { Timeline } from '../../models/timeline.model';
import { AuthService } from '../auth.service';
import { LocalBuildRepository } from './local-build.repository';
import { LocalTimelineRepository } from './local-timeline.repository';
import { SupabaseBuildRepository } from './supabase-build.repository';
import { SupabaseTimelineRepository } from './supabase-timeline.repository';
import { newEntityId } from '../../utils/entity-id.utils';

export interface ImportPreview {
  builds: Build[];
  timelines: Timeline[];
}

export interface ImportSelection {
  buildIds: string[];
  timelineIds: string[];
}

/**
 * Importe les donnees locales de l'invite dans le compte.
 *
 * Non destructif : le localStorage d'invite est lu, jamais vide. Un flag par
 * utilisateur et par navigateur evite de reproposer l'import a chaque connexion.
 */
@Injectable({ providedIn: 'root' })
export class LocalDataImportService {
  private readonly localBuilds = inject(LocalBuildRepository);
  private readonly localTimelines = inject(LocalTimelineRepository);
  private readonly cloudBuilds = inject(SupabaseBuildRepository);
  private readonly cloudTimelines = inject(SupabaseTimelineRepository);
  private readonly auth = inject(AuthService);

  private readonly _pending = signal(false);

  /**
   * true si ce navigateur porte des donnees locales pas encore montees dans le compte.
   *
   * Cet etat existe parce que la proposition d'import ne peut PAS dependre du seul
   * evenement de connexion : une session restauree au chargement ne passe jamais par le
   * formulaire, et l'utilisateur n'aurait alors aucun moyen d'importer ses donnees.
   */
  readonly pending = this._pending.asReadonly();

  /** Recalcule `pending`. A appeler quand l'etat d'authentification change. */
  async refreshPending(): Promise<void> {
    if (!this.auth.userId() || this.alreadyImported()) {
      this._pending.set(false);
      return;
    }
    const { builds, timelines } = await this.preview();
    this._pending.set(builds.length > 0 || timelines.length > 0);
  }

  async preview(): Promise<ImportPreview> {
    return {
      builds: await firstValueFrom(this.localBuilds.getAll()),
      timelines: await firstValueFrom(this.localTimelines.getAll()),
    };
  }

  alreadyImported(): boolean {
    const userId = this.auth.userId();
    if (!userId) {
      return false;
    }
    try {
      return localStorage.getItem(this.flagKey(userId)) !== null;
    } catch {
      return false;
    }
  }

  async importSelected(selection: ImportSelection): Promise<void> {
    const { builds, timelines } = await this.preview();

    const chosenTimelines = timelines.filter(t => selection.timelineIds.includes(t.id));

    // Une timeline cochee embarque son build, meme decoche : sans lui, elle arriverait
    // cassee dans le compte.
    const requiredBuildIds = new Set<string>([
      ...selection.buildIds,
      ...chosenTimelines.map(t => t.buildId).filter(Boolean),
    ]);
    const chosenBuilds = builds.filter(b => requiredBuildIds.has(b.id));

    // Les ids locaux sont des chaines libres, les ids Postgres des uuid : on remappe.
    const idMap = new Map<string, string>();
    for (const build of chosenBuilds) {
      const newId = newEntityId();
      idMap.set(build.id, newId);
      await firstValueFrom(this.cloudBuilds.create({ ...build, id: newId }));
    }

    for (const timeline of chosenTimelines) {
      await firstValueFrom(this.cloudTimelines.create({
        ...timeline,
        id: newEntityId(),
        buildId: idMap.get(timeline.buildId) ?? '',
      }));
    }

    this.markImported();
  }

  private markImported(): void {
    const userId = this.auth.userId();
    if (!userId) {
      return;
    }
    try {
      localStorage.setItem(this.flagKey(userId), new Date().toISOString());
    } catch {
      /* localStorage indisponible : on repropose l'import, c'est sans danger */
    }
    this._pending.set(false);
  }

  private flagKey(userId: string): string {
    return `wakfu_imported_${userId}`;
  }
}
