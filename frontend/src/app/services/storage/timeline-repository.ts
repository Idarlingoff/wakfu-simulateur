import { Observable } from 'rxjs';
import { Timeline } from '../../models/timeline.model';

/** Contrat de stockage des timelines. Implemente en local (invite) et Supabase (connecte). */
export interface TimelineRepository {
  getAll(buildId?: string): Observable<Timeline[]>;
  getById(id: string): Observable<Timeline>;
  create(timeline: Timeline): Observable<Timeline>;
  update(id: string, timeline: Timeline): Observable<Timeline>;
  delete(id: string): Observable<void>;
  /**
   * Change UNIQUEMENT la visibilite. Chemin dedie car cote Supabase, visibility est une
   * colonne top-level (lue par RLS et get_shared_timeline), et non un champ du blob data :
   * la router via update()/toRow() n'ecrirait que dans data et ne rendrait rien visible.
   */
  updateVisibility(id: string, visibility: 'private' | 'unlisted' | 'public'): Observable<void>;
}
