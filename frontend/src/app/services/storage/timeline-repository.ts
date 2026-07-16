import { Observable } from 'rxjs';
import { Timeline } from '../../models/timeline.model';

/** Contrat de stockage des timelines. Implemente en local (invite) et Supabase (connecte). */
export interface TimelineRepository {
  getAll(buildId?: string): Observable<Timeline[]>;
  getById(id: string): Observable<Timeline>;
  create(timeline: Timeline): Observable<Timeline>;
  update(id: string, timeline: Timeline): Observable<Timeline>;
  delete(id: string): Observable<void>;
}
