import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SupabaseClientService } from './supabase-client.service';

/** Construit un faux client Supabase, surchargeable par test. */
function makeFakeClient(options: {
  session?: any;
  getSessionRejects?: boolean;
  profileRow?: { id: string; username: string } | null;
} = {}) {
  const listeners: Array<(event: string, session: any) => void> = [];
  return {
    listeners,
    auth: {
      getSession: () =>
        options.getSessionRejects
          ? Promise.reject(new Error('Failed to fetch'))
          : Promise.resolve({ data: { session: options.session ?? null }, error: null }),
      onAuthStateChange: (cb: (event: string, session: any) => void) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: options.profileRow ?? null, error: null }),
        }),
      }),
    }),
  };
}

function configure(fake: any): AuthService {
  TestBed.configureTestingModule({
    providers: [AuthService, { provide: SupabaseClientService, useValue: { client: fake } }],
  });
  return TestBed.inject(AuthService);
}

describe('AuthService', () => {
  it('passe en anonymous quand il n y a pas de session', async () => {
    const service = configure(makeFakeClient({ session: null }));
    await service.ready();
    expect(service.status()).toBe('anonymous');
    expect(service.profile()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('passe en authenticated et charge le profil quand une session existe', async () => {
    const fake = makeFakeClient({
      session: { user: { id: 'u1', email: 'a@b.c' } },
      profileRow: { id: 'u1', username: 'Lilia' },
    });
    const service = configure(fake);
    await service.ready();
    expect(service.status()).toBe('authenticated');
    expect(service.profile()?.username).toBe('Lilia');
    expect(service.isAuthenticated()).toBe(true);
  });

  // L'invariant central du lot : une panne d'auth ne doit jamais casser le simulateur.
  it('retombe en anonymous si Supabase est injoignable, sans rester bloque en loading', async () => {
    const service = configure(makeFakeClient({ getSessionRejects: true }));
    await service.ready();
    expect(service.status()).toBe('anonymous');
    expect(service.profile()).toBeNull();
  });

  it('reagit a une deconnexion emise par onAuthStateChange', async () => {
    const fake = makeFakeClient({
      session: { user: { id: 'u1' } },
      profileRow: { id: 'u1', username: 'Lilia' },
    });
    const service = configure(fake);
    await service.ready();
    expect(service.status()).toBe('authenticated');

    fake.listeners.forEach(cb => cb('SIGNED_OUT', null));
    await service.ready();

    expect(service.status()).toBe('anonymous');
    expect(service.profile()).toBeNull();
  });
});
