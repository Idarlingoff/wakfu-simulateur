import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { Build } from '../models/build.model';
import { Timeline } from '../models/timeline.model';
import { Spell } from '../models/spell.model';
import { Passive } from '../models/passive.model';

export interface SimulationRequest {
  buildId: string;
  timelineId: string;
  context?: {
    availablePa: number;
    availablePw: number;
    availableMp: number;
    description?: string;
  };
}

export interface SimulationResult {
  initialContext: {
    availablePa: number;
    availablePw: number;
    availableMp: number;
    description?: string;
  };
  remainingPa: number;
  remainingPw: number;
  remainingMp: number;
  actions: ActionResult[];
  hasFailure: boolean;
}

export interface ActionResult {
  status: 'SUCCESS' | 'FAILED';
  spellId?: string;
  spellName: string;
  variant?: string;
  paCost: number;
  pwCost: number;
  mpCost: number;
  message: string;
  details?: any;
}

const LS_BUILDS    = 'wakfu_builds';
const LS_TIMELINES = 'wakfu_timelines';

function lsGet<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]; }
  catch { return []; }
}
function lsSet<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

@Injectable({ providedIn: 'root' })
export class WakfuApiService {

  constructor(private http: HttpClient) {}

  // ============ Spells (JSON statique) ============

  getAllSpells(classId?: string): Observable<Spell[]> {
    return this.http.get<Spell[]>('assets/data/Spells.json').pipe(
      map(spells => classId ? spells.filter(s => s.classId === classId) : spells)
    );
  }

  getSpellById(id: string): Observable<Spell> {
    return this.http.get<Spell[]>('assets/data/Spells.json').pipe(
      map(spells => {
        const found = spells.find(s => s.id === id);
        if (!found) throw new Error(`Spell ${id} not found`);
        return found;
      })
    );
  }

  // ============ Passives (JSON statique) ============

  getAllPassives(classId?: string): Observable<Passive[]> {
    return this.http.get<Passive[]>('assets/data/Passives.json').pipe(
      map(passives => classId ? passives.filter(p => p.classId === classId) : passives)
    );
  }

  getPassiveById(id: string): Observable<Passive> {
    return this.http.get<Passive[]>('assets/data/Passives.json').pipe(
      map(passives => {
        const found = passives.find(p => p.id === id);
        if (!found) throw new Error(`Passive ${id} not found`);
        return found;
      })
    );
  }

  // ============ Builds (localStorage) ============

  getAllBuilds(): Observable<Build[]> {
    return of(lsGet<Build>(LS_BUILDS));
  }

  getBuildById(id: string): Observable<Build> {
    const found = lsGet<Build>(LS_BUILDS).find(b => b.id === id);
    return found ? of(found) : throwError(() => new Error(`Build ${id} not found`));
  }

  createBuild(build: Build): Observable<Build> {
    const builds = lsGet<Build>(LS_BUILDS);
    builds.push(build);
    lsSet(LS_BUILDS, builds);
    return of(build);
  }

  updateBuild(id: string, build: Build): Observable<Build> {
    const builds = lsGet<Build>(LS_BUILDS).map(b => b.id === id ? build : b);
    lsSet(LS_BUILDS, builds);
    return of(build);
  }

  deleteBuild(id: string): Observable<void> {
    lsSet(LS_BUILDS, lsGet<Build>(LS_BUILDS).filter(b => b.id !== id));
    return of(undefined);
  }

  // ============ Timelines (localStorage) ============

  getAllTimelines(buildId?: string): Observable<Timeline[]> {
    const timelines = lsGet<Timeline>(LS_TIMELINES);
    return of(buildId ? timelines.filter(t => t.buildId === buildId) : timelines);
  }

  getTimelineById(id: string): Observable<Timeline> {
    const found = lsGet<Timeline>(LS_TIMELINES).find(t => t.id === id);
    return found ? of(found) : throwError(() => new Error(`Timeline ${id} not found`));
  }

  createTimeline(timeline: Timeline): Observable<Timeline> {
    const timelines = lsGet<Timeline>(LS_TIMELINES);
    timelines.push(timeline);
    lsSet(LS_TIMELINES, timelines);
    return of(timeline);
  }

  updateTimeline(id: string, timeline: Timeline): Observable<Timeline> {
    const timelines = lsGet<Timeline>(LS_TIMELINES).map(t => t.id === id ? timeline : t);
    lsSet(LS_TIMELINES, timelines);
    return of(timeline);
  }

  deleteTimeline(id: string): Observable<void> {
    lsSet(LS_TIMELINES, lsGet<Timeline>(LS_TIMELINES).filter(t => t.id !== id));
    return of(undefined);
  }

  // ============ Simulation (moteur local, non utilisé via HTTP) ============

  runSimulation(request: SimulationRequest): Observable<SimulationResult> {
    return throwError(() => new Error('Simulation runs locally via SimulationEngineService'));
  }
}

