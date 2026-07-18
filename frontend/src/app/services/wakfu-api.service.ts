import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { Build } from '../models/build.model';
import { Timeline } from '../models/timeline.model';
import { Spell } from '../models/spell.model';
import { Passive } from '../models/passive.model';
import { LocalBuildRepository } from './storage/local-build.repository';
import { LocalTimelineRepository } from './storage/local-timeline.repository';
import { AuthService } from './auth.service';
import { SupabaseBuildRepository } from './storage/supabase-build.repository';
import { SupabaseTimelineRepository } from './storage/supabase-timeline.repository';
import { BuildRepository } from './storage/build-repository';
import { TimelineRepository } from './storage/timeline-repository';

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

  private readonly auth = inject(AuthService);
  private readonly localBuilds = inject(LocalBuildRepository);
  private readonly localTimelines = inject(LocalTimelineRepository);
  private readonly cloudBuilds = inject(SupabaseBuildRepository);
  private readonly cloudTimelines = inject(SupabaseTimelineRepository);

  /** Invite -> localStorage, connecte -> Supabase. Seul point de bascule du stockage. */
  private builds(): BuildRepository {
    return this.auth.isAuthenticated() ? this.cloudBuilds : this.localBuilds;
  }

  private timelines(): TimelineRepository {
    return this.auth.isAuthenticated() ? this.cloudTimelines : this.localTimelines;
  }

  // ============ Builds ============

  getAllBuilds(): Observable<Build[]> { return this.builds().getAll(); }
  getBuildById(id: string): Observable<Build> { return this.builds().getById(id); }
  createBuild(build: Build): Observable<Build> { return this.builds().create(build); }
  updateBuild(id: string, build: Build): Observable<Build> { return this.builds().update(id, build); }
  deleteBuild(id: string): Observable<void> { return this.builds().delete(id); }

  // ============ Timelines ============

  getAllTimelines(buildId?: string): Observable<Timeline[]> { return this.timelines().getAll(buildId); }
  getTimelineById(id: string): Observable<Timeline> { return this.timelines().getById(id); }
  createTimeline(timeline: Timeline): Observable<Timeline> { return this.timelines().create(timeline); }
  updateTimeline(id: string, timeline: Timeline): Observable<Timeline> { return this.timelines().update(id, timeline); }
  updateTimelineVisibility(id: string, visibility: 'private' | 'unlisted' | 'public'): Observable<void> { return this.timelines().updateVisibility(id, visibility); }
  deleteTimeline(id: string): Observable<void> { return this.timelines().delete(id); }

  // ============ Simulation (moteur local, non utilisé via HTTP) ============

  runSimulation(request: SimulationRequest): Observable<SimulationResult> {
    return throwError(() => new Error('Simulation runs locally via SimulationEngineService'));
  }
}

