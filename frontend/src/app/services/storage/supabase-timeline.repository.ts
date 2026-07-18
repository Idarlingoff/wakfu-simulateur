import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Timeline } from '../../models/timeline.model';
import { AuthService } from '../auth.service';
import { SupabaseClientService } from '../supabase-client.service';
import { TimelineRepository } from './timeline-repository';
import { LocalMirror } from './local-mirror.service';

/**
 * Stockage cloud des timelines. Memes regles que SupabaseBuildRepository :
 * lecture avec repli sur le miroir, ecriture sans repli (echec bruyant).
 *
 * `visibility` reste 'private' (defaut cote base) dans ce lot : aucune UI ne permet
 * encore de la changer et aucune politique RLS publique n'existe. C'est le lot 3 qui
 * l'exploitera.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseTimelineRepository implements TimelineRepository {
  private readonly supabase = inject(SupabaseClientService);
  private readonly auth = inject(AuthService);
  private readonly mirror = inject(LocalMirror);

  private table() {
    return this.supabase.client.from('timelines');
  }

  private requireUserId(): string {
    const id = this.auth.userId();
    if (!id) {
      throw new Error('Aucun utilisateur connecte');
    }
    return id;
  }

  private toRow(timeline: Timeline, ownerId: string) {
    return {
      id: timeline.id,
      owner_id: ownerId,
      build_id: timeline.buildId || null,
      name: timeline.name,
      // Denormalise depuis le build : indispensable au filtre par classe de la galerie.
      class_id: timeline.classId ?? null,
      data: timeline,
    };
  }

  private fromRow(row: any): Timeline {
    return {
      ...(row.data as Timeline),
      id: row.id,
      name: row.name,
      buildId: row.build_id ?? '',
      classId: row.class_id ?? undefined,
      visibility: row.visibility ?? undefined,
      shareToken: row.share_token ?? undefined,
    };
  }

  getAll(buildId?: string): Observable<Timeline[]> {
    return from(this.readAll(buildId));
  }

  private async readAll(buildId?: string): Promise<Timeline[]> {
    const userId = this.auth.userId();
    if (!userId) {
      return [];
    }
    try {
      const { data, error } = await this.table()
        .select('id, name, build_id, class_id, visibility, share_token, data')
        .eq('owner_id', userId);
      if (error) {
        throw new Error(error.message);
      }
      const timelines = (data ?? []).map((row: any) => this.fromRow(row));
      this.mirror.write(userId, 'timelines', timelines);
      return buildId ? timelines.filter(t => t.buildId === buildId) : timelines;
    } catch {
      const cached = this.mirror.read<Timeline>(userId, 'timelines') ?? [];
      return buildId ? cached.filter(t => t.buildId === buildId) : cached;
    }
  }

  getById(id: string): Observable<Timeline> {
    return from(this.readOne(id));
  }

  private async readOne(id: string): Promise<Timeline> {
    const found = (await this.readAll()).find(t => t.id === id);
    if (!found) {
      throw new Error(`Timeline ${id} not found`);
    }
    return found;
  }

  create(timeline: Timeline): Observable<Timeline> {
    return from((async () => {
      const userId = this.requireUserId();
      const { error } = await this.table().insert(this.toRow(timeline, userId));
      if (error) {
        throw new Error(error.message);
      }
      return timeline;
    })());
  }

  update(id: string, timeline: Timeline): Observable<Timeline> {
    return from((async () => {
      const userId = this.requireUserId();
      const { error } = await this.table().update(this.toRow(timeline, userId)).eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      return timeline;
    })());
  }

  delete(id: string): Observable<void> {
    return from((async () => {
      this.requireUserId();
      const { error } = await this.table().delete().eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      return undefined;
    })());
  }
}
