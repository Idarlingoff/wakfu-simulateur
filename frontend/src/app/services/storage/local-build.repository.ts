import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { Build } from '../../models/build.model';
import { BuildRepository } from './build-repository';

const LS_BUILDS = 'wakfu_builds';

function lsGet<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]; }
  catch { return []; }
}
function lsSet<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

/** Stockage des builds de l'invite. Comportement historique, inchange. */
@Injectable({ providedIn: 'root' })
export class LocalBuildRepository implements BuildRepository {
  getAll(): Observable<Build[]> {
    return of(lsGet<Build>(LS_BUILDS));
  }

  getById(id: string): Observable<Build> {
    const found = lsGet<Build>(LS_BUILDS).find(b => b.id === id);
    return found ? of(found) : throwError(() => new Error(`Build ${id} not found`));
  }

  create(build: Build): Observable<Build> {
    const builds = lsGet<Build>(LS_BUILDS);
    builds.push(build);
    lsSet(LS_BUILDS, builds);
    return of(build);
  }

  update(id: string, build: Build): Observable<Build> {
    lsSet(LS_BUILDS, lsGet<Build>(LS_BUILDS).map(b => (b.id === id ? build : b)));
    return of(build);
  }

  delete(id: string): Observable<void> {
    lsSet(LS_BUILDS, lsGet<Build>(LS_BUILDS).filter(b => b.id !== id));
    return of(undefined);
  }
}
