import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { Timeline } from '../../models/timeline.model';
import { TimelineRepository } from './timeline-repository';

const LS_TIMELINES = 'wakfu_timelines';

function lsGet<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]; }
  catch { return []; }
}
function lsSet<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

/** Stockage des timelines de l'invite. Comportement historique, inchange. */
@Injectable({ providedIn: 'root' })
export class LocalTimelineRepository implements TimelineRepository {
  getAll(buildId?: string): Observable<Timeline[]> {
    const timelines = lsGet<Timeline>(LS_TIMELINES);
    return of(buildId ? timelines.filter(t => t.buildId === buildId) : timelines);
  }

  getById(id: string): Observable<Timeline> {
    const found = lsGet<Timeline>(LS_TIMELINES).find(t => t.id === id);
    return found ? of(found) : throwError(() => new Error(`Timeline ${id} not found`));
  }

  create(timeline: Timeline): Observable<Timeline> {
    const timelines = lsGet<Timeline>(LS_TIMELINES);
    timelines.push(timeline);
    lsSet(LS_TIMELINES, timelines);
    return of(timeline);
  }

  update(id: string, timeline: Timeline): Observable<Timeline> {
    lsSet(LS_TIMELINES, lsGet<Timeline>(LS_TIMELINES).map(t => (t.id === id ? timeline : t)));
    return of(timeline);
  }

  delete(id: string): Observable<void> {
    lsSet(LS_TIMELINES, lsGet<Timeline>(LS_TIMELINES).filter(t => t.id !== id));
    return of(undefined);
  }

  updateVisibility(id: string, visibility: 'private' | 'unlisted' | 'public'): Observable<void> {
    lsSet(LS_TIMELINES, lsGet<Timeline>(LS_TIMELINES).map(t => (t.id === id ? { ...t, visibility } : t)));
    return of(undefined);
  }
}
