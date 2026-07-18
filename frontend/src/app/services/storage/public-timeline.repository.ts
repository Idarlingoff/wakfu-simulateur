import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Timeline } from '../../models/timeline.model';
import { SharedTimeline } from '../../models/shared-timeline.model';
import { SupabaseClientService } from '../supabase-client.service';

/**
 * Lectures publiques des timelines. Distinct de SupabaseTimelineRepository, qui filtre
 * sur owner_id et rend [] sans utilisateur : il ne peut pas servir la lecture publique.
 *
 * Aucun repli hors-ligne : les donnees publiques ne sont pas dans le miroir (cloisonne
 * par utilisateur). Hors-ligne, la galerie affiche une liste vide et un message.
 */
@Injectable({ providedIn: 'root' })
export class PublicTimelineRepository {
  private readonly supabase = inject(SupabaseClientService);

  getPublic(classId?: string): Observable<SharedTimeline[]> {
    return from(this.readPublic(classId));
  }

  private async readPublic(classId?: string): Promise<SharedTimeline[]> {
    try {
      // Fonction dediee, pas un embed PostgREST : il n'existe pas de FK
      // timelines->profiles, donc `.select('...profiles(username)')` echoue (PGRST200)
      // et viderait la galerie. La fonction joint profiles cote SQL.
      const { data, error } = await this.supabase.client
        .rpc('get_public_timelines', { class_filter: classId ?? null });
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).map((row: any) => this.fromRow(row));
    } catch {
      return [];
    }
  }

  getByShareToken(token: string): Observable<SharedTimeline | null> {
    return from(this.readByToken(token));
  }

  private async readByToken(token: string): Promise<SharedTimeline | null> {
    try {
      const { data, error } = await this.supabase.client.rpc('get_shared_timeline', { token });
      if (error) {
        throw new Error(error.message);
      }
      const rows = (data ?? []) as any[];
      return rows.length ? this.fromRow(rows[0]) : null;
    } catch {
      return null;
    }
  }

  private fromRow(row: any): SharedTimeline {
    return {
      ...(row.data as Timeline),
      id: row.id,
      name: row.name,
      buildId: row.build_id ?? '',
      classId: row.class_id ?? undefined,
      visibility: row.visibility ?? undefined,
      shareToken: row.share_token ?? undefined,
      // Les deux fonctions SQL renvoient author_username a plat.
      authorUsername: row.author_username ?? 'Anonyme',
    };
  }
}
