import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class WakfuApiService {
  private readonly baseUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  // ============ Build API ============

  getAllBuilds(): Observable<Build[]> {
    return this.http.get<Build[]>(`${this.baseUrl}/builds`);
  }

  getBuildById(id: string): Observable<Build> {
    return this.http.get<Build>(`${this.baseUrl}/builds/${id}`);
  }

  createBuild(build: Build): Observable<Build> {
    return this.http.post<Build>(`${this.baseUrl}/builds`, build);
  }

  updateBuild(id: string, build: Build): Observable<Build> {
    return this.http.put<Build>(`${this.baseUrl}/builds/${id}`, build);
  }

  deleteBuild(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/builds/${id}`);
  }

  // ============ Timeline API ============

  getAllTimelines(buildId?: string): Observable<Timeline[]> {
    if (buildId) {
      return this.http.get<Timeline[]>(`${this.baseUrl}/timelines`, {
        params: { buildId }
      });
    }
    return this.http.get<Timeline[]>(`${this.baseUrl}/timelines`);
  }

  getTimelineById(id: string): Observable<Timeline> {
    return this.http.get<Timeline>(`${this.baseUrl}/timelines/${id}`);
  }

  createTimeline(timeline: Timeline): Observable<Timeline> {
    return this.http.post<Timeline>(`${this.baseUrl}/timelines`, timeline);
  }

  updateTimeline(id: string, timeline: Timeline): Observable<Timeline> {
    return this.http.put<Timeline>(`${this.baseUrl}/timelines/${id}`, timeline);
  }

  deleteTimeline(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/timelines/${id}`);
  }

  // ============ Spell API ============

  getAllSpells(classId?: string): Observable<Spell[]> {
    if (classId) {
      return this.http.get<Spell[]>(`${this.baseUrl}/spells`, {
        params: { classId }
      });
    }
    return this.http.get<Spell[]>(`${this.baseUrl}/spells`);
  }

  getSpellById(id: string): Observable<Spell> {
    return this.http.get<Spell>(`${this.baseUrl}/spells/${id}`);
  }

  // ============ Passive API ============

  getAllPassives(classId?: string): Observable<Passive[]> {
    if (classId) {
      return this.http.get<Passive[]>(`${this.baseUrl}/passives`, {
        params: { classId }
      });
    }
    return this.http.get<Passive[]>(`${this.baseUrl}/passives`);
  }

  getPassiveById(id: string): Observable<Passive> {
    return this.http.get<Passive>(`${this.baseUrl}/passives/${id}`);
  }

  // ============ Simulation API ============

  runSimulation(request: SimulationRequest): Observable<SimulationResult> {
    return this.http.post<SimulationResult>(`${this.baseUrl}/simulations/run`, request);
  }
}

