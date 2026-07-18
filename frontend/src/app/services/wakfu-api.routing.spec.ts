import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { WakfuApiService } from './wakfu-api.service';
import { AuthService } from './auth.service';
import { LocalBuildRepository } from './storage/local-build.repository';
import { LocalTimelineRepository } from './storage/local-timeline.repository';
import { SupabaseBuildRepository } from './storage/supabase-build.repository';
import { SupabaseTimelineRepository } from './storage/supabase-timeline.repository';

function configure(authenticated: boolean) {
  const localBuilds = { getAll: jasmine.createSpy('local.getAll').and.returnValue(of([])) };
  const cloudBuilds = { getAll: jasmine.createSpy('cloud.getAll').and.returnValue(of([])) };
  const localTimelines = { getAll: jasmine.createSpy('localTl.getAll').and.returnValue(of([])) };
  const cloudTimelines = { getAll: jasmine.createSpy('cloudTl.getAll').and.returnValue(of([])) };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { isAuthenticated: () => authenticated } },
      { provide: LocalBuildRepository, useValue: localBuilds },
      { provide: LocalTimelineRepository, useValue: localTimelines },
      { provide: SupabaseBuildRepository, useValue: cloudBuilds },
      { provide: SupabaseTimelineRepository, useValue: cloudTimelines },
    ],
  });
  return { api: TestBed.inject(WakfuApiService), localBuilds, cloudBuilds, localTimelines, cloudTimelines };
}

describe('WakfuApiService — routage selon l etat d auth', () => {
  it('utilise le repo local quand on est invite', () => {
    const { api, localBuilds, cloudBuilds } = configure(false);
    api.getAllBuilds().subscribe();
    expect(localBuilds.getAll).toHaveBeenCalled();
    expect(cloudBuilds.getAll).not.toHaveBeenCalled();
  });

  it('utilise le repo cloud quand on est connecte', () => {
    const { api, localBuilds, cloudBuilds } = configure(true);
    api.getAllBuilds().subscribe();
    expect(cloudBuilds.getAll).toHaveBeenCalled();
    expect(localBuilds.getAll).not.toHaveBeenCalled();
  });

  it('route aussi les timelines en invite', () => {
    const { api, localTimelines, cloudTimelines } = configure(false);
    api.getAllTimelines().subscribe();
    expect(localTimelines.getAll).toHaveBeenCalled();
    expect(cloudTimelines.getAll).not.toHaveBeenCalled();
  });

  it('route aussi les timelines en connecte', () => {
    const { api, localTimelines, cloudTimelines } = configure(true);
    api.getAllTimelines().subscribe();
    expect(cloudTimelines.getAll).toHaveBeenCalled();
    expect(localTimelines.getAll).not.toHaveBeenCalled();
  });
});
