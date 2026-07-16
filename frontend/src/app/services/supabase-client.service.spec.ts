import { TestBed } from '@angular/core/testing';
import { SupabaseClientService } from './supabase-client.service';

describe('SupabaseClientService', () => {
  let service: SupabaseClientService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SupabaseClientService] });
    service = TestBed.inject(SupabaseClientService);
  });

  it('expose un client avec un module auth', () => {
    expect(service.client).toBeTruthy();
    expect(service.client.auth).toBeTruthy();
  });

  it('retourne toujours la meme instance', () => {
    expect(service.client).toBe(service.client);
  });
});
