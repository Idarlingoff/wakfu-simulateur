import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SupabaseClientService } from './supabase-client.service';

/** Construit un faux client Supabase, surchargeable par test. */
function makeFakeClient(options: {
  session?: any;
  getSessionRejects?: boolean;
  profileRow?: { id: string; username: string } | null;
  replayInitialSession?: boolean;
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
        // Le vrai client Supabase rejoue INITIAL_SESSION a chaque abonnement.
        if (options.replayInitialSession) {
          cb('INITIAL_SESSION', options.session ?? null);
        }
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: () => Promise.resolve({ error: null }),
    },
    profileQueries: [] as string[],
    from(this: any) {
      const self = this;
      return {
        select: () => ({
          eq: (column: string, _value: unknown) => {
            self.profileQueries.push(column);
            return {
              single: () => Promise.resolve({ data: options.profileRow ?? null, error: null }),
            };
          },
        }),
      };
    },
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

  // Le vrai client rejoue INITIAL_SESSION : sans garde, applySession tournerait deux fois
  // au demarrage et rechargerait le profil pour rien.
  it('ne charge le profil qu une fois malgre le replay INITIAL_SESSION', async () => {
    const fake: any = makeFakeClient({
      session: { user: { id: 'u1' } },
      profileRow: { id: 'u1', username: 'Lilia' },
      replayInitialSession: true,
    });
    const service = configure(fake);
    await service.ready();

    expect(service.status()).toBe('authenticated');
    expect(fake.profileQueries.filter((c: string) => c === 'id').length).toBe(1);
  });

  it('interroge profiles par id pour charger le profil', async () => {
    const fake: any = makeFakeClient({
      session: { user: { id: 'u1' } },
      profileRow: { id: 'u1', username: 'Lilia' },
    });
    const service = configure(fake);
    await service.ready();
    expect(fake.profileQueries).toContain('id');
  });

  describe('actions', () => {
    it('signIn retourne ok quand Supabase accepte', async () => {
      const fake: any = makeFakeClient({ session: null });
      fake.auth.signInWithPassword = () => Promise.resolve({ data: {}, error: null });
      const service = configure(fake);
      await service.ready();

      const result = await service.signIn('a@b.c', 'motdepasse8');
      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('signIn traduit une erreur d identifiants', async () => {
      const fake: any = makeFakeClient({ session: null });
      fake.auth.signInWithPassword = () =>
        Promise.resolve({ data: {}, error: { message: 'Invalid login credentials' } });
      const service = configure(fake);
      await service.ready();

      const result = await service.signIn('a@b.c', 'faux');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Email ou mot de passe incorrect.');
    });

    it('signIn traduit une exception reseau sans la laisser remonter', async () => {
      const fake: any = makeFakeClient({ session: null });
      fake.auth.signInWithPassword = () => Promise.reject(new Error('Failed to fetch'));
      const service = configure(fake);
      await service.ready();

      const result = await service.signIn('a@b.c', 'motdepasse8');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Service indisponible, tu peux continuer sans compte.');
    });

    it('signUp refuse un pseudo deja pris sans appeler Supabase', async () => {
      const fake: any = makeFakeClient({ profileRow: { id: 'autre', username: 'Lilia' } });
      const signUpSpy = jasmine.createSpy('signUp');
      fake.auth.signUp = signUpSpy;
      const service = configure(fake);
      await service.ready();

      const result = await service.signUp('a@b.c', 'motdepasse8', 'Lilia');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Ce pseudo est deja utilise.');
      expect(signUpSpy).not.toHaveBeenCalled();
    });

    it('signUp transmet le pseudo en metadonnees quand il est libre', async () => {
      const fake: any = makeFakeClient({ profileRow: null });
      const signUpSpy = jasmine
        .createSpy('signUp')
        .and.returnValue(Promise.resolve({ data: {}, error: null }));
      fake.auth.signUp = signUpSpy;
      const service = configure(fake);
      await service.ready();

      const result = await service.signUp('a@b.c', 'motdepasse8', 'Nouveau');
      expect(result.ok).toBe(true);
      const args = signUpSpy.calls.mostRecent().args[0];
      expect(args.email).toBe('a@b.c');
      expect(args.options.data.username).toBe('Nouveau');
    });

    it('signOut repasse en anonymous', async () => {
      const fake: any = makeFakeClient({
        session: { user: { id: 'u1' } },
        profileRow: { id: 'u1', username: 'Lilia' },
      });
      const service = configure(fake);
      await service.ready();
      expect(service.status()).toBe('authenticated');

      await service.signOut();
      expect(service.status()).toBe('anonymous');
      expect(service.profile()).toBeNull();
    });

    it('interroge profiles par username pour le controle d unicite', async () => {
      const fake: any = makeFakeClient({ profileRow: null });
      fake.auth.signUp = () => Promise.resolve({ data: {}, error: null });
      const service = configure(fake);
      await service.ready();

      await service.signUp('a@b.c', 'motdepasse8', 'Nouveau');
      expect(fake.profileQueries).toContain('username');
    });

    // Un applySession en vol ne doit pas ressusciter la session apres un signOut.
    it('ne se reauthentifie pas si un applySession obsolete se termine apres signOut', async () => {
      const fake: any = makeFakeClient({ session: { user: { id: 'u1' } } });
      let resolveProfile: (v: any) => void = () => {};
      fake.from = () => ({
        select: () => ({
          eq: () => ({
            single: () => new Promise(resolve => { resolveProfile = resolve; }),
          }),
        }),
      });
      const service = configure(fake);

      // Le chargement du profil est en vol ; on deconnecte pendant ce temps.
      await service.signOut();
      expect(service.status()).toBe('anonymous');

      // Le profil obsolete arrive enfin : il ne doit rien ecraser.
      resolveProfile({ data: { id: 'u1', username: 'Lilia' }, error: null });
      await service.ready();

      expect(service.status()).toBe('anonymous');
      expect(service.profile()).toBeNull();
    });

    it('requestPasswordReset retourne ok', async () => {
      const fake: any = makeFakeClient({ session: null });
      fake.auth.resetPasswordForEmail = () => Promise.resolve({ data: {}, error: null });
      const service = configure(fake);
      await service.ready();

      const result = await service.requestPasswordReset('a@b.c');
      expect(result.ok).toBe(true);
    });
  });
});
