import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Build } from '../../models/build.model';
import { Timeline } from '../../models/timeline.model';
import { AuthService } from '../auth.service';
import { LocalBuildRepository } from './local-build.repository';
import { LocalTimelineRepository } from './local-timeline.repository';
import { SupabaseBuildRepository } from './supabase-build.repository';
import { SupabaseTimelineRepository } from './supabase-timeline.repository';

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
      const newId = crypto.randomUUID();
      idMap.set(build.id, newId);
      await firstValueFrom(this.cloudBuilds.create({ ...build, id: newId }));
    }

    for (const timeline of chosenTimelines) {
      await firstValueFrom(this.cloudTimelines.create({
        ...timeline,
        id: crypto.randomUUID(),
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
  }

  private flagKey(userId: string): string {
    return `wakfu_imported_${userId}`;
  }
}
